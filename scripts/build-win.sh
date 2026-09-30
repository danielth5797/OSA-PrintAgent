#!/usr/bin/env bash
# Empaqueta el agente como ejecutable único para Windows (Node SEA). `postject`
# edita directo las secciones de recursos del PE, así que esto SÍ se puede
# construir desde macOS/Linux cruzado — pero el resultado nunca se ejecuta acá,
# solo se confirma que la inyección terminó sin error. La primera corrida real
# en una PC Windows queda sin verificar (ver README.md/INSTALL.md).
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_VERSION="$(node --version | sed 's/^v//')"
TARBALL="node-v${NODE_VERSION}-win-x64.zip"
DEST_DIR="build/downloads/node-v${NODE_VERSION}-win-x64"

mkdir -p build/downloads
if [ ! -d "$DEST_DIR" ]; then
  echo "Descargando node v${NODE_VERSION} oficial (win-x64)…"
  curl -sL -o "build/downloads/${TARBALL}" "https://nodejs.org/dist/v${NODE_VERSION}/${TARBALL}"
  unzip -q -o "build/downloads/${TARBALL}" -d build/downloads
fi

node scripts/build-sea-blob.mjs

OUT="build/osa-print-agent-win.exe"
cp "${DEST_DIR}/node.exe" "$OUT"

npx postject "$OUT" NODE_SEA_BLOB build/sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

echo "✓ Ejecutable Windows: $OUT (sin firma de código — SmartScreen avisará 'Editor desconocido' hasta que se firme con un certificado real)"
