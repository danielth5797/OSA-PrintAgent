// RF-103 Fases 2-3 — entrega real de los bytes ESC/POS ya armados por el
// servidor (el agente nunca los arma — ver `core/escpos.ts` en
// OSA-API). Dos caminos, según la estación:
//   - `NETWORK`: socket TCP crudo directo a `host:port` (idéntico en espíritu
//     a `sendToNetworkPrinter` del backend — un agente puede recibir
//     estaciones de red también, ej. detrás de un firewall que la API en la
//     nube no alcanza).
//   - `USB`: vía el spooler del sistema operativo, sin driver gráfico de por
//     medio (los bytes ESC/POS van tal cual a la impresora):
//       - macOS/Linux: CUPS `lp -d <cola> -o raw`.
//       - Windows: `copy /b <archivo> \\localhost\<nombre-compartido>` — la
//         impresora debe estar COMPARTIDA en Windows con ESE nombre exacto
//         (ver el instructivo de instalación, paso "Compartir la impresora
//         en Windows"). Es la técnica estándar que usa la mayoría del
//         software de punto de venta en Windows para mandar bytes crudos sin
//         pasar por el driver gráfico de la impresora.
//
// ⚠️ Sin hardware real para verificar en ninguna plataforma en esta sesión.
// El camino de red SÍ se verificó de punta a punta contra un socket real
// (falla controlada, ver README). El de USB (macOS/Linux) solo se verificó
// contra CUPS sin ninguna cola configurada (falla controlada también, pero
// nunca llegó a intentar imprimir de verdad). El de Windows es código nuevo
// de Fase 3, sin ninguna verificación — ni siquiera de la falla controlada.

import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import net from 'node:net';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const NETWORK_TIMEOUT_MS = 5000;

function printToNetwork(host, port, payload) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      err ? reject(err) : resolve();
    };
    socket.setTimeout(NETWORK_TIMEOUT_MS);
    socket.once('timeout', () => finish(new Error(`Tiempo de espera agotado conectando a ${host}:${port}`)));
    socket.once('error', (err) => finish(err));
    socket.connect(port, host, () => {
      socket.write(payload, (err) => finish(err));
    });
  });
}

async function writeTempFile(payload, ext) {
  const tmpFile = join(tmpdir(), `osa-print-${randomUUID()}.${ext}`);
  await writeFile(tmpFile, payload);
  return tmpFile;
}

async function printToUsbUnix(printerId, payload) {
  const tmpFile = await writeTempFile(payload, 'bin');
  try {
    // `-o raw`: sin pasar por ningún driver/traductor de CUPS — los bytes ESC/POS van tal cual.
    await execFileAsync('lp', ['-d', printerId, '-o', 'raw', tmpFile]);
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function printToUsbWindows(printerId, payload) {
  const tmpFile = await writeTempFile(payload, 'prn');
  try {
    // `/b` = copia binaria (sin traducción de fin de línea, crítico para ESC/POS crudo).
    // `\\localhost\<printerId>` — requiere que esa impresora esté compartida en
    // Windows bajo ese nombre exacto (ver README/instalación).
    await execFileAsync('cmd', ['/c', 'copy', '/b', tmpFile, `\\\\localhost\\${printerId}`]);
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

async function printToUsb(printerId, payload) {
  if (platform() === 'darwin' || platform() === 'linux') return printToUsbUnix(printerId, payload);
  if (platform() === 'win32') return printToUsbWindows(printerId, payload);
  throw new Error(`Impresión USB no implementada todavía en esta plataforma (${platform()}).`);
}

/** `station` = el objeto que ya viene en cada trabajo de `GET /api/print-agents/jobs`. `payload` = Buffer de bytes ESC/POS ya decodificados. */
export async function printJob(station, payload) {
  if (station.connectionType === 'NETWORK') {
    if (!station.host) throw new Error('Esta estación de red no tiene una IP configurada.');
    return printToNetwork(station.host, station.port ?? 9100, payload);
  }
  if (!station.agentPrinterId) {
    throw new Error('Esta estación USB todavía no tiene una impresora local asignada en OSA.');
  }
  return printToUsb(station.agentPrinterId, payload);
}
