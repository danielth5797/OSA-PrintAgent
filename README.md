# OSA Print Agent

Agente Local de impresión de OSA — el puente entre la nube y las
impresoras físicas de un restaurante (**RF-103 Fase 2**). Repo hermano de
`OSA-Web`/`OSA-API`, mismo patrón que `OSA-Platform`
(RF-94) fue un repo nuevo cuando hizo falta.

Ver el plan de arquitectura completo en
`OSA-Web/.claude/plans/impresion-por-estaciones.md`.

## Qué hace

Corre en una PC del restaurante siempre encendida (típicamente la misma caja
principal — "un agente por local", decisión del usuario). Cada pocos segundos
le pregunta a OSA si hay comandas esperando, las imprime (por red o
USB) y le avisa el resultado real. Nunca ve menú ni precios — solo recibe
bytes ESC/POS ya armados por el servidor y un destino.

Necesario quándo:
- Cualquier impresora **USB** (siempre, sea la sucursal on-premise o nube).
- Cualquier impresora de **red** en una sucursal desplegada **en la nube**
  (por defecto) — la API remota no puede alcanzar la LAN del restaurante.
- Cualquier **cajón de dinero USB standalone** (`deviceKind: CASH_DRAWER`,
  sin impresora de por medio — ver abajo).

**No** hace falta si la sucursal es on-premise (la API ya corre en su LAN) y
todas sus impresoras son de red — ahí el backend imprime directo.

## Cajón de dinero

Dos escenarios, ambos cubiertos:

- **Colgado de una impresora** (RJ11/RJ12, el caso más común): el pulso de
  apertura ESC/POS viaja por el mismo transporte que ya usa esa impresora
  (red o USB) — `printJob(station, payload)` es agnóstico al contenido, no
  necesita saber que es un cajón. **Cero cambios en este agente.**
- **Cajón USB standalone** (`deviceKind: 'CASH_DRAWER'` en el trabajo que
  reporta `GET /api/print-agents/jobs`): el agente le escribe directo al
  puerto serial (`src/serial.js`) en vez de mandarlo a una cola de
  impresión — macOS/Linux escriben al archivo de dispositivo (`fs.writeFile`
  al puerto, sin librería nueva); Windows usa
  `System.IO.Ports.SerialPort` vía PowerShell, mismo patrón `execFile`
  ya usado para `Get-Printer`. **Deliberadamente sin `serialport` (npm)** —
  mantiene la política de cero dependencias externas de este repo.

## Instalación

Ver **[`INSTALL.md`](./INSTALL.md)** — guía paso a paso completa (instalador
de un clic por plataforma, pareo, compartir la impresora en Windows si
aplica, arranque automático, verificación con `status`, solución de
problemas).

Para el restaurante, lo simple (RF-103 Fase 4 — no necesita Node instalado):

```bash
npm run build:dist   # arma dist/mac/ y dist/windows/OSA-Print-Agent-Setup.exe
```

Y después, un solo doble clic en la PC del restaurante — ver
"Instalación de un clic" en `INSTALL.md`.

Resumen rápido desde el código fuente (con Node instalado, para desarrollo):

```bash
npm install                                                          # sin dependencias externas reales
node bin/osa-print-agent.js pair --server <url> --code <código>
node bin/osa-print-agent.js run                              # queda corriendo, Ctrl+C para detener
node bin/osa-print-agent.js status                           # diagnóstico rápido, sin efectos secundarios
```

Plantillas de arranque automático por sistema operativo en `install/`
(`windows/iniciar-agente.bat`, `macos/com.osa.printagent.plist`,
`linux/osa-print-agent.service`) — instrucciones de cada una en
`INSTALL.md`.

## Pruebas

```bash
npm test    # node --test — sin dependencias nuevas, usa el runner nativo de Node
```

Cubre `printJob()` (el punto de entrada real que usa `run`) contra un
servidor TCP real (camino de red) y, en macOS/Linux con CUPS disponible,
contra una cola CUPS real efímera (camino USB) — ver el detalle de qué
prueba cada caso en "Estado real / qué falta" abajo. Se salta con gracia lo
que no aplica a la plataforma actual (ej. USB en un sistema sin CUPS) en vez
de fallar la suite entera.

## Estado real / qué falta (honesto, no maquillado)

- ✅ Pareo, sondeo de trabajos, reporte de resultado, latido con impresoras
  detectadas — protocolo completo, **verificado en vivo contra el backend
  real, con el agente corriendo como proceso aparte** (no solo `curl`
  simulando el protocolo) — pareo real, un pedido real generando comandas
  ruteadas por categoría, impresión intentada de verdad (red y USB) con
  fallas controladas reales, reporte y reintento confirmados.
- ✅ Impresión de red (socket TCP crudo) — camino de éxito real automatizado
  (`test/printEscPos.test.js`, un servidor TCP real en `127.0.0.1` recibe el
  payload y se confirma byte-por-byte idéntico) además de la falla
  controlada (puerto sin nadie escuchando).
- ✅ Impresión USB (macOS/Linux, CUPS `lp -d <cola> -o raw`) — **verificada de
  punta a punta contra el spooler real de CUPS**, no solo la falla
  controlada: una cola CUPS real y efímera (`lpadmin -p ... -v
  socket://127.0.0.1:<puerto>`) redirige lo que `lp -d <cola> -o raw`
  entrega a un servidor de mentira, confirmando el archivo temporal, el
  `execFile('lp', ...)` real y la entrega de bytes byte-por-byte idénticos
  — automatizado en `test/printEscPos.test.js` (se salta con gracia si el
  sistema no tiene CUPS/`lpadmin` disponible, ej. un CI sin ese paquete).
  Solo queda sin verificar el último tramo: **si una impresora térmica real
  interpreta/renderiza correctamente estos bytes** — eso sigue necesitando
  hardware real, nada de software puede confirmarlo por su cuenta.
- ✅ Impresión USB en **Windows** (`copy /b <archivo> \\localhost\<recurso
  compartido>`) — **primera verificación real en campo (2026-10-01)**, contra
  una impresora térmica XP-80C real conectada por USB. **Bug real encontrado
  y corregido**: `listPrintersWindows()` reportaba `Get-Printer`'s `Name`
  (el nombre visible de la impresora en Windows, ej. "Caja") como si fuera
  el id a usar para imprimir — pero `copy /b ... \\localhost\<id>` necesita
  el nombre del **recurso compartido** (`ShareName`, ej. "XP-80C"), que
  Windows deja configurar distinto al nombre de la impresora al compartirla
  y en este caso real eran dos valores distintos. El agente ofrecía "Caja"
  en el selector de OSA, que apuntaba a un recurso inexistente —
  Windows devuelve "no se encuentra el nombre de red especificado" (error
  67) aunque la impresora esté bien, porque el recurso con ESE nombre nunca
  existió. Corregido: `listPrintersWindows()` ahora filtra a solo impresoras
  realmente compartidas (`Where-Object Shared`) y usa `ShareName` como `id`
  (lo que de verdad hace falta para imprimir) mientras sigue mostrando
  `Name` como texto visible — tanto en `status` como en el selector de OSA
  (ver `OSA-Web`, `PrintingSection.tsx`), que ahora muestra el id real entre
  paréntesis cuando difiere del nombre, así se puede verificar desde el
  navegador sin entrar a la PC. El camino de red/firewall de Windows
  también se confirmó real en este mismo caso: aun con el recurso bien
  compartido y visible en `net share`, Windows puede seguir rechazando
  `\\localhost\<recurso>` si "Uso compartido de archivos e impresoras" está
  apagado a nivel de perfil de red o de firewall — documentado como paso
  explícito en `INSTALL.md`. **Confirmado de punta a punta (2026-10-01)**:
  con el agente actualizado reinstalado y la estación reapuntada al `id`
  correcto, una comanda real impresa desde OSA llegó e imprimió
  correctamente en la XP-80C a través del camino completo (OSA → agente →
  `copy /b` → impresora), no solo el `copy` manual aislado.
- ✅ Diagnóstico local (`status`) — pareo, última vez visto por el servidor,
  impresoras detectadas — verificado en vivo (con y sin conexión al
  servidor). Sin bandeja del sistema/página HTTP todavía — es el primer
  escalón hacia eso, no el reemplazo completo. **(2026-10-01)** gana número
  de versión (`osa-print-agent --version`, también al inicio de `status` y
  del log de `run` — antes no había forma de confirmar si una PC ya corría
  el build con un fix sin reinstalar y comparar a ciegas) y muestra el `id`
  real de cada impresora/puerto serial detectado, no solo su nombre — en
  Windows ambos pueden ser distintos (ver el hallazgo de arriba), y sin esto
  no había forma de diagnosticar esa diferencia sin leer el código.
- ✅ Plantillas de arranque automático por sistema operativo (`install/`) —
  Windows (carpeta de inicio), macOS (`launchd`), Linux (`systemd`, servicio
  de usuario). **No verificadas en vivo** (instalarlas de verdad requiere
  reiniciar sesión/la PC, fuera de lo que se pudo probar en esta sesión) —
  la sintaxis de cada plantilla es estándar y correcta, pero es la primera
  vez que se instalan de verdad.
- ✅ **RF-103 Fase 4 (2026-09-30) — empaquetado como ejecutable único +
  instaladores de un clic.** Node SEA (nativo de Node 20+, sin dependencia
  de runtime nueva — `esbuild`/`postject` son solo herramientas de build,
  no viajan en el ejecutable final): `scripts/build-sea-blob.mjs` bundlea
  `bin/osa-print-agent.js` a un único CJS y genera el blob; `build-mac.sh`
  lo inyecta sobre el `node` **oficial** de nodejs.org (⚠️ hallazgo real: el
  `node` de Homebrew no sirve de base, le falta el "fuse" de SEA que
  `postject` necesita para ubicar dónde inyectar — confirmado con `strings`
  contra ambos binarios) y lo firma ad-hoc; `build-win.sh` hace la misma
  inyección de forma **cruzada** desde macOS (postject edita directo las
  secciones de recursos del PE, no necesita ejecutar el binario). Dos
  instaladores: `installer/macos/Instalar Agente OSA.command` (diálogos
  nativos de AppleScript, copia el binario a
  `~/Library/Application Support/OSAPrintAgent/`, parea de verdad, escribe y
  carga un LaunchAgent real) e `installer/windows/installer.nsi` (NSIS,
  `RequestExecutionLevel user` — cero UAC, instala en
  `%LOCALAPPDATA%\OSAPrintAgent`, página propia con `nsDialogs` para pedir
  URL+código, acceso directo de inicio apuntando a un `.vbs` que lo corre
  oculto sin ventana de consola). `npm run build:dist` arma ambas carpetas
  de distribución. **Verificado en vivo de punta a punta el instalador de
  macOS**: pareo real contra el backend local (código de pareo real generado
  vía `POST /api/print-agents/pair`, canjeado por el binario empaquetado),
  LaunchAgent real cargado en `launchctl` y confirmado corriendo +
  reportando heartbeat real al servidor (`GET /api/print-agents/:id` con
  `lastSeenAt` actualizado), todo limpiado después (agente borrado de la
  BD, LaunchAgent descargado). El `.exe` de Windows **se compiló y se
  verificó como un PE32+ / instalador NSIS estructuralmente válido, pero
  nunca se corrió en una PC Windows real** — ni el `.exe` del agente en sí
  (mismo estado que el resto de USB/Windows de esta lista) ni el propio
  instalador. Sin firma de código real en ninguna de las dos plataformas —
  Gatekeeper/SmartScreen van a avisar la primera vez (documentado en
  `INSTALL.md`), hace falta un certificado pago para que eso desaparezca.
- ✅ Alerta de "estación sin conexión" en el Centro de Notificaciones de
  OSA (`PRINTER_STATION_OFFLINE`, barrido perezoso cada 10 min sin
  respuesta) — verificada en vivo con `curl` (disparo real + dedup contra
  lecturas repetidas) y con Playwright (campanita, ícono/color correctos,
  clic navega a `/sincronizacion?tab=printing` con la pestaña ya
  seleccionada) — cero errores de consola.
- ❌ Sin bandeja del sistema (system tray) real ni endurecimiento de
  reintento/backoff más allá del reintento simple ya existente — pendiente.
- ✅ Cajón de dinero (`src/serial.js`) — el escenario "colgado de una
  impresora" reusa el transporte ya verificado arriba, sin cambios. El
  escenario "cajón USB standalone" está **verificado de punta a punta contra
  un archivo de dispositivo real** en macOS/Linux (`test/serial.test.js`,
  entrega byte-por-byte idéntica) más, del lado de OSA-API, verificado en
  vivo con un socket TCP real (backend → agente → estación de red, comando
  `ESC p 00 19 FA` byte-exacto) y con un pago real en efectivo disparando
  ambos — cajón + tiquete de pago — automáticamente. **Sin cajón USB real ni
  PC Windows disponibles en esta sesión** — el camino Windows
  (`System.IO.Ports.SerialPort` vía PowerShell) queda sin ninguna
  verificación, mismo estado que el resto del USB de Windows arriba.
