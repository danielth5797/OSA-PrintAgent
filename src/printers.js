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
    // Bug real encontrado en campo (2026-10-01): el nombre de la impresora en
    // Windows (`Name`, ej. "Caja") NO es el mismo valor que hace falta para
    // `copy /b archivo \\localhost\<nombre>` en printEscPos.js — ese comando
    // necesita el nombre del RECURSO COMPARTIDO (`ShareName`, ej. "XP-80C"),
    // que Windows suele autogenerar distinto al nombre de la impresora al
    // compartirla. Reportar `Name` como si fuera el id llevaba a elegir una
    // impresora "válida" en OSA que en realidad apuntaba a un recurso
    // compartido inexistente (`\\localhost\Caja`) — Windows devuelve
    // "no se encuentra el nombre de red especificado" (error 67) aunque la
    // impresora exista y esté bien, porque el recurso con ESE nombre nunca
    // existió. Filtramos a solo las compartidas (`Shared`) porque una
    // impresora no compartida no puede funcionar por este camino de todos
    // modos — mejor no ofrecerla que dejar elegir algo que va a fallar igual.
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-Command',
      'Get-Printer | Where-Object { $_.Shared } | Select-Object Name, ShareName | ConvertTo-Json -Compress',
    ]);
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed);
    // `ConvertTo-Json` devuelve un objeto solo (no un arreglo) cuando hay una única impresora compartida.
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows
      .filter((r) => r && r.ShareName)
      .map((r) => ({ id: r.ShareName, name: r.Name }));
  } catch {
    return [];
  }
}

/**
 * `[{id, name}]` — en macOS/Linux, `id` es el mismo nombre de cola de CUPS
 * que `name`. En Windows, `id` es el nombre del RECURSO COMPARTIDO (lo que
 * de verdad usa `\\localhost\<id>` al imprimir) mientras que `name` es el
 * nombre visible de la impresora en Windows — pueden ser distintos a
 * propósito, ver el comentario real arriba.
 */
export async function listPrinters() {
  if (platform() === 'darwin' || platform() === 'linux') return listPrintersUnix();
  if (platform() === 'win32') return listPrintersWindows();
  return [];
}
