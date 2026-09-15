#!/usr/bin/env node
// RF-103 Fases 2-3 — CLI del Agente Local de RestroCloud. Sin dependencias
// externas a propósito (nada que instalar aparte de Node) — tres comandos:
//
//   restrocloud-print-agent pair --server https://tu-restrocloud.app --code XXXX-XXXX-XXXX-XXXX
//   restrocloud-print-agent run
//   restrocloud-print-agent status
//
// `pair` se corre una sola vez por instalación. `run` es el proceso que debe
// quedar corriendo siempre — ver `install/<sistema-operativo>/` para
// arrancarlo solo (Windows/macOS/Linux) y `INSTALL.md` para el instructivo
// completo. `status` es un diagnóstico local rápido, sin efectos
// secundarios — útil por teléfono con soporte.

import { createInterface } from 'node:readline/promises';
import { loadConfig } from '../src/config.js';
import { pair } from '../src/pair.js';
import { runAgent } from '../src/agent.js';
import { status } from '../src/status.js';

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function cmdPair() {
  const serverUrl = arg('--server') ?? (await prompt('URL del servidor RestroCloud (ej. https://miempresa.restrocloud.app): '));
  const code = arg('--code') ?? (await prompt('Código de pareo (te lo dio un administrador): '));
  console.log('Pareando…');
  try {
    const result = await pair(serverUrl.replace(/\/$/, ''), code);
    console.log(`✓ Pareado como "${result.agentId}". Configuración guardada en ${result.configPath}`);
    console.log('Ahora corré: restrocloud-print-agent run');
  } catch (err) {
    console.error('✗ No se pudo parear:', err.message);
    process.exitCode = 1;
  }
}

function cmdRun() {
  const config = loadConfig();
  if (!config) {
    console.error('Este agente todavía no está pareado. Corré primero: restrocloud-print-agent pair');
    process.exitCode = 1;
    return;
  }
  const controller = new AbortController();
  process.on('SIGINT', () => {
    console.log('\nCerrando…');
    controller.abort();
  });
  runAgent(config, { signal: controller.signal });
}

async function cmdStatus() {
  const result = await status();
  if (!result.paired) {
    console.log(`✗ ${result.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Servidor: ${result.serverUrl}`);
  if (result.reachable) {
    console.log(`✓ Pareado como "${result.agentName}" (${result.agentId})`);
    console.log(`  Activo: ${result.isActive ? 'sí' : 'NO — un admin lo desactivó desde RestroCloud'}`);
    console.log(`  Última vez visto por el servidor: ${result.lastSeenAt ?? 'nunca'}`);
  } else {
    console.log(`✗ No se pudo contactar al servidor: ${result.error}`);
  }
  console.log(`Impresoras detectadas en esta PC: ${result.localPrinters.length}`);
  for (const p of result.localPrinters) console.log(`  - ${p.name}`);
}

const command = process.argv[2];
if (command === 'pair') {
  await cmdPair();
} else if (command === 'run') {
  cmdRun();
} else if (command === 'status') {
  await cmdStatus();
} else {
  console.log('Uso:');
  console.log('  restrocloud-print-agent pair --server <url> --code <código>');
  console.log('  restrocloud-print-agent run');
  console.log('  restrocloud-print-agent status');
}
