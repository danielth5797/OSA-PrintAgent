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

**No** hace falta si la sucursal es on-premise (la API ya corre en su LAN) y
todas sus impresoras son de red — ahí el backend imprime directo.

## Instalación

Ver **[`INSTALL.md`](./INSTALL.md)** — guía paso a paso completa (Node,
pareo, compartir la impresora en Windows si aplica, arranque automático por
sistema operativo, verificación con `status`, solución de problemas).

Resumen rápido para quien ya sabe lo que hace:

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
- ⚠️ Impresión USB en **Windows** (`copy /b <archivo> \\localhost\<impresora
  compartida>`) y descubrimiento de impresoras (`Get-Printer` de
  PowerShell) — código nuevo de Fase 3, **sin ninguna verificación**, ni
  siquiera de la falla controlada — no hubo PC Windows disponible en esta
  sesión. Es la técnica estándar que usa la mayoría del software de punto de
  venta en Windows, pero es lo primero a probar con una máquina real.
- ✅ Diagnóstico local (`status`) — pareo, última vez visto por el servidor,
  impresoras detectadas — verificado en vivo (con y sin conexión al
  servidor). Sin bandeja del sistema/página HTTP todavía — es el primer
  escalón hacia eso, no el reemplazo completo.
- ✅ Plantillas de arranque automático por sistema operativo (`install/`) —
  Windows (carpeta de inicio), macOS (`launchd`), Linux (`systemd`, servicio
  de usuario). **No verificadas en vivo** (instalarlas de verdad requiere
  reiniciar sesión/la PC, fuera de lo que se pudo probar en esta sesión) —
  la sintaxis de cada plantilla es estándar y correcta, pero es la primera
  vez que se instalan de verdad.
- ❌ Sin empaquetar como ejecutable único (`pkg`/Node SEA) — hoy se corre
  desde el código fuente con Node instalado. Sigue pendiente.
- ✅ Alerta de "estación sin conexión" en el Centro de Notificaciones de
  OSA (`PRINTER_STATION_OFFLINE`, barrido perezoso cada 10 min sin
  respuesta) — verificada en vivo con `curl` (disparo real + dedup contra
  lecturas repetidas) y con Playwright (campanita, ícono/color correctos,
  clic navega a `/sincronizacion?tab=printing` con la pestaña ya
  seleccionada) — cero errores de consola.
- ❌ Sin bandeja del sistema (system tray) real ni endurecimiento de
  reintento/backoff más allá del reintento simple ya existente — pendiente.
