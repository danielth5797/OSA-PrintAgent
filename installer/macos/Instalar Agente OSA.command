#!/usr/bin/env bash
# Instalador de un clic del Agente Local de OSA para macOS.
#
# Se distribuye junto al ejecutable `osa-print-agent-macos` (mismo directorio
# — ver README.md/INSTALL.md) y se abre con doble clic desde Finder. Pide la
# URL del servidor y el código de pareo con diálogos nativos (AppleScript,
# sin dependencia nueva), copia el binario a
# ~/Library/Application Support/OSAPrintAgent/, parea de verdad, y deja un
# LaunchAgent real corriendo (arranque automático al iniciar sesión).
#
# La primera vez, Gatekeeper puede marcarlo "de un desarrollador no
# identificado" (no hay certificado de Apple Developer todavía) — hay que
# hacer clic derecho → Abrir la primera vez, en vez de doble clic normal.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_BIN="${SCRIPT_DIR}/osa-print-agent-macos"
APP_SUPPORT="${HOME}/Library/Application Support/OSAPrintAgent"
DEST_BIN="${APP_SUPPORT}/osa-print-agent"
PLIST_PATH="${HOME}/Library/LaunchAgents/com.osa.printagent.plist"
LOG_DIR="${APP_SUPPORT}/logs"

ask() {
  # $1 = pregunta, $2 = texto por defecto
  osascript -e "text returned of (display dialog \"$1\" default answer \"$2\" with title \"Agente Local de OSA\" buttons {\"Cancelar\", \"Continuar\"} default button \"Continuar\" cancel button \"Cancelar\")" 2>/dev/null
}

if [ ! -x "$SRC_BIN" ]; then
  osascript -e 'display alert "No se encontró osa-print-agent-macos" message "Tiene que estar en la misma carpeta que este instalador." as critical'
  exit 1
fi

SERVER_URL="$(ask "URL del servidor OSA (ej. https://tu-restaurante.osa.app):" "")"
[ -z "$SERVER_URL" ] && { echo "Cancelado."; exit 1; }

PAIR_CODE="$(ask "Código de pareo (te lo dio un administrador desde OSA-Web → Sincronización → Impresión, vale 15 minutos):" "")"
[ -z "$PAIR_CODE" ] && { echo "Cancelado."; exit 1; }

echo "Instalando en ${APP_SUPPORT}…"
mkdir -p "$APP_SUPPORT" "$LOG_DIR"
cp "$SRC_BIN" "$DEST_BIN"
chmod +x "$DEST_BIN"

echo "Pareando…"
if ! PAIR_OUTPUT="$("$DEST_BIN" pair --server "$SERVER_URL" --code "$PAIR_CODE" 2>&1)"; then
  osascript -e "display alert \"No se pudo parear\" message \"$(echo "$PAIR_OUTPUT" | tail -1 | sed 's/"/\\\\"/g')\" as critical"
  exit 1
fi
echo "$PAIR_OUTPUT"

echo "Configurando arranque automático…"
mkdir -p "${HOME}/Library/LaunchAgents"
cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.osa.printagent</string>
    <key>ProgramArguments</key>
    <array>
      <string>${DEST_BIN}</string>
      <string>run</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/agent.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/agent.err.log</string>
  </dict>
</plist>
PLIST

launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl load "$PLIST_PATH"

osascript -e 'display notification "El Agente Local ya está pareado y corriendo." with title "Agente Local de OSA" subtitle "Instalación completa"'
echo ""
echo "✓ Listo. El agente queda corriendo en segundo plano y arranca solo cada vez que iniciás sesión."
echo "  Diagnóstico: \"${DEST_BIN}\" status"
echo "  Registro: ${LOG_DIR}/agent.log"
echo ""
read -p "Presioná Enter para cerrar esta ventana…"
