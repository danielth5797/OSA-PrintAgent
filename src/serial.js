// RF-103 Fase 4 (cajón de dinero) — entrega de bytes ya armados (el pulso
// ESC/POS de apertura, `core/escpos.ts`'s `buildDrawerKickEscPos` en
// OSA-API) a un cajón USB **standalone** (sin impresora de por medio,
// `PrinterStation.deviceKind: 'CASH_DRAWER'`). A diferencia de
// `printEscPos.js` (que manda a una cola de impresión del sistema
// operativo), acá se le escribe directo al puerto serial — el sistema
// operativo no ve este dispositivo como una impresora.
//
// Deliberadamente SIN agregar `serialport` (npm) — mismo criterio de "cero
// dependencias externas" del resto de este repo: macOS/Linux exponen el
// puerto como un archivo de dispositivo normal (`fs.writeFile` alcanza);
// Windows no tiene equivalente sin una librería nativa, así que se resuelve
// con el mismo patrón `execFile('powershell', ...)` ya usado en
// `printers.js` para `Get-Printer`.
//
// ⚠️ Sin cajón USB real disponible para verificar en esta sesión — mismo
// disclaimer que el resto de este repo/`core/escpos.ts`. La velocidad de
// 9600 baudios es el default casi universal de este tipo de hardware RS232;
// algunos modelos usan otra — si hace falta, es un parámetro más a exponer
// desde OSA, no un cambio de arquitectura.

import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);
const DEFAULT_BAUD_RATE = 9600;

async function listSerialPortsUnix() {
  try {
    const entries = await readdir('/dev');
    return entries
      .filter((name) => /^(tty\.|cu\.|ttyUSB|ttyACM)/.test(name))
      .map((name) => ({ id: `/dev/${name}`, name: `/dev/${name}` }));
  } catch {
    // `/dev` siempre existe en macOS/Linux — un error acá es defensivo, no
    // se espera en la práctica; igual nunca tumba el agente.
    return [];
  }
}

async function listSerialPortsWindows() {
  try {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-Command',
      '[System.IO.Ports.SerialPort]::GetPortNames()',
    ]);
    return stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((name) => ({ id: name, name }));
  } catch {
    return [];
  }
}

/** `[{id, name}]` — el `id` es la ruta real del dispositivo (`/dev/tty.usbserial-...`) o el nombre del puerto COM (`COM3`), según plataforma. */
export async function listSerialPorts() {
  if (platform() === 'darwin' || platform() === 'linux') return listSerialPortsUnix();
  if (platform() === 'win32') return listSerialPortsWindows();
  return [];
}

async function sendToSerialPortUnix(devicePath, payload) {
  // El puerto serial en macOS/Linux ES un archivo de dispositivo real —
  // escribirle es una escritura de archivo normal, sin abrir/cerrar una
  // "conexión" aparte.
  await writeFile(devicePath, payload);
}

async function sendToSerialPortWindows(devicePath, payload, baudRate) {
  const tmpFile = join(tmpdir(), `osa-drawer-${randomUUID()}.bin`);
  await writeFile(tmpFile, payload);
  try {
    const script = [
      `$bytes = [System.IO.File]::ReadAllBytes('${tmpFile.replace(/'/g, "''")}')`,
      `$port = New-Object System.IO.Ports.SerialPort('${devicePath.replace(/'/g, "''")}', ${baudRate})`,
      '$port.Open()',
      '$port.Write($bytes, 0, $bytes.Length)',
      'Start-Sleep -Milliseconds 200',
      '$port.Close()',
    ].join('; ');
    await execFileAsync('powershell', ['-NoProfile', '-Command', script]);
  } finally {
    await unlink(tmpFile).catch(() => {});
  }
}

/** `devicePath` = `/dev/tty.usbserial-...` (macOS/Linux) o `COM3` (Windows) — el `agentPrinterId` que reportó `listSerialPorts()` y que el admin eligió desde OSA. */
export async function sendToSerialPort(devicePath, payload, baudRate = DEFAULT_BAUD_RATE) {
  if (platform() === 'darwin' || platform() === 'linux') return sendToSerialPortUnix(devicePath, payload);
  if (platform() === 'win32') return sendToSerialPortWindows(devicePath, payload, baudRate);
  throw new Error(`Apertura de cajón por puerto serial no implementada todavía en esta plataforma (${platform()}).`);
}
