# Simulador de tráfico de San Gil — Diseño

**Fecha:** 2026-10-08
**Estado:** en revisión
**Entrega estimada:** finales de noviembre de 2026

## 1. Objetivo

Proyecto de una materia universitaria: un mapa de San Gil (Santander) que muestre
el flujo de tráfico de la forma más real posible y que permita **editar la red
vial para ver cómo funcionaría mejor, o peor, el tráfico con ciertos cambios.**

Ese es el criterio para aceptar o cortar cualquier función: si no sirve para
comparar "antes y después" de un cambio, no entra.

El lenguaje asignado es **JavaScript**. Existe una base en Python (`01_` a `04_`,
más el README) que orquesta el simulador externo SUMO. No se traduce línea a
línea: se reutiliza su conocimiento del dominio (puentes, Variante, flujos de
demanda, métricas, limitaciones) y se construye en JavaScript el motor, el mapa
y el editor que hoy pone SUMO o que no existen.

### Criterio de éxito

1. **Demo en clase (lo principal).** Una historia en vivo: San Gil en temporada
   alta y colapsado → se construye un puente nuevo y mejora → se termina la
   Variante y mejora más → se arreglan vías con huecos, los vehículos empiezan a
   usarlas y mejora aún más. También al revés: cerrar el Rojas Pinilla empeora
   todo.
2. **Sustentación.** Cada paso de la historia queda respaldado por números
   comparables y por modelos con nombre que se pueden citar.
3. **Entrega.** Corre en local con `npm install && npm run dev` y está publicado
   en Vercel con un link.

### Fuera de alcance

- Costos en pesos de las intervenciones.
- Calibración con aforos reales (se declara como limitación).
- Rutas fijas de busetas.
- Tráfico inducido por mejoras.
- Backend o base de datos.

## 2. Contexto del dominio

- **Río Fonce** como cuello de botella. Puentes vehiculares, con nombres
  confirmados por el usuario (2026-10-08; ids en `scripts/datos/puentes.js`):
  - **Rojas Pinilla** o "de la Hoja de Tabaco": principal, sobre la Avenida.
  - **Calle 15** (en OSM "La Sagrada Familia"): respaldo urbano en el centro.
  - **Carrera 1ª** (en OSM "Bernardo Gómez Silva"): al occidente.
  - **Bella Isla**: conecta el barrio Bella Isla.
  - **Salida a Mogotes** (Guasca).
  La base Python llamaba "Bernardo Gómez Silva" al de la Calle 15; según OSM
  ese nombre corresponde al de la Carrera 1ª.
- **Variante de San Gil**: inconclusa. Abscisado K0+000 a K9+500, puente sobre el
  Fonce entre K2+300 y K2+660 (ficha de Santander Competitivo). Se traza
  aproximada y se marca "en construcción".
- **San Gil no tiene semáforos.** Los cruces se controlan con pares (señal o
  pintura) y prioridad.
- **Tipos de vía reales:** centro mayormente de un sentido; algunos barrios de
  doble sentido; doble calzada frente al Terminal de Transporte; una glorieta;
  la Avenida (vía nacional) que atraviesa el municipio.
- **Dos terminales:** Terminal de Transporte (buses nacionales) y Terminalito
  (buses intermunicipales).
- **Alta participación de motos.**

### Datos de campo

OpenStreetMap casi nunca tiene superficie, estado, sentidos y pares en San Gil.
Se arranca con OSM más supuestos razonables. El usuario corrige en el editor y
guarda el resultado como el escenario "San Gil actual". Cuando tenga una lista
de vías reales (huecos, destapadas, sentidos, pares) se carga sobre esa base.

## 3. Arquitectura

```
 ┌──────────────── Una sola vez (script Node) ─────────────────┐
 │ OSM (Overpass) ──► limpieza ──► red-sangil.json (en el repo) │
 └──────────────────────────────────────────────────────────────┘
                              │
 ┌──────────── Navegador ─────▼─────────────────────────────────┐
 │  Interfaz (React)          ◄── mensajes ──►  Motor (Worker)  │
 │  ├ Mapa (MapLibre + deck.gl)                ├ Red (grafo)     │
 │  ├ Editor de vías y cruces                  ├ Vehículos IDM   │
 │  ├ Panel de tráfico                         ├ Cruces          │
 │  ├ Escenarios, comparador, historia         ├ Rutas Dijkstra  │
 │  └ Métricas y gráficas                      ├ Demanda         │
 │                                             └ Métricas        │
 └──────────────────────────────────────────────────────────────┘
```

| Pieza | Ubicación | Responsabilidad | Depende de |
|---|---|---|---|
| Preparación de la red | `scripts/construir-red.js` | Descarga San Gil de Overpass, construye el grafo propio y escribe `public/data/red-sangil.json` | Node |
| Motor | `src/sim/` | Avanza el tiempo, mueve vehículos, calcula métricas. JS puro, sin React ni APIs del navegador | Nada |
| Worker | `src/worker/` | Corre el motor en un hilo aparte y traduce mensajes con la interfaz | Motor |
| Escenarios | `src/escenarios/` | Precargados, guardar, cargar, importar y exportar | Formato de red |
| Interfaz | `src/ui/` | Mapa, editor, paneles, comparador, historia, "Cómo funciona" | Worker, escenarios |

**Stack:** Vite + React + MapLibre GL + deck.gl + una librería de gráficas
(Recharts). **JavaScript, no TypeScript.** Mapa base de mosaicos abiertos sin
llave de API.

**Sin servidor.** Todo es estático. La red procesada va dentro del repo, así que
la simulación no depende de internet; solo los mosaicos del mapa de fondo.

**Web Worker.** Función nativa del navegador para correr código en otro hilo. Es
un archivo `.js` del proyecto; no requiere instalar ni publicar nada aparte.

### Contrato motor ↔ interfaz

La interfaz envía órdenes y el worker responde con estado:

- **Órdenes:** `cargarEscenario`, `aplicarCambio` (vía, cruce, vía nueva,
  terminar obra, restricción de pesados), `configurarDemanda`, `reloj`
  (play, pausa, velocidad), `correrComparacion`.
- **Respuestas:** posiciones de vehículos en un arreglo plano (en cada cuadro),
  métricas agregadas (cada segundo simulado), resultados de comparación,
  avisos de validación.

## 4. Modelo de datos

### Vía

| Campo | Valores |
|---|---|
| `tipo` | `un_sentido`, `doble_sentido`, `doble_calzada`, `glorieta`, `avenida_nacional`, `variante` |
| `carrilesPorSentido` | entero ≥ 1 |
| `superficie` | `pavimento`, `adoquin`, `destapado` |
| `estado` | `bueno`, `regular`, `huecos` |
| `velocidadMax` | km/h |
| `abierta` | sí / no |
| `enConstruccion` | sí / no (la Variante empieza en sí) |
| `esPuente` | sí / no |
| `geometria` | lista de coordenadas |

**Doble calzada** solo se ofrece como intervención en la Avenida Nacional y la
Variante. La que ya existe frente al Terminal viene así desde el inicio.

### Cruce

`control`: `pare`, `prioridad`, `sin_senal` o `semaforo` (con tiempos de ciclo).
Ningún cruce empieza con semáforo; se agrega como intervención.

### Zonas de demanda

Centro, barrios, plaza de mercado, Terminal de Transporte, Terminalito y una
**salida por cada vía hacia otro municipio** (Bogotá, Bucaramanga, Charalá,
Mogotes, Barichara, Curití, Socorro, etc.).

### Escenario

Un archivo JSON con: los cambios sobre la red base (no la red completa),
la configuración de demanda, la hora del día, la restricción de pesados, la
semilla, el nombre y la descripción.

## 5. Motor de simulación

### Reloj

Paso fijo de 0,5 s simulados. Velocidades: pausa, real, ×5, ×20, máximo.
**Semilla fija**: la misma entrada produce la misma corrida.

### Tipos de vehículo

| Tipo | Comportamiento | Recorrido | Participación por defecto |
|---|---|---|---|
| Moto | Corta, acelera fuerte, acepta huecos pequeños, avanza en la cola | Local | Alta |
| Carro / taxi | Estándar | Local y de paso | Media |
| Buseta | Estándar, algo más larga y lenta que un carro | Local, sin rutas fijas | Media |
| Bus nacional | Grande y lento | Bogotá o Bucaramanga ↔ Terminal de Transporte, por la Avenida | Baja |
| Bus nacional de paso | Grande y lento | Bogotá ↔ Bucaramanga sin entrar al Terminal | Baja |
| Bus intermunicipal | Grande y lento | Terminalito ↔ cualquier salida a otro municipio | Baja |
| Camión / tractomula | Muy largo, acelera y frena lento | De paso por la Avenida | Baja |

Los porcentajes son editables. Los valores exactos de cada perfil (longitud,
aceleración, velocidad deseada, hueco mínimo) se fijan en el plan y se
documentan en "Cómo funciona".

### Seguimiento del vehículo de adelante — IDM

Intelligent Driver Model (Treiber, Hennecke y Helbing, 2000). Parámetros por
tipo: velocidad deseada, tiempo de seguridad, aceleración máxima, frenado cómodo
y distancia mínima.

### Efecto del estado de la vía

Multiplicadores sobre la velocidad deseada, con variación aleatoria por vehículo:

| Condición | Efecto |
|---|---|
| Bueno | Velocidad de la vía |
| Regular | Reducción moderada |
| Huecos | Reducción fuerte y más irregular |
| Destapado | Reducción fuerte |

Los valores exactos se documentan como supuestos en "Cómo funciona".

### Cambio de carril — MOBIL

Kesting, Treiber y Helbing (2007). Solo en vías de más de un carril por sentido.

### Cruces

- **Pare:** detención total, luego aceptación de hueco en la vía que cruza.
- **Prioridad:** la vía de mayor jerarquía pasa sin parar; la otra cede.
  Jerarquía: Avenida Nacional y Variante > doble calzada > doble sentido >
  un sentido.
- **Sin señal:** entre vías de igual jerarquía cede quien no viene por la
  derecha. La regla es configurable.
- **Glorieta:** cede quien entra; prioridad a quien circula.
- **Semáforo:** ciclo fijo editable.

**Bloqueos.** Si un vehículo lleva más de un umbral configurable detenido sin
poder avanzar, se registra un bloqueo y se libera (equivalente al *teleport* de
SUMO). Los bloqueos son una métrica de colapso.

### Rutas

Dijkstra con el tiempo de viaje **medido** en cada vía (promedio móvil), no
solo el teórico. Los vehículos recalculan su ruta cada cierto tiempo, así que
descubren de forma gradual las vías arregladas o nuevas.

**Restricción de pesados de paso.** Interruptor que se enciende automáticamente
al terminar la Variante. Con ella activa, tractomulas y buses nacionales de paso
solo pueden usar la Variante para atravesar el municipio. Los buses que van al
Terminal siguen entrando por la Avenida. Se puede apagar para comparar
"Variante sin restricción" contra "Variante con restricción".

### Demanda

Tres flujos, como en la base Python: local, de paso y pesado, más los flujos de
buses descritos arriba. Controles: cantidad total, porcentaje por tipo,
multiplicador de temporada (×1,0 normal, ×1,4 alta, editable) y perfil horario
con picos de mañana, mediodía y tarde.

### Métricas

- Viajes completados y viajes imposibles (sin ruta).
- Tiempo medio de viaje.
- Demora media: segundos perdidos frente a la vía libre.
- Demora total en vehículo-hora.
- Vehículos en la red y en cola.
- Bloqueos.
- Ranking de cuellos de botella por densidad y velocidad.
- Uso por vía (vehículos que pasan).

## 6. Interfaz y editor

**Pantalla principal:** mapa a pantalla casi completa; barra superior de tiempo;
panel izquierdo de herramientas; panel derecho de métricas en vivo.

**Capas del mapa:**

- Vehículos con color por tipo.
- Vías coloreadas por congestión (verde, amarillo, rojo, vino tinto si está
  bloqueada), con alternativa por estado o por tipo de vía.
- Flechas de sentido; símbolos de pare y semáforo.
- Puentes resaltados.
- Variante punteada mientras esté en construcción.
- Mapa de calor de demoras (opcional).

**Editor:**

- **Vía:** sentido, abrir o cerrar, estado, superficie, velocidad máxima,
  carriles. En Avenida y Variante, convertir a doble calzada.
- **Cruce:** pare, prioridad, sin señal o semáforo con tiempos.
- **Nueva vía o puente:** se dibuja punto a punto, se elige el tipo y se conecta
  a los cruces cercanos. Si cruza el río queda como puente.
- **Terminar obra:** botón para la Variante y cualquier vía en construcción.
- **Deshacer y rehacer.**

**Panel de tráfico:** demanda total, porcentajes por tipo, temporada, hora y
restricción de pesados.

**Métricas en vivo:** tiempo de viaje, demora, vehículos, bloqueos y top 5 de
cuellos de botella; un clic lleva el mapa a esa vía.

**Inspección:** clic en un vehículo muestra tipo, ruta, velocidad y tiempo
esperando.

## 7. Escenarios, comparador e historia

### Escenarios precargados

| Escenario | Contenido |
|---|---|
| San Gil actual | Red de hoy con correcciones de campo |
| Temporada alta | Demanda ×1,4 |
| Obra en el Rojas Pinilla | Puente cerrado o a un carril |
| Variante terminada | Con y sin restricción de pesados |

Se crean más con "Guardar como…". Se guardan en el navegador y se exportan o
importan como `.json`.

### Comparador

Corre dos o más escenarios en **modo rápido** (sin dibujar), la misma hora
simulada, **varias semillas** por escenario. Muestra:

- Tabla lado a lado con promedio y rango de cada métrica y el **% de mejora o
  empeoramiento** frente al escenario de referencia.
- Gráficas de demora y de vehículos en la red a lo largo de la hora, y uso de
  vías clave (puentes, carrera 1ª, Variante).
- Mapa de diferencias: vías en verde donde mejoró y en rojo donde empeoró.

### Modo historia

Secuencia de pasos con título y nota. Se avanza con botón o flecha del teclado.
Cada paso aplica sus cambios **en vivo** sobre la simulación en curso. Una
gráfica acumulada en la esquina muestra la demora de cada paso.

Historia precargada:

1. San Gil actual, día normal.
2. Temporada alta: colapso.
3. \+ Puente nuevo.
4. \+ Variante terminada con restricción de pesados.
5. \+ Arreglo de vías con huecos.

Se pueden armar otras, incluida una de lo que empeora el tráfico.

### Pestaña "Cómo funciona"

Para la sustentación: los modelos (IDM, MOBIL, aceptación de huecos, Dijkstra)
con fórmulas y referencias, los supuestos con su origen y las limitaciones. En
particular: el modelo no está calibrado con aforos, así que sirve para comparar
escenarios entre sí y no para predecir tiempos absolutos.

## 8. Manejo de errores

- Un cambio que deja zonas sin salida o una vía nueva sin conexión: aviso con
  las zonas afectadas **antes** de aplicarlo.
- Viajes sin ruta posible: se cuentan como "viajes imposibles".
- Escenario importado inválido: mensaje claro, sin alterar el estado actual.
- Almacenamiento del navegador lleno o bloqueado: aviso y sugerencia de exportar.

## 9. Estructura del proyecto

```
MapaSangil/
├── CLAUDE.md                   contexto que carga cada sesión
├── .claude/contexto/
│   ├── estado.md               etapa actual, qué sigue, bloqueos
│   ├── bitacora.md             registro corto por sesión
│   └── decisiones.md           decisiones y su porqué
├── python-original/            base en Python, intacta, como referencia
├── scripts/construir-red.js
├── public/data/red-sangil.json
├── src/
│   ├── sim/                    red, vehiculos, idm, mobil, cruces, rutas,
│   │                           demanda, metricas, motor
│   ├── worker/
│   ├── escenarios/
│   └── ui/
├── tests/
└── docs/superpowers/specs/
```

`CLAUDE.md` importa `estado.md` y `decisiones.md` para que cada sesión arranque
sabiendo dónde va el proyecto. Al cerrar cada sesión se actualizan `estado.md`
y `bitacora.md`.

## 10. Pruebas

Vitest sobre el motor:

- **Física:** un vehículo solo alcanza su velocidad deseada; dos vehículos
  nunca se atraviesan; una vía con huecos es más lenta.
- **Cruces:** en un pare el vehículo se detiene del todo; la vía con prioridad
  no frena.
- **Rutas:** una vía cerrada no se usa; arreglar una vía aumenta su uso.
- **Escenarios de control:** cerrar el Rojas Pinilla empeora la demora;
  terminar la Variante con restricción la mejora.

La interfaz se verifica a mano en el navegador al cierre de cada etapa.

## 11. Etapas

| # | Fechas | Entregable | Se puede mostrar |
|---|---|---|---|
| 1 | 8 – 17 oct | Proyecto, git, contexto `.claude`, red de San Gil en el mapa | Mapa real con vías por tipo |
| 2 | 18 – 31 oct | Motor: vehículos, IDM, cruces, rutas, demanda | Tráfico moviéndose en San Gil |
| 3 | 1 – 9 nov | Editor completo, Variante, vías nuevas | Cerrar un puente y ver la cola |
| 4 | 10 – 16 nov | Escenarios, comparador, modo historia | La demo completa |
| 5 | 17 – 22 nov | "Cómo funciona", ajustes, publicación en Vercel | Link público y sustentación lista |

Semana de colchón hasta finales de noviembre. El mayor riesgo son los cruces
(etapa 2).

## 12. Entrega

- Repositorio git subido a GitHub.
- Vercel publica desde GitHub.
- Local: `npm install && npm run dev`.

## 13. Limitaciones declaradas

Heredadas de la base Python y visibles en "Cómo funciona":

- Sin calibración con aforos: sirve para comparar escenarios entre sí.
- OSM incompleto en sentidos, pares y estado de vías; se corrige con
  conocimiento de campo.
- Trazado de la Variante aproximado.
- Sin tráfico inducido.
