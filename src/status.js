// RF-103 Fase 3 — diagnóstico local liviano (todavía sin la bandeja del
// sistema/página HTTP que proponía el plan original — esto es el primer
// escalón, útil desde ya por teléfono con soporte: "corré
// osa-print-agent status y decime qué dice").

import { loadConfig, configPath } from './config.js';
import { agentFetch } from './apiClient.js';
import { listPrinters } from './printers.js';
import { listSerialPorts } from './serial.js';
import { AGENT_VERSION } from './version.js';

export async function status() {
  const config = loadConfig();
  if (!config) {
    return { paired: false, version: AGENT_VERSION, message: `Sin parear todavía. No existe ${configPath()}.` };
  }
  const [printers, serialPorts] = await Promise.all([listPrinters(), listSerialPorts()]);
  try {
    const agent = await agentFetch(config.serverUrl, config.apiKey, '/api/print-agents/me');
    return {
      paired: true,
      version: AGENT_VERSION,
      reachable: true,
      serverUrl: config.serverUrl,
      agentName: agent.name,
      agentId: agent.id,
      isActive: agent.isActive,
      lastSeenAt: agent.lastSeenAt,
      localPrinters: printers,
      localSerialPorts: serialPorts,
    };
  } catch (err) {
    return {
      paired: true,
      version: AGENT_VERSION,
      reachable: false,
      serverUrl: config.serverUrl,
      error: err.message,
      localPrinters: printers,
      localSerialPorts: serialPorts,
    };
  }
}
