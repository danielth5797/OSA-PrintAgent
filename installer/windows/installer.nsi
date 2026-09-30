; Instalador de un clic del Agente Local de OSA para Windows.
; Compilado con NSIS (makensis) — cero admin/UAC (RequestExecutionLevel
; user): todo se instala en el perfil del usuario actual, mismo criterio que
; ~/.osa-print-agent/config.json (src/config.js, `os.homedir()`).
;
; Compilar (desde la raíz del repo, tras ./scripts/build-win.sh):
;   makensis installer/windows/installer.nsi
; Produce build/OSA-Print-Agent-Setup.exe
;
; SIN VERIFICAR EN UNA PC WINDOWS REAL — ver README.md/INSTALL.md. La
; sintaxis es NSIS estándar, pero nunca se corrió de punta a punta.

!include "MUI2.nsh"

Name "Agente Local de OSA"
OutFile "..\..\build\OSA-Print-Agent-Setup.exe"
InstallDir "$LOCALAPPDATA\OSAPrintAgent"
RequestExecutionLevel user
Unicode true

!define MUI_ABORTWARNING
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall.ico"

Var ServerURLField
Var PairCodeField
Var ServerURL
Var PairCode
Var PairError

; ------------------------------------------------------------------
; Página propia: pide URL del servidor + código de pareo (el mismo que
; genera "Vincular agente" en OSA-Web → Sincronización → Impresión).
; ------------------------------------------------------------------
Function PairingPageCreate
  !insertmacro MUI_HEADER_TEXT "Vincular con OSA" "Pegá los datos que te dio un administrador desde OSA-Web."
  nsDialogs::Create 1018
  Pop $0

  ${NSD_CreateLabel} 0 0 100% 24u "URL del servidor OSA (ej. https://tu-restaurante.osa.app):"
  Pop $0
  ${NSD_CreateText} 0 26u 100% 14u ""
  Pop $ServerURLField

  ${NSD_CreateLabel} 0 50u 100% 24u "Código de pareo (válido 15 minutos, se ve una sola vez en OSA-Web):"
  Pop $0
  ${NSD_CreateText} 0 76u 100% 14u ""
  Pop $PairCodeField

  nsDialogs::Show
FunctionEnd

Function PairingPageLeave
  ${NSD_GetText} $ServerURLField $ServerURL
  ${NSD_GetText} $PairCodeField $PairCode
  StrCmp $ServerURL "" 0 +3
    MessageBox MB_OK "Faltó la URL del servidor."
    Abort
  StrCmp $PairCode "" 0 +3
    MessageBox MB_OK "Faltó el código de pareo."
    Abort
FunctionEnd

!insertmacro MUI_PAGE_WELCOME
Page custom PairingPageCreate PairingPageLeave
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "Spanish"

Section "Instalar"
  SetOutPath "$INSTDIR"
  File "..\..\build\osa-print-agent-win.exe"
  Rename "$INSTDIR\osa-print-agent-win.exe" "$INSTDIR\osa-print-agent.exe"
  File "run-hidden.vbs"

  ; Pareo real contra el servidor, con lo que la persona tipeó en la página
  ; anterior. Si falla (código vencido, URL mal escrita, etc.) se avisa acá
  ; mismo en vez de dejar un agente "instalado" pero nunca pareado.
  nsExec::ExecToStack '"$INSTDIR\osa-print-agent.exe" pair --server "$ServerURL" --code "$PairCode"'
  Pop $0
  Pop $PairError
  StrCmp $0 "0" PairOk
    MessageBox MB_OK "No se pudo parear el agente:$\r$\n$\r$\n$PairError$\r$\n$\r$\nPodés reintentar corriendo, desde una consola:$\r$\n$INSTDIR\osa-print-agent.exe pair --server <url> --code <código>"
    Goto PairDone
  PairOk:
    ; Arranque automático al iniciar sesión (por usuario, sin admin) + lo
    ; arranca ya mismo, sin esperar al próximo login.
    SetShellVarContext current
    CreateShortCut "$SMSTARTUP\OSA Print Agent.lnk" "wscript.exe" '"$INSTDIR\run-hidden.vbs"'
    Exec 'wscript.exe "$INSTDIR\run-hidden.vbs"'
  PairDone:

  SetShellVarContext current
  CreateDirectory "$SMPROGRAMS\OSA Print Agent"
  CreateShortCut "$SMPROGRAMS\OSA Print Agent\Ver estado.lnk" "cmd.exe" '/k ""$INSTDIR\osa-print-agent.exe" status"'
  CreateShortCut "$SMPROGRAMS\OSA Print Agent\Desinstalar.lnk" "$INSTDIR\Uninstall.exe"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  nsExec::Exec 'taskkill /F /IM osa-print-agent.exe'
  Delete "$SMSTARTUP\OSA Print Agent.lnk"
  Delete "$SMPROGRAMS\OSA Print Agent\Ver estado.lnk"
  Delete "$SMPROGRAMS\OSA Print Agent\Desinstalar.lnk"
  RMDir "$SMPROGRAMS\OSA Print Agent"
  Delete "$INSTDIR\osa-print-agent.exe"
  Delete "$INSTDIR\run-hidden.vbs"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  MessageBox MB_YESNO "¿Borrar también el pareo guardado ($PROFILE\.osa-print-agent)? Si no, reinstalar en esta PC lo va a reconocer sin pedir un código nuevo." IDNO SkipConfigDelete
    RMDir /r "$PROFILE\.osa-print-agent"
  SkipConfigDelete:
SectionEnd
