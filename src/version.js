// Número de versión del agente — reemplazado en tiempo de build por esbuild
// (`define: { __AGENT_VERSION__ }`, ver scripts/build-sea-blob.mjs) con la
// versión real de package.json en ese momento. El ejecutable empaquetado
// (Node SEA) es un único binario sin ningún archivo al lado, así que no hay
// forma de leer package.json en runtime una vez instalado en la PC del
// restaurante — por eso el reemplazo tiene que pasar en el build, no acá.
//
// `typeof __AGENT_VERSION__` nunca lanza aunque ese identificador no exista
// en ningún lado (es el comportamiento especial de `typeof` sobre
// identificadores no declarados) — así que corriendo desde el código fuente
// sin empaquetar (`npm run run/status/pair`) cae al fallback, útil para
// distinguir a simple vista una instalación real de una corrida de
// desarrollo.
export const AGENT_VERSION =
  typeof __AGENT_VERSION__ !== 'undefined' ? __AGENT_VERSION__ : 'dev (código fuente, sin empaquetar)';
