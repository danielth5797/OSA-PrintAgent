// RF-103 Fase 3 — diagnóstico local liviano (todavía sin la bandeja del
// sistema/página HTTP que proponía el plan original — esto es el primer
// escalón, útil desde ya por teléfono con soporte: "corré
// restrocloud-print-agent status y decime qué dice").

import { loadConfig, configPath } from './config.js';
import { agentFetch } from './apiClient.js';
import { listPrinters } from './printers.js';

export async function status() {
  const config = loadConfig();
  if (!config) {
    return { paired: false, message: `Sin parear todavía. No existe ${configPath()}.` };
  }
  const printers = await listPrinters();
  try {
    const agent = await agentFetch(config.serverUrl, config.apiKey, '/api/print-agents/me');
    return {
      paired: true,
      reachable: true,
      serverUrl: config.serverUrl,
      agentName: agent.name,
      agentId: agent.id,
      isActive: agent.isActive,
      lastSeenAt: agent.lastSeenAt,
      localPrinters: printers,
    };
  } catch (err) {
    return {
      paired: true,
      reachable: false,
      serverUrl: config.serverUrl,
      error: err.message,
      localPrinters: printers,
    };
  }
}
