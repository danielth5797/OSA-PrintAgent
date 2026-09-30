#!/usr/bin/env bash
# Empaqueta el agente como ejecutable único para macOS (Node SEA).
#
# Importante: el `node` de Homebrew NO sirve como base — su build no trae la
# marca ("fuse") que Node SEA necesita para ubicar dónde inyectar el blob
# (comprobado: ausente en el binario de Homebrew, presente en el oficial de
# nodejs.org). Por eso este script descarga el build oficial en vez de usar
# `command -v node`.
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_VERSION="$(node --version | sed 's/^v//')"
ARCH="$(uname -m)"
[ "$ARCH" = "x86_64" ] && ARCH="x64"
TARBALL="node-v${NODE_VERSION}-darwin-${ARCH}.tar.gz"
DEST_DIR="build/downloads/node-v${NODE_VERSION}-darwin-${ARCH}"

mkdir -p build/downloads
if [ ! -d "$DEST_DIR" ]; then
  echo "Descargando node v${NODE_VERSION} oficial (darwin-${ARCH})…"
  curl -sL -o "build/downloads/${TARBALL}" "https://nodejs.org/dist/v${NODE_VERSION}/${TARBALL}"
  tar -xzf "build/downloads/${TARBALL}" -C build/downloads
fi

node scripts/build-sea-blob.mjs

OUT="build/osa-print-agent-macos"
cp "${DEST_DIR}/bin/node" "$OUT"
chmod +w "$OUT"

# Vacía la firma de código existente del binario de `node` copiado — Node
# SEA lo exige antes de inyectar, si no `postject` la rompe silenciosamente.
codesign --remove-signature "$OUT" 2>/dev/null || true

npx postject "$OUT" NODE_SEA_BLOB build/sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --macho-segment-name NODE_SEA

# Firma ad-hoc (sin certificado de Apple Developer) — sin esto el binario no
# arranca en Apple Silicon. El instalador de macOS (.command) sigue siendo
# "no identificado" para Gatekeeper la primera vez — ver INSTALL.md.
codesign --sign - --force "$OUT"

echo "✓ Ejecutable macOS: $OUT"
"$OUT" 2>&1 | head -5 || true
