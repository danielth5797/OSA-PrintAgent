// RF-103 Fase 2 — envoltorio fetch mínimo hacia RestauCloud-API. Usa el
// `fetch` nativo de Node (18+), sin dependencias. Todas las respuestas del
// backend siguen el mismo sobre `{success, data, message}` que ya usa el
// resto de RestroCloud.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch(serverUrl, path, options = {}) {
  const res = await fetch(`${serverUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || !body?.success) {
    throw new ApiError(body?.message ?? `Error HTTP ${res.status}`, res.status);
  }
  return body.data;
}

export function agentFetch(serverUrl, apiKey, path, options = {}) {
  return apiFetch(serverUrl, path, { ...options, headers: { 'X-Agent-Key': apiKey, ...(options.headers ?? {}) } });
}
