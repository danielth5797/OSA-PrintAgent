' Arranca el Agente Local sin ventana de consola visible (RunAtStartup).
' Calcula su propia carpeta en vez de tener la ruta de instalación fija
' adentro — así sigue sirviendo si alguna vez cambia el directorio de
' instalación sin tener que regenerar este archivo.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & scriptDir & "\osa-print-agent.exe"" run", 0, False
