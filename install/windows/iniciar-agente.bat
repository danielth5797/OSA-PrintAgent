@echo off
REM RF-103 Fase 3 — arranque automático en Windows.
REM
REM Copiá este archivo (editado con tu ruta real, ver abajo) a la carpeta de
REM inicio de Windows para que el agente arranque solo al iniciar sesión —
REM mismo espíritu que el modo kiosco de Chrome ya documentado para el
REM tiquete de pago (RF-102): el "usuario cotidiano" no debe acordarse de
REM abrirlo a mano cada mañana.
REM
REM Cómo instalarlo:
REM   1. Presioná Win+R, escribí "shell:startup" y Enter — se abre el
REM      Explorador en la carpeta de inicio de TU usuario.
REM   2. Copiá este archivo ahí.
REM   3. Abrilo con el Bloc de notas y cambiá la ruta de abajo por donde
REM      realmente instalaste RestroCloud-PrintAgent en esta PC.
REM
REM La ventana de consola queda abierta — es la forma más simple de ver que
REM está corriendo y su registro en vivo. Minimizala, no la cierres.

cd /d "C:\RestroCloud\RestroCloud-PrintAgent"
node bin\restrocloud-print-agent.js run
pause
