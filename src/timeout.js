// Auditoría (2026-10-01): un trabajo USB/serial colgado (impresora pausada/sin
// papel/desconectada, el comando del sistema operativo — `lp`/`copy`/
// PowerShell — nunca vuelve) dejaba el `await` de `pollOnce` sin resolver para
// siempre, congelando TODO el ciclo de sondeo de ese agente — ni siquiera las
// demás estaciones del mismo agente volvían a intentarse, aunque el latido
// (otro timer, aparte) siguiera reportando "en línea" sin problema. El camino
// de red (`printEscPos.js`'s `printToNetwork`) ya tenía un timeout real desde
// el principio; este es el mismo mecanismo genérico para todo lo demás.

/** Rechaza con `message` si `promise` no se resuelve/rechaza en `ms` — nunca cancela de verdad el trabajo de fondo (no siempre es posible a este nivel), pero garantiza que el `await` que lo espera SIEMPRE termine. */
export function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
