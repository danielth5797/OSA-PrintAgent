// RF-103 Fase 4 (cajón de dinero) — sin un cajón USB real disponible en esta
// sesión, esta suite cubre lo único que sí se puede garantizar sin
// hardware: en macOS/Linux, `sendToSerialPort` escribe los bytes exactos al
// archivo de dispositivo indicado (un puerto serial real ES un archivo de
// dispositivo — acá se usa un archivo temporal real como stand-in, ya que
// `fs.writeFile` no distingue uno de otro). El camino de Windows
// (PowerShell + `System.IO.Ports.SerialPort`) queda sin verificar, mismo
// criterio ya documentado para el USB de Windows en `printEscPos.test.js`.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFile, unlink } from 'node:fs/promises';
import { sendToSerialPort, listSerialPorts } from '../src/serial.js';

describe('sendToSerialPort — macOS/Linux, contra un archivo real', () => {
  test('escribe los bytes exactos en el "puerto" (archivo de dispositivo)', async (t) => {
    if (platform() !== 'darwin' && platform() !== 'linux') {
      t.skip('Windows tiene su propio camino (PowerShell), sin verificar — ver README');
      return;
    }
    const devicePath = join(tmpdir(), `osa-drawer-test-${randomUUID()}.dev`);
    const payload = Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]); // pulso de apertura de cajón

    await sendToSerialPort(devicePath, payload);

    const written = await readFile(devicePath);
    await unlink(devicePath).catch(() => {});
    assert.ok(written.equals(payload), 'los bytes escritos deben ser idénticos byte-por-byte al payload');
  });

  test('rechaza (throw) si el archivo/puerto no se puede escribir', async (t) => {
    if (platform() !== 'darwin' && platform() !== 'linux') {
      t.skip('Windows tiene su propio camino, sin verificar');
      return;
    }
    await assert.rejects(
      () => sendToSerialPort('/ruta/que/no/existe/ni/puede/crearse/dispositivo', Buffer.from([0x01])),
      /./,
      'debe rechazar con un error real, nunca resolver en silencio'
    );
  });
});

describe('listSerialPorts', () => {
  test('nunca lanza, incluso sin ningún puerto serial en esta PC', async () => {
    const ports = await listSerialPorts();
    assert.ok(Array.isArray(ports));
  });
});
