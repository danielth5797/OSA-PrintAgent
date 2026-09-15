// RF-103 Fase 3 — descubrimiento de impresoras instaladas en esta PC, para
// reportarlas al servidor (`POST /api/print-agents/heartbeat`) y que
// aparezcan como opción en el selector de OSA al crear una estación
// USB. Puramente informativo — el agente igual intenta imprimir a lo que la
// estación le diga, exista o no en esta lista.
//
// macOS/Linux vía CUPS (`lpstat -p`) — verificado en vivo (Fase 2, esta Mac
// sin ninguna cola configurada, devolvió `[]` correctamente).
//
// ⚠️ Windows vía PowerShell `Get-Printer` — código nuevo de Fase 3, **sin
// verificar contra una PC Windows real** (no había ninguna disponible en
// esta sesión). Requiere PowerShell 5.1+ (viene de fábrica desde Windows 8.1/
// Server 2012 R2) y el módulo `PrintManagement`, incluido por defecto salvo
// en instalaciones "Server Core". Si falla, `listPrinters()` devuelve `[]`
// en vez de tumbar el agente — igual que el camino de macOS/Linux.

import { execFile } from 'node:child_process';
import { platform } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function listPrintersUnix() {
  try {
    const { stdout } = await execFileAsync('lpstat', ['-p']);
    // Formato real de `lpstat -p`: "printer <nombre> is idle.  enabled since ..."
    const printers = [];
    for (const line of stdout.split('\n')) {
      const m = line.match(/^printer\s+(\S+)\s/);
      if (m) printers.push({ id: m[1], name: m[1] });
    }
    return printers;
  } catch {
    // `lpstat` sale con código de error cuando no hay ninguna impresora
    // configurada ("No destinations added.") — no es una falla real del
    // agente, solo "cero impresoras USB en esta PC todavía".
    return [];
  }
}

async function listPrintersWindows() {
  try {
    // `-ExpandProperty Name`: una impresora por línea, sin encabezado ni ruido.
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-Command',
      'Get-Printer | Select-Object -ExpandProperty Name',
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

/** `[{id, name}]` — el `id` es el mismo nombre de cola/impresora que usa el sistema operativo (no hay un id separado en ningún lado). */
export async function listPrinters() {
  if (platform() === 'darwin' || platform() === 'linux') return listPrintersUnix();
  if (platform() === 'win32') return listPrintersWindows();
  return [];
}
