// RF-103 Fase 2 — configuración local del agente, guardada en
// ~/.restrocloud-print-agent/config.json. Solo tres campos: a qué servidor
// habla, y las credenciales que recibió UNA vez al parearse (POST
// /api/print-agents/activate). El agente nunca vuelve a pedir el código de
// pareo — una vez pareado, usa esta API key para siempre (hasta que un admin
// lo elimine desde RestroCloud).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.restrocloud-print-agent');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function configPath() {
  return CONFIG_PATH;
}
