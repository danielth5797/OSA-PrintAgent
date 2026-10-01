# Instalación del Agente Local de OSA

Guía paso a paso para instalar y dejar corriendo el Agente Local en la PC de
un restaurante — necesario para imprimir comandas en impresoras **USB**
(siempre) o de **red** cuando la sucursal está desplegada **en la nube**
(el modo por defecto). Ver `README.md` para el detalle de arquitectura y
`OSA-Web/.claude/plans/impresion-por-estaciones.md` para el plan
completo (RF-103).

**Un solo agente por local** — instalalo en UNA PC del restaurante que vaya a
quedar siempre encendida (suele ser la misma caja principal). Esa PC hace de
puente hacia todas las impresoras de ese local.

---

## Antes de empezar

- ¿Ya tenés una **estación de impresión** creada en OSA para esta
  sucursal? Si no, hacelo primero desde **Centro de Sincronización → pestaña
  "Impresión"** — el agente necesita algo a qué imprimir.
- Necesitás que un administrador de la sucursal (rol Administrador o Gerente)
  tenga la sesión abierta en OSA para generar el código de pareo.
- ⚠️ **Estado real de esta versión** (para no llevarte una sorpresa): la
  impresión de red y USB en macOS/Linux ya se probaron en vivo contra el
  protocolo real; la impresión USB en **Windows es código nuevo, sin
  verificar contra hardware real todavía** — si algo no funciona ahí, es
  esperable, avisá para ajustarlo. Ver `README.md` → "Estado real / qué
  falta" para el detalle completo.

---

## Instalación de un clic (recomendado)

Desde RF-103 Fase 4 hay un ejecutable único por sistema operativo — **no hace
falta instalar Node** en la PC del restaurante.

**Descarga directa desde OSA** (la forma normal): entrá a OSA-Web → Centro de
Sincronización → pestaña "Impresión" — junto a "Vincular agente" hay dos
links, "macOS" y "Windows", que bajan el instalador real
(`GET /downloads/print-agent/mac.zip` / `.../windows.exe` en la API). Sin
login especial — el link es público, el pareo real lo sigue exigiendo el
código de un solo uso.

Si esos links no están disponibles todavía en tu despliegue (nadie publicó
los binarios ahí, ver "Publicarlos como descarga" más abajo), alguien con
acceso a este repo los genera a mano (`npm run build:dist`) y te pasa el
`.zip`/`.exe` por otro medio.

### macOS

1. Descargá `OSA-Print-Agent-Mac.zip` y descomprimilo (doble clic en
   Finder) — tienen que quedar juntos los dos archivos que trae adentro:
   `osa-print-agent-macos` + `Instalar Agente OSA.command`.
2. Generá el código de pareo en OSA (Centro de Sincronización → "Impresión"
   → "Agentes locales" → "Vincular agente") — lo vas a necesitar en el
   siguiente paso.
3. Doble clic en **"Instalar Agente OSA.command"**.
   - Como todavía no hay certificado de Apple Developer, la primera vez
     Gatekeeper lo va a marcar como "de un desarrollador no identificado" —
     click derecho → **Abrir** (una sola vez; los siguientes dobles clics ya
     funcionan directo).
4. Pegá la URL del servidor y el código de pareo en los dos diálogos que
   aparecen.
5. Listo — queda pareado, corriendo, y arranca solo la próxima vez que
   inicies sesión (LaunchAgent real en `~/Library/LaunchAgents/`).

### Windows

1. Descargá `OSA-Print-Agent-Setup.exe` en la PC del restaurante.
2. Generá el código de pareo en OSA (mismo camino que arriba).
3. Doble clic en el instalador.
   - Sin certificado de firma de código, Windows SmartScreen probablemente
     avise "Se impidió que se iniciara una aplicación no reconocida" — **Más
     información → Ejecutar de todas formas**.
4. Pegá la URL del servidor y el código de pareo cuando el instalador los
   pida.
5. Listo — se instala en `%LOCALAPPDATA%\OSAPrintAgent` (sin pedir
   permisos de administrador), arranca ya mismo, y queda configurado para
   arrancar solo en cada inicio de sesión. El menú de inicio gana un grupo
   "OSA Print Agent" con accesos directos a "Ver estado" y "Desinstalar".

⚠️ **El instalador de Windows nunca se corrió en una PC Windows real** — se
generó y se verificó que compila a un `.exe` válido, pero todo el flujo de
instalación en sí (diálogo de texto, pareo, acceso directo de inicio) queda
sin probar en vivo hasta la primera instalación real. El de macOS sí se
verificó de punta a punta (pareo real contra el servidor + LaunchAgent real
cargado y confirmado desde OSA).

### Compilar los instaladores (para quien mantiene el repo)

```
npm install
npm run build:dist
```

Genera `dist/OSA-Print-Agent-Mac.zip` y
`dist/windows/OSA-Print-Agent-Setup.exe`. Necesita Node ≥20 instalado (para
generar el blob de Node SEA) y, para el `.exe` de Windows,
[NSIS](https://nsis.sourceforge.net/) (`brew install makensis` en macOS) —
sin `makensis` instalado, el script salta ese paso con un aviso en vez de
fallar. Ambos ejecutables se descargan del build oficial de nodejs.org (no
del `node` local) y quedan empaquetados con Node embebido adentro — la PC
destino no necesita tener Node instalado. Detalle técnico completo en
`scripts/`.

**Publicarlos como descarga desde OSA** (para que los links de "Impresión"
funcionen — ver `OSA-API/src/index.ts`, `GET /downloads/print-agent/...`,
sirve el directorio `OSA-API/print-agent-downloads/` fuera de git, montado
como volumen):

```
mkdir -p ../OSA-API/print-agent-downloads
cp dist/OSA-Print-Agent-Mac.zip ../OSA-API/print-agent-downloads/mac.zip
cp dist/windows/OSA-Print-Agent-Setup.exe ../OSA-API/print-agent-downloads/windows.exe
cd ../OSA-API && docker compose up -d --build
```

No hace falta reconstruir la imagen de la API solo por esto en despliegues
donde el volumen ya existe — con el contenedor corriendo, basta con
reemplazar los dos archivos en `print-agent-downloads/` para publicar una
versión nueva del agente.

---

## Instalación manual (alternativa — útil si vas a tocar el código del agente)

Si preferís correrlo desde el código fuente (con Node instalado en esa PC)
en vez del instalador de un clic:

## Paso 1 — Instalar Node.js en la PC del restaurante

El agente corre sobre Node.js (versión 18 o más nueva). Todavía no está
empaquetado como un instalador de un solo clic (queda pendiente, ver
`README.md`) — por ahora hace falta instalar Node una vez.

- **Windows**: descargá el instalador desde <https://nodejs.org> (botón
  grande, versión "LTS") y corré el `.msi` — Siguiente, Siguiente, Instalar.
- **macOS**: mismo instalador desde <https://nodejs.org>, o si ya usás
  Homebrew: `brew install node`.
- **Linux**: `sudo apt install nodejs npm` (Debian/Ubuntu) o el equivalente
  de tu distribución.

Para confirmar que quedó instalado, abrí una terminal (en Windows, "Símbolo
del sistema" o PowerShell) y corré:

```
node --version
```

Tiene que mostrar `v18` o más.

## Paso 2 — Copiar el Agente Local a esa PC

Copiá la carpeta completa `OSA-PrintAgent` a esa PC — por ejemplo a
`C:\OSA\OSA-PrintAgent` en Windows, o
`~/OSA-PrintAgent` en Mac/Linux. **Anotá esa ruta** — la vas a
necesitar en el Paso 6.

Abrí una terminal parada en esa carpeta e instalá (no hay nada real que
descargar, pero corré esto igual):

```
npm install
```

## Paso 3 — Generar el código de pareo (lo hace un administrador, desde OSA)

1. Entrá a OSA con una cuenta de Administrador o Gerente.
2. Andá a **Centro de Sincronización → pestaña "Impresión"**.
3. Elegí la sucursal correcta arriba.
4. En "Agentes locales" → **"Vincular agente"**.
5. Ponele un nombre reconocible (ej. "PC de la caja") → **"Generar código"**.
6. Copiá el código que aparece — **XXXX-XXXX-XXXX-XXXX**. Solo se muestra
   una vez y vale 15 minutos.

## Paso 4 — Parear el agente con ese código

De vuelta en la terminal de la PC del restaurante, parado en la carpeta del
agente:

```
node bin/osa-print-agent.js pair --server https://TU-OSA.APP --code XXXX-XXXX-XXXX-XXXX
```

(Si no le pasás `--server`/`--code`, te los pregunta uno por uno.)

Si salió bien vas a ver:

```
✓ Pareado como "...". Configuración guardada en ...
```

Esto se hace **una sola vez** por instalación — la clave real queda guardada
localmente, nunca hace falta volver a parear salvo que reinstales el agente
en otra PC.

## Paso 5 — Si vas a usar una impresora por USB: compartirla (Windows)

Salteá este paso si tus impresoras son todas de red (con IP propia), o si
estás en Mac/Linux (ahí no hace falta compartirla — el agente le habla
directo a la cola de CUPS).

En Windows, para que el agente pueda mandarle bytes crudos a una impresora
USB sin que el driver los "traduzca" mal, esa impresora tiene que estar
**compartida** con un nombre que vos elijas:

1. **Configuración → Bluetooth y dispositivos → Impresoras y escáneres**.
2. Elegí la impresora térmica → **Propiedades de la impresora**.
3. Pestaña **"Compartir"** → tildá **"Compartir esta impresora"** → ponele un
   nombre corto sin espacios (ej. `Cocina1`) → Aplicar.
4. En OSA, al crear/editar la estación USB, elegí la impresora del
   desplegable **"Impresora del agente"** — no hace falta escribir el nombre
   a mano ni que coincida con lo que ves en "Impresoras y escáneres": el
   agente reporta el nombre real del **recurso compartido** (`Cocina1` en
   el ejemplo) aunque la impresora se llame distinto en Windows (ej. "Caja")
   — si el id entre paréntesis difiere del nombre, es justamente ese el
   valor que usa para imprimir (`copy /b <archivo> \\localhost\<ese id>`).
   Caso real encontrado: una impresora llamada "Caja" en Windows compartida
   como "XP-80C" — elegir "Caja" a ciegas del nombre visible habría usado un
   recurso compartido que no existe.
5. Si Windows igual rechaza la impresión con "no se encuentra el nombre de
   red especificado" aunque el recurso ya aparezca bien en `net share`,
   revisá que **"Uso compartido de archivos e impresoras"** esté activado
   para el perfil de red actual — **Panel de control → Redes e Internet →
   Centro de redes y recursos compartidos → Cambiar configuración de uso
   compartido avanzado** — y que esté permitido en el Firewall de Windows
   (**Permitir una aplicación a través del firewall** → "Uso compartido de
   impresoras y archivos"). Es un interruptor aparte del checkbox de
   "Compartir esta impresora" del paso 3, y viene apagado por defecto si la
   red está marcada como "Pública".

## Paso 6 — Probar que imprime de verdad

Con el agente ya pareado, corré:

```
node bin/osa-print-agent.js run
```

Dejalo corriendo (vas a ver un registro tipo `[fecha] Agente Local de
OSA — conectado a ...` cada 5 segundos sondeando). Con esto
corriendo, desde OSA:

1. Andá a Centro de Sincronización → "Impresión".
2. Buscá la estación (o creala si todavía no existe, indicando este agente y
   la impresora del Paso 5 si es USB).
3. Tocá el botón de **"Probar impresión"** (ícono de refrescar) en esa
   tarjeta.

En la terminal del agente vas a ver `✓ impreso` o `✗ falló — <motivo real>`.
Si falló, el motivo que muestra ya te dice qué revisar (impresora apagada,
nombre de impresora compartida mal escrito, IP incorrecta, etc.).

Podés parar el agente con `Ctrl+C` mientras estás probando — cuando quede
todo bien, seguí al paso 7 para que arranque solo.

## Paso 7 — Dejarlo arrancando solo

El agente tiene que quedar corriendo siempre — sin depender de que alguien se
acuerde de abrirlo cada mañana. Elegí la guía de tu sistema operativo:

### Windows

La forma más simple, sin necesitar permisos de administrador:

1. Presioná **Win + R**, escribí `shell:startup` y Enter — se abre la
   carpeta de inicio de tu usuario.
2. Copiá ahí el archivo `install/windows/iniciar-agente.bat` de esta carpeta.
3. Abrilo con el Bloc de notas y cambiá la ruta `C:\OSA\...` de
   adentro por la ruta real donde copiaste el agente en el Paso 2.
4. Listo — la próxima vez que se inicie sesión en Windows, se abre una
   ventana con el agente corriendo. Minimizala (no la cierres).

### macOS

Usa `launchd` (el mecanismo nativo de macOS para "esto corre siempre"):

1. Abrí `install/macos/com.osa.printagent.plist` con un editor de
   texto y reemplazá las dos rutas marcadas con ⚠️ (la de `node`, que se
   averigua corriendo `which node` en una Terminal, y la de esta carpeta).
2. En una Terminal:
   ```
   cp install/macos/com.osa.printagent.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.osa.printagent.plist
   ```
3. El registro queda en `/tmp/osa-print-agent.log` (y
   `.err.log` para errores).

### Linux

Usa `systemd` (servicio de usuario):

1. Editá `install/linux/osa-print-agent.service` — reemplazá las dos
   rutas marcadas (la de `node`, `which node`, y la de esta carpeta).
2. ```
   mkdir -p ~/.config/systemd/user
   cp install/linux/osa-print-agent.service ~/.config/systemd/user/
   systemctl --user enable --now osa-print-agent
   loginctl enable-linger $USER
   ```
3. Ver el registro en vivo: `journalctl --user -u osa-print-agent -f`

## Paso 8 — Confirmar que quedó bien

En cualquier momento, para chequear el estado sin tener que leer el registro
completo:

```
node bin/osa-print-agent.js status
```

Te dice si está pareado, si el servidor lo sigue reconociendo, cuándo lo vio
por última vez, y qué impresoras detecta en esa PC ahora mismo — incluido el
`id` real de cada una (en Windows, el nombre del recurso compartido, que
puede ser distinto al nombre visible de la impresora) y la **versión del
agente instalada**, útil para confirmar que una PC ya tiene un fix
determinado sin tener que adivinar.

---

## Solución de problemas comunes

| Síntoma | Causa probable |
|---|---|
| `status` dice "No se pudo contactar al servidor" | Sin internet, o la URL del servidor está mal escrita en el pareo. |
| El agente corre pero las comandas nunca se imprimen | Revisá en OSA → Centro de Sincronización → Impresión que la estación tenga este agente asignado, y que tenga alguna categoría de menú asignada (si no, esa comanda nunca se generó). |
| USB en Windows: `El sistema no puede encontrar la ruta especificada` | El nombre de "Impresora del agente" en OSA no coincide EXACTO con el nombre que le pusiste al compartir la impresora en Windows (Paso 5). Desde la versión 0.2.0, el desplegable de OSA ya muestra el nombre del recurso compartido real — si viniste de una versión anterior, volvé a elegir la impresora del desplegable y guardá, aunque el texto se vea igual. |
| USB en Windows: `No se encuentra el nombre de red especificado` (con el recurso ya visible en `net share`) | "Uso compartido de archivos e impresoras" apagado para el perfil de red actual, o bloqueado en el Firewall de Windows — ver el paso 5 de arriba. Es distinto del síntoma anterior: acá Windows sí encuentra la PC, pero el recurso compartido no se publica hacia la red (ni siquiera el loopback) porque ese interruptor está apagado. |
| USB en Mac/Linux: `lp: No such destination` | La impresora no está agregada en el sistema — Preferencias del Sistema → Impresoras y escáneres, agregala primero ahí. |
| El código de pareo dice "inválido o vencido" | Duró más de 15 minutos, o ya se usó una vez — generá uno nuevo desde OSA. |
| Quiero reinstalar en otra PC | Simplemente repetí esta guía en la PC nueva con un código de pareo nuevo — desde OSA podés eliminar el agente viejo (Centro de Sincronización → Impresión → Agentes locales → ícono de basurero). |
| Quiero reinstalar en la MISMA PC para actualizar a una versión nueva | Desinstalá primero (menú Inicio → "OSA Print Agent" → Desinstalar — esto además para el proceso corriendo, necesario porque el instalador no sabe reemplazar un `.exe` en uso) y después volvé a instalar con un código de pareo nuevo — el instalador no detecta "ya instalado, solo actualizar", siempre vuelve a pedir pareo. |
