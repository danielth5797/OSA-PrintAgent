// RF-103 Fase 2 — pareo. Se corre UNA vez por instalación: canjea el código
// de un solo uso que generó un admin desde RestroCloud (pestaña "Impresión"
// de Centro de Sincronización → "Vincular agente") por una API key durable,
// que se guarda localmente para siempre (hasta que se elimine el agente
// desde RestroCloud).

import { apiFetch } from './apiClient.js';
import { saveConfig, configPath } from './config.js';

export async function pair(serverUrl, pairingCode) {
  const result = await apiFetch(serverUrl, '/api/print-agents/activate', {
    method: 'POST',
    body: JSON.stringify({ pairingCode }),
  });
  saveConfig({ serverUrl, agentId: result.agentId, apiKey: result.apiKey });
  return { ...result, configPath: configPath() };
}
