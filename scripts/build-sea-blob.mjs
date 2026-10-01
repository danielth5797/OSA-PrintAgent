// Empaquetado como ejecutable único (Node SEA — Single Executable
// Applications, nativo de Node 20+, sin dependencia de runtime nueva).
//
// Este agente es puro ESM con varios módulos (src/*.js) — SEA necesita un
// único archivo de entrada, así que primero lo empaquetamos con esbuild
// (solo herramienta de build, no viaja en el ejecutable final) a un único
// CommonJS, y de ahí generamos el blob de SEA. El blob en sí es igual para
// Windows y macOS — lo que cambia por plataforma es el binario de `node`
// real donde se inyecta (ver build-mac.sh / build-win.sh).
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const buildDir = join(root, 'build');
mkdirSync(buildDir, { recursive: true });

// Leído acá (en el script de build, con Node completo y acceso normal al
// disco) e inyectado como literal en el bundle vía `define` — el .exe final
// no lleva package.json consigo, así que `src/version.js` no puede leerlo en
// runtime una vez instalado.
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

await build({
  entryPoints: [join(root, 'bin/osa-print-agent.js')],
  bundle: true,
  platform: 'node',
  // CJS: el runtime de Node SEA de esta versión ejecuta el "main" embebido
  // como CommonJS sin importar su extensión/contenido real (confirmado en
  // vivo — un .mjs embebido revienta con "Cannot use import statement
  // outside a module"), así que hay que darle CJS de verdad.
  format: 'cjs',
  target: 'node20',
  outfile: join(buildDir, 'agent.bundle.cjs'),
  define: { __AGENT_VERSION__: JSON.stringify(pkg.version) },
  // Node SEA no resuelve imports dinámicos fuera del blob — todo tiene que
  // quedar en este único archivo.
});

const seaConfig = {
  main: join(buildDir, 'agent.bundle.cjs'),
  output: join(buildDir, 'sea-prep.blob'),
  disableExperimentalSEAWarning: true,
};
writeFileSync(join(buildDir, 'sea-config.json'), JSON.stringify(seaConfig, null, 2));

execFileSync(process.execPath, ['--experimental-sea-config', join(buildDir, 'sea-config.json')], {
  stdio: 'inherit',
});

console.log('✓ Blob de SEA generado en build/sea-prep.blob');
