#!/usr/bin/env bash
# Arma las dos carpetas de distribución de un clic — todo lo que hay que
# mandarle al restaurante para instalar el Agente Local. Corre los
# empaquetados por plataforma (Node SEA) y, si `makensis` está disponible,
# compila el instalador de Windows con ellos.
set -euo pipefail
cd "$(dirname "$0")/.."

./scripts/build-mac.sh
./scripts/build-win.sh

if command -v makensis >/dev/null 2>&1; then
  makensis installer/windows/installer.nsi
else
  echo "⚠️  makensis no está instalado (brew install makensis) — se omite compilar el .exe de Windows."
fi

rm -rf dist
mkdir -p dist/mac dist/windows

cp build/osa-print-agent-macos "dist/mac/"
cp "installer/macos/Instalar Agente OSA.command" "dist/mac/"
chmod +x "dist/mac/Instalar Agente OSA.command" "dist/mac/osa-print-agent-macos"

if [ -f build/OSA-Print-Agent-Setup.exe ]; then
  cp build/OSA-Print-Agent-Setup.exe "dist/windows/"
fi

# Un solo .zip para Mac — el binario y el .command tienen que quedar juntos
# en la misma carpeta al extraer (así funciona el instalador), y un link de
# descarga solo puede servir un archivo a la vez. Finder descomprime un .zip
# con un doble clic solo, sin pedir ninguna herramienta nueva.
(cd dist/mac && zip -q -X -r "../OSA-Print-Agent-Mac.zip" "osa-print-agent-macos" "Instalar Agente OSA.command")

echo ""
echo "✓ Listo para distribuir:"
echo "  dist/OSA-Print-Agent-Mac.zip  → descomprimir, doble clic en \"Instalar Agente OSA.command\""
echo "  dist/windows/OSA-Print-Agent-Setup.exe → doble clic"
echo ""
echo "Para publicarlos como descarga desde OSA (GET /downloads/print-agent/...):"
echo "  mkdir -p ../OSA-API/print-agent-downloads"
echo "  cp dist/OSA-Print-Agent-Mac.zip ../OSA-API/print-agent-downloads/mac.zip"
echo "  cp dist/windows/OSA-Print-Agent-Setup.exe ../OSA-API/print-agent-downloads/windows.exe"
echo "  (después: cd ../OSA-API && docker compose up -d --build)"
