// RF-103 Fase 3 — sin impresora térmica real disponible, `printJob()` solo
// se había verificado manualmente en sesiones anteriores: el camino de red
// contra un socket cerrado (falla controlada) y el camino USB contra CUPS
// sin ninguna cola configurada (falla controlada también, nunca llegó a
// intentar imprimir de verdad). Esta suite cubre lo que sí se puede
// garantizar sin hardware:
//   - red: un servidor TCP real en 127.0.0.1 que recibe los bytes — camino
//     de éxito de punta a punta, nunca antes probado.
//   - USB (macOS/Linux): una cola CUPS real, temporal, con backend
//     `socket://127.0.0.1:<puerto>` apuntando a ese mismo servidor de
//     mentira — ejercita literalmente el mismo `lp -d <cola> -o raw
//     <archivo>` que usa `printToUsbUnix` en producción, a través del
//     spooler real de CUPS, no una simulación. Se salta con gracia (no
//     falla la suite) si este sistema no tiene CUPS/`lpadmin` disponible —
//     ej. una corrida en CI Linux sin CUPS instalado, o sin permiso de
//     administración de impresoras.
//
// Sin dependencias nuevas — usa el corredor de pruebas nativo de Node
// (`node:test`), coherente con el resto de este agente (cero dependencias
// externas también en producción).

import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { printJob } from '../src/printEscPos.js';

const execFileAsync = promisify(execFile);

/** Levanta un servidor TCP real en un puerto libre; devuelve el puerto y una promesa que resuelve con TODOS los bytes recibidos en la primera conexión. Cierra el servidor solo DESPUÉS de que esa promesa resuelva — cerrarlo antes descarta la conexión ya aceptada pero aún no entregada al callback de `'connection'` (bug real encontrado escribiendo la prueba equivalente en RestauCloud-API, ver `project_printer_station_routing.md`). */
function startFakePrinter() {
  const chunks = [];
  let resolveReceived;
  const received = new Promise((resolve) => {
    resolveReceived = resolve;
  });
  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('close', () => resolveReceived(Buffer.concat(chunks)));
  });
  const listening = new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
  return { server, listening, received };
}

describe('printJob — estación NETWORK, contra un TCP real', () => {
  test('conecta, escribe el payload completo y no lanza', async () => {
    const { server, listening, received } = startFakePrinter();
    const port = await listening;
    const payload = Buffer.from([0x1b, 0x40, ...Buffer.from('PRUEBA\n', 'ascii'), 0x1d, 0x56, 0x00]);

    await printJob({ connectionType: 'NETWORK', host: '127.0.0.1', port }, payload);

    const receivedBytes = await received;
    server.close();
    assert.ok(receivedBytes.equals(payload), 'los bytes recibidos deben ser idénticos byte-por-byte');
  });

  test('rechaza (throw) contra un puerto sin nadie escuchando', async () => {
    const payload = Buffer.from('x');
    await assert.rejects(
      () => printJob({ connectionType: 'NETWORK', host: '127.0.0.1', port: 1 }, payload),
      /./,
      'debe rechazar con un error real, nunca resolver en silencio'
    );
  });

  test('rechaza con un mensaje claro si la estación de red no tiene host configurado', async () => {
    await assert.rejects(
      () => printJob({ connectionType: 'NETWORK', host: null }, Buffer.from('x')),
      /IP configurada/
    );
  });
});

describe('printJob — estación USB (macOS/Linux), contra una cola CUPS real', () => {
  const QUEUE_NAME = 'restrocloud-print-agent-test-queue';
  let cupsAvailable = false;

  test('detecta si CUPS/lpadmin está disponible en este sistema (se salta con gracia si no)', async (t) => {
    if (platform() !== 'darwin' && platform() !== 'linux') {
      t.skip(`plataforma ${platform()} no usa CUPS (Windows tiene su propio camino, sin verificar — ver README)`);
      return;
    }
    try {
      await execFileAsync('lpstat', ['-r']); // "scheduler is running" si CUPS está vivo
      cupsAvailable = true;
    } catch {
      t.skip('CUPS no disponible en este sistema (lpstat falló) — el resto de esta suite se salta');
    }
  });

  after(async () => {
    // limpieza best-effort de la cola de prueba, por si algún test la dejó viva
    try {
      await execFileAsync('lpadmin', ['-x', QUEUE_NAME]);
    } catch {
      /* no existía, nada que limpiar */
    }
  });

  test('lp -d <cola> -o raw entrega los bytes intactos a través del spooler real de CUPS', async (t) => {
    if (!cupsAvailable) {
      t.skip('CUPS no disponible — ver el test de detección arriba');
      return;
    }

    const { server, listening, received } = startFakePrinter();
    const port = await listening;

    // cola CUPS real (efímera, se borra al final) con backend socket:// apuntando
    // a nuestro servidor de mentira — así `lp -d <cola> -o raw` corre exactamente
    // igual que contra una impresora térmica real conectada por red/USB-serie.
    try {
      await execFileAsync('lpadmin', ['-p', QUEUE_NAME, '-E', '-v', `socket://127.0.0.1:${port}`, '-o', 'raw']);
    } catch (e) {
      server.close();
      t.skip(`no se pudo crear una cola CUPS de prueba (${e.message}) — probablemente falta el grupo _lpadmin o el backend socket:// está restringido en este sistema`);
      return;
    }

    try {
      const payload = Buffer.from([0x1b, 0x40, ...Buffer.from('PRUEBA CUPS REAL\n', 'ascii'), 0x1d, 0x56, 0x00]);
      await printJob({ connectionType: 'USB', agentPrinterId: QUEUE_NAME }, payload);

      const receivedBytes = await received;
      server.close();
      assert.ok(
        receivedBytes.equals(payload),
        'lo que CUPS efectivamente envió a través del backend socket:// debe ser idéntico byte-por-byte al payload ESC/POS armado por el backend'
      );
    } finally {
      await execFileAsync('lpadmin', ['-x', QUEUE_NAME]).catch(() => {});
    }
  });

  test('rechaza con un mensaje claro si la estación USB no tiene impresora local asignada', async () => {
    await assert.rejects(
      () => printJob({ connectionType: 'USB', agentPrinterId: null }, Buffer.from('x')),
      /impresora local asignada/
    );
  });
});
