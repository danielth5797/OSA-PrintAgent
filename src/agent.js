// RF-103 Fase 2 — el bucle real del Agente Local:
//   1. Sondea trabajos pendientes cada POLL_INTERVAL_MS (mismo criterio
//      pragmático de polling ya usado en toda la app RestroCloud — Cocina
//      8s, campanita 20s — nada de WebSocket todavía).
//   2. Por cada trabajo: decodifica el payload ESC/POS (base64→bytes) e
//      intenta imprimirlo (red o USB, según la estación) — SIEMPRE reporta
//      el resultado real al servidor, éxito o error, nunca se lo guarda.
//   3. Cada HEARTBEAT_INTERVAL_MS (más espaciado — esto casi no cambia)
//      reporta qué impresoras ve instaladas, para llenar el selector de
//      RestroCloud.
//
// El agente es deliberadamente "tonto": nunca arma un documento, nunca ve
// menú/precios — solo recibe bytes ya listos + a dónde mandarlos.

import { agentFetch } from './apiClient.js';
import { printJob } from './printEscPos.js';
import { listPrinters } from './printers.js';

const POLL_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 60000;

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

async function pollOnce(serverUrl, apiKey) {
  const jobs = await agentFetch(serverUrl, apiKey, '/api/print-agents/jobs');
  if (jobs.length === 0) return 0;
  log(`${jobs.length} trabajo(s) pendiente(s)`);
  for (const job of jobs) {
    const payload = Buffer.from(job.payloadBase64, 'base64');
    try {
      await printJob(job.station, payload);
      log(`✓ impreso — estación "${job.station.name}"`);
      await agentFetch(serverUrl, apiKey, `/api/print-agents/jobs/${job.id}/result`, {
        method: 'POST',
        body: JSON.stringify({ status: 'PRINTED' }),
      });
    } catch (err) {
      log(`✗ falló — estación "${job.station.name}": ${err.message}`);
      await agentFetch(serverUrl, apiKey, `/api/print-agents/jobs/${job.id}/result`, {
        method: 'POST',
        body: JSON.stringify({ status: 'FAILED', error: err.message }),
      }).catch((e) => log('  (además falló reportar el resultado:', e.message, ')'));
    }
  }
  return jobs.length;
}

async function heartbeatOnce(serverUrl, apiKey) {
  const printers = await listPrinters();
  await agentFetch(serverUrl, apiKey, '/api/print-agents/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ printers }),
  });
  log(`latido enviado — ${printers.length} impresora(s) detectada(s) localmente`);
}

/** Corre para siempre (hasta Ctrl+C). `onTick` es un hook opcional para tests/verificación (recibe cuántos trabajos se procesaron en cada sondeo). */
export function runAgent({ serverUrl, apiKey }, { onTick, signal } = {}) {
  log(`Agente Local de RestroCloud — conectado a ${serverUrl}`);

  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  signal?.addEventListener('abort', stop);

  const pollLoop = async () => {
    while (!stopped) {
      try {
        const count = await pollOnce(serverUrl, apiKey);
        onTick?.(count);
      } catch (err) {
        log('Error sondeando trabajos:', err.message);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  };

  const heartbeatLoop = async () => {
    while (!stopped) {
      try {
        await heartbeatOnce(serverUrl, apiKey);
      } catch (err) {
        log('Error enviando latido:', err.message);
      }
      await new Promise((r) => setTimeout(r, HEARTBEAT_INTERVAL_MS));
    }
  };

  const done = Promise.all([pollLoop(), heartbeatLoop()]);
  return { stop, done };
}
