# Etapa 1 · Red de San Gil en el mapa — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el proyecto JavaScript armado, con el contexto `.claude` para las sesiones, y la red vial real de San Gil (descargada de OSM y convertida a un grafo propio) dibujada en el mapa por tipo de vía, con fichas de solo lectura.

**Architecture:** Un script Node (`npm run red`) descarga San Gil desde Overpass una sola vez y escribe `public/data/red-sangil.json`. El módulo `src/sim/red.js` (JavaScript puro, sin React ni navegador) valida ese archivo y lo convierte en un grafo con arcos dirigidos. La interfaz React lo carga y lo dibuja con deck.gl sobre MapLibre.

**Tech Stack:** Node 24, Vite 5, React 18, MapLibre GL 4, react-map-gl 7, deck.gl 9.0, Vitest 2. JavaScript, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-08-simulador-trafico-sangil-design.md`

Esta es la primera de cinco etapas del spec (sección 11). Las etapas 2 a 5 tendrán su propio plan, escrito al cerrar la anterior.

## Global Constraints

- JavaScript, **no TypeScript**. Archivos `.js` y `.jsx`.
- `src/sim/` no importa React, ni `window`, ni `document`, ni nada del navegador.
- Sin servidor ni backend: todo estático. Corre con `npm install && npm run dev`.
- La red procesada (`public/data/red-sangil.json`) va dentro del repositorio.
- Ningún cruce empieza con control `semaforo`: San Gil no tiene semáforos.
- Sin costos en pesos en ninguna parte.
- Doble calzada como intervención solo para Avenida Nacional y Variante (aplica desde la etapa 3).
- Textos de la interfaz en español de Colombia.
- Atribución visible: "© colaboradores de OpenStreetMap (ODbL)".
- Mapa base sin llave de API (OpenFreeMap).

## Review Focus

1. Vías con `oneway=-1` en OSM: la geometría se invierte para que el sentido quede de `desde` a `hasta` (test en Task 3).
2. Vías que referencian nodos que Overpass no devolvió: se omiten esos nodos sin romper la conversión (test en Task 3).
3. Glorietas como vía cerrada (primer nodo = último): se cortan en sus cruces y nunca queda una vía de un nodo a sí mismo (test en Task 3).
4. Etiquetas `maxspeed` raras ("30 mph", "none", "signals"): se interpretan o se ignoran sin dar `NaN` (test en Task 2).
5. Archivo de red ausente: en `npm run dev` Vite responde `index.html` con HTTP 200, así que la carga debe fallar con un mensaje que diga "npm run red", no con una pantalla en blanco (test en Task 5).

---

## Formato de la red (contrato de esta etapa)

`public/data/red-sangil.json`:

```json
{
  "version": 1,
  "generado": "2026-10-10T15:00:00.000Z",
  "fuente": "© colaboradores de OpenStreetMap (ODbL)",
  "bbox": { "sur": 6.525, "oeste": -73.16, "norte": 6.585, "este": -73.105 },
  "nodos": [
    { "id": "n123", "lon": -73.136, "lat": 6.555, "control": "sin_senal" }
  ],
  "vias": [
    {
      "id": "v456_0", "osmId": 456, "nombre": "Calle 12",
      "desde": "n123", "hasta": "n124",
      "geometria": [[-73.136, 6.555], [-73.135, 6.555]],
      "longitud": 110.5,
      "tipo": "un_sentido", "sentido": "adelante",
      "carrilesPorSentido": 1, "superficie": "pavimento", "estado": "bueno",
      "velocidadMax": 30, "abierta": true, "enConstruccion": false, "esPuente": false
    }
  ]
}
```

- `sentido`: `adelante` (solo de `desde` a `hasta`) o `ambos`. Se agrega al modelo del spec porque la Avenida, la Variante y las dobles calzadas también pueden ser de un sentido por calzada.
- `control`: `pare`, `prioridad`, `sin_senal` o `semaforo`.
- `geometria`: pares `[lon, lat]`.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json`, `vite.config.js`, `index.html`, `.gitignore` | Proyecto Vite + Vitest |
| `CLAUDE.md`, `.claude/contexto/*.md` | Contexto que carga cada sesión |
| `README.md` | Cómo correr el proyecto |
| `python-original/` | Base Python intacta |
| `src/sim/tipos.js` | Constantes de dominio: tipos, jerarquía, etiquetas |
| `src/sim/geo.js` | Distancias y geometría sobre `[lon, lat]` |
| `src/sim/red.js` | Validar la red y construir el grafo dirigido |
| `scripts/lib/clasificarVia.js` | Etiquetas OSM → atributos de vía |
| `scripts/lib/osmARed.js` | Respuesta Overpass → nodos y vías |
| `scripts/construir-red.js` | Descarga, convierte, escribe el JSON, imprime inventario |
| `src/ui/datos/cargarRed.js` | Cargar el JSON en el navegador con errores legibles |
| `src/ui/mapa/estilosVia.js` | Colores, anchos y flechas de sentido |
| `src/ui/mapa/MapaSanGil.jsx` | Mapa con capas deck.gl |
| `src/ui/paneles/Leyenda.jsx`, `FichaVia.jsx` | Leyenda y ficha de la vía |
| `src/ui/App.jsx`, `src/ui/estilos.css`, `src/main.jsx` | Shell de la app |

---

### Task 1: Proyecto armado y contexto de sesiones

**Files:**
- Move: `01_download_network.py`, `02_demand.py`, `03_scenarios.py`, `04_analyze.py`, `README.md`, `requirements.txt` → `python-original/`
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `src/main.jsx`, `src/ui/App.jsx`, `src/sim/tipos.js`, `tests/sim/tipos.test.js`, `README.md`, `CLAUDE.md`, `.claude/contexto/estado.md`, `.claude/contexto/bitacora.md`, `.claude/contexto/decisiones.md`

**Interfaces:**
- Produces: `src/sim/tipos.js` exporta `TIPOS_VIA`, `SENTIDOS`, `SUPERFICIES`, `ESTADOS`, `CONTROLES`, `JERARQUIA`, `ETIQUETA_TIPO`. Scripts `npm run dev`, `npm run build`, `npm test`, `npm run red`.

- [ ] **Step 1: Mover la base Python**

```bash
mkdir -p python-original
mv 01_download_network.py 02_demand.py 03_scenarios.py 04_analyze.py README.md requirements.txt python-original/
```

- [ ] **Step 2: Crear `package.json`**

```json
{
  "name": "mapa-sangil",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "red": "node scripts/construir-red.js"
  }
}
```

- [ ] **Step 3: Instalar dependencias**

```bash
npm install react@18 react-dom@18 maplibre-gl@4 react-map-gl@7 @deck.gl/core@~9.0.0 @deck.gl/react@~9.0.0 @deck.gl/layers@~9.0.0 @deck.gl/extensions@~9.0.0
npm install -D vite@5 @vitejs/plugin-react@4 vitest@2
```

Expected: se crean `node_modules/` y `package-lock.json` sin errores. Si npm reporta conflicto de dependencias entre paquetes de deck.gl, deben quedar todos en la misma versión 9.0.x.

- [ ] **Step 4: Crear `vite.config.js`, `index.html`, `.gitignore`**

`vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

`index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tráfico San Gil</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`.gitignore`:

```
node_modules/
dist/
scripts/cache/
.vercel/
*.log
.DS_Store
python-original/data/
python-original/resultados/
python-original/.venv/
```

- [ ] **Step 5: Crear el shell mínimo de React**

`src/main.jsx`:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/ui/App.jsx` (provisional; se reemplaza en Task 7):

```jsx
export default function App() {
  return <h1>Simulador de tráfico · San Gil</h1>;
}
```

- [ ] **Step 6: Escribir el test de las constantes de dominio**

`tests/sim/tipos.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  TIPOS_VIA, SENTIDOS, SUPERFICIES, ESTADOS, CONTROLES, JERARQUIA, ETIQUETA_TIPO,
} from '../../src/sim/tipos.js';

describe('tipos de dominio', () => {
  it('todo tipo de vía tiene jerarquía y etiqueta', () => {
    for (const tipo of TIPOS_VIA) {
      expect(JERARQUIA[tipo]).toBeGreaterThan(0);
      expect(ETIQUETA_TIPO[tipo]).toBeTruthy();
    }
  });

  it('la jerarquía respeta el orden del spec', () => {
    expect(JERARQUIA.avenida_nacional).toBe(JERARQUIA.variante);
    expect(JERARQUIA.variante).toBeGreaterThan(JERARQUIA.doble_calzada);
    expect(JERARQUIA.doble_calzada).toBeGreaterThan(JERARQUIA.doble_sentido);
    expect(JERARQUIA.doble_sentido).toBeGreaterThan(JERARQUIA.un_sentido);
  });

  it('expone los valores permitidos', () => {
    expect(SENTIDOS).toEqual(['adelante', 'ambos']);
    expect(SUPERFICIES).toEqual(['pavimento', 'adoquin', 'destapado']);
    expect(ESTADOS).toEqual(['bueno', 'regular', 'huecos']);
    expect(CONTROLES).toEqual(['pare', 'prioridad', 'sin_senal', 'semaforo']);
  });
});
```

- [ ] **Step 7: Correr el test y verificar que falla**

Run: `npm test`
Expected: FAIL, no se puede resolver `../../src/sim/tipos.js`.

- [ ] **Step 8: Implementar `src/sim/tipos.js`**

```js
// Constantes del dominio. Las comparten el motor, los scripts y la interfaz.

export const TIPOS_VIA = [
  'un_sentido',
  'doble_sentido',
  'doble_calzada',
  'glorieta',
  'avenida_nacional',
  'variante',
];

export const SENTIDOS = ['adelante', 'ambos'];
export const SUPERFICIES = ['pavimento', 'adoquin', 'destapado'];
export const ESTADOS = ['bueno', 'regular', 'huecos'];
export const CONTROLES = ['pare', 'prioridad', 'sin_senal', 'semaforo'];

// Mayor número = más prelación en un cruce.
export const JERARQUIA = {
  avenida_nacional: 4,
  variante: 4,
  doble_calzada: 3,
  glorieta: 3,
  doble_sentido: 2,
  un_sentido: 1,
};

export const ETIQUETA_TIPO = {
  un_sentido: 'Un sentido',
  doble_sentido: 'Doble sentido',
  doble_calzada: 'Doble calzada',
  glorieta: 'Glorieta',
  avenida_nacional: 'Avenida Nacional',
  variante: 'Variante',
};
```

- [ ] **Step 9: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASS, 3 tests.

- [ ] **Step 10: Crear el contexto de sesiones**

`CLAUDE.md`:

```markdown
# Simulador de tráfico · San Gil

Proyecto universitario: mapa de San Gil (Santander) con tráfico simulado y
editable, para ver cómo funcionaría **mejor o peor** el tráfico con ciertos
cambios (puentes, Variante, arreglo de vías, sentidos, pares). Se presenta en
vivo en clase y se sustenta.

- Spec: `docs/superpowers/specs/2026-10-08-simulador-trafico-sangil-design.md`
- Planes por etapa: `docs/superpowers/plans/`
- Base Python original (referencia, no se ejecuta): `python-original/`

## Estado y decisiones

@.claude/contexto/estado.md
@.claude/contexto/decisiones.md

La bitácora de sesiones está en `.claude/contexto/bitacora.md`; léela si
necesitas el detalle de qué se hizo y cuándo.

## Comandos

- `npm run dev` — app en local
- `npm test` — pruebas del motor
- `npm run build` — build de producción
- `npm run red` — vuelve a descargar la red de OSM (solo si cambia el área)

## Convenciones

- JavaScript, no TypeScript.
- `src/sim/` es JavaScript puro: nada de React ni APIs del navegador.
- Nombres de código y textos de la interfaz en español.
- TDD en el motor: test que falla, implementación, test que pasa, commit.

## Al cerrar cada sesión

1. Actualizar `.claude/contexto/estado.md` (etapa, qué sigue, bloqueos).
2. Agregar una entrada corta a `.claude/contexto/bitacora.md`.
3. Si se tomó una decisión nueva, agregarla a `.claude/contexto/decisiones.md`.
```

`.claude/contexto/estado.md`:

```markdown
# Estado del proyecto

**Etapa actual:** 1 de 5 — Red de San Gil en el mapa (8 – 17 oct 2026)
**Plan activo:** `docs/superpowers/plans/2026-10-08-etapa-1-red-en-el-mapa.md`

## Hecho
- Spec aprobado.
- Proyecto Vite + React armado; base Python movida a `python-original/`.

## Sigue
- Task 2 del plan activo: clasificación de vías desde OSM.

## Bloqueos / pendientes del usuario
- Lista de campo: vías con huecos, destapadas, sentidos únicos y pares reales.
```

`.claude/contexto/decisiones.md`:

```markdown
# Decisiones

| Fecha | Decisión | Por qué |
|---|---|---|
| 2026-10-08 | JavaScript con React + Vite + MapLibre + deck.gl; sin TypeScript | Lenguaje asignado por el profe; TypeScript podría objetarse |
| 2026-10-08 | Motor microscópico (IDM + MOBIL + Dijkstra con tiempos medidos) en Web Worker | "Lo más real posible"; los vehículos descubren solos las vías arregladas |
| 2026-10-08 | Sin servidor; red de OSM pre-procesada dentro del repo | Corre local con npm y en Vercel igual; la demo no depende de internet |
| 2026-10-08 | San Gil no tiene semáforos: cruces con pare, prioridad o sin señal | Dato de campo del usuario; el semáforo es solo una intervención |
| 2026-10-08 | Sin costos en pesos | El objetivo es ver si el tráfico mejora o empeora, no evaluar inversión |
| 2026-10-08 | Doble calzada como intervención solo en Avenida Nacional y Variante | Indicación del usuario |
| 2026-10-08 | Con la Variante terminada se activa la restricción de pesados de paso (interruptor) | Permite comparar Variante con y sin obligar su uso |
| 2026-10-08 | Dos terminales: Terminal de Transporte (buses nacionales) y Terminalito (intermunicipales) | Dato de campo del usuario |
| 2026-10-08 | Datos de campo: arrancar con OSM + supuestos y corregir en el editor | No frenar el desarrollo esperando la lista |
| 2026-10-08 | Un plan por etapa | La forma real de los datos de OSM condiciona el motor |
```

`.claude/contexto/bitacora.md`:

```markdown
# Bitácora

## 2026-10-08
- Brainstorming y spec aprobado.
- Plan de la etapa 1 escrito.
- Proyecto armado (Task 1).
```

`README.md`:

```markdown
# Simulador de tráfico · San Gil

Mapa de San Gil (Santander) con tráfico simulado. Permite editar la red vial
para comparar cómo mejora o empeora el tráfico con distintos cambios.

## Correr en local

Requiere Node 20 o superior.

    npm install
    npm run dev

Abre la dirección que muestra la terminal (normalmente http://localhost:5173).

## Otros comandos

- `npm test` — pruebas del motor de simulación
- `npm run build` — build de producción en `dist/`
- `npm run red` — vuelve a descargar la red vial de OpenStreetMap

## Datos

La red vial proviene de OpenStreetMap, © colaboradores de OSM, bajo licencia
ODbL.

La base original en Python con SUMO está en `python-original/`.
```

- [ ] **Step 11: Verificar que el proyecto levanta y compila**

Run: `npm run build`
Expected: termina con `✓ built in ...` y crea `dist/`.

Run: `npm run dev`, abrir http://localhost:5173.
Expected: se ve el título "Simulador de tráfico · San Gil". Detener el servidor.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: proyecto Vite + React, contexto de sesiones y base Python movida"
```

---

### Task 2: Clasificar vías desde etiquetas de OSM

**Files:**
- Create: `scripts/lib/clasificarVia.js`
- Test: `tests/scripts/clasificarVia.test.js`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces:
  - `esViaVehicular(tags: object|undefined) → boolean`
  - `clasificarVia(tags: object) → { nombre, tipo, sentido: 'adelante'|'ambos'|'inverso', carrilesPorSentido, superficie, estado, velocidadMax, enConstruccion, esPuente }`. `inverso` significa que la geometría de OSM está al revés; Task 3 la invierte y lo cambia a `adelante`.

- [ ] **Step 1: Escribir los tests**

`tests/scripts/clasificarVia.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { clasificarVia, esViaVehicular } from '../../scripts/lib/clasificarVia.js';

describe('esViaVehicular', () => {
  it('acepta calles y rechaza peatonales', () => {
    expect(esViaVehicular({ highway: 'residential' })).toBe(true);
    expect(esViaVehicular({ highway: 'primary_link' })).toBe(true);
    expect(esViaVehicular({ highway: 'footway' })).toBe(false);
    expect(esViaVehicular({ highway: 'service' })).toBe(false);
    expect(esViaVehicular(undefined)).toBe(false);
  });

  it('acepta obras viales vehiculares y la Variante', () => {
    expect(esViaVehicular({ highway: 'construction', construction: 'trunk' })).toBe(true);
    expect(esViaVehicular({ highway: 'construction', name: 'Variante San Gil' })).toBe(true);
    expect(esViaVehicular({ highway: 'construction', construction: 'footway' })).toBe(false);
  });
});

describe('clasificarVia', () => {
  it('calle residencial sin etiquetas extra es doble sentido, pavimentada y en buen estado', () => {
    expect(clasificarVia({ highway: 'residential' })).toEqual({
      nombre: '',
      tipo: 'doble_sentido',
      sentido: 'ambos',
      carrilesPorSentido: 1,
      superficie: 'pavimento',
      estado: 'bueno',
      velocidadMax: 30,
      enConstruccion: false,
      esPuente: false,
    });
  });

  it('oneway=yes es un sentido; oneway=-1 queda marcado como inverso', () => {
    expect(clasificarVia({ highway: 'residential', oneway: 'yes' })).toMatchObject({
      tipo: 'un_sentido', sentido: 'adelante',
    });
    expect(clasificarVia({ highway: 'residential', oneway: '-1' })).toMatchObject({
      tipo: 'un_sentido', sentido: 'inverso',
    });
  });

  it('trunk y primary son Avenida Nacional', () => {
    expect(clasificarVia({ highway: 'trunk' }).tipo).toBe('avenida_nacional');
    expect(clasificarVia({ highway: 'primary', oneway: 'yes' })).toMatchObject({
      tipo: 'avenida_nacional', sentido: 'adelante',
    });
  });

  it('glorieta es de un sentido aunque no tenga oneway', () => {
    expect(clasificarVia({ highway: 'tertiary', junction: 'roundabout' })).toMatchObject({
      tipo: 'glorieta', sentido: 'adelante', velocidadMax: 20,
    });
  });

  it('la Variante en obra se reconoce por el nombre', () => {
    expect(clasificarVia({ highway: 'construction', construction: 'trunk', name: 'Variante San Gil' }))
      .toMatchObject({ tipo: 'variante', enConstruccion: true, velocidadMax: 60 });
  });

  it('doble calzada explícita', () => {
    expect(clasificarVia({ highway: 'secondary', oneway: 'yes', dual_carriageway: 'yes' }).tipo)
      .toBe('doble_calzada');
  });

  it('carriles: en doble sentido se reparten, en un sentido van todos', () => {
    expect(clasificarVia({ highway: 'secondary', lanes: '4' }).carrilesPorSentido).toBe(2);
    expect(clasificarVia({ highway: 'secondary', lanes: '3' }).carrilesPorSentido).toBe(1);
    expect(clasificarVia({ highway: 'secondary', lanes: '2', oneway: 'yes' }).carrilesPorSentido).toBe(2);
    expect(clasificarVia({ highway: 'secondary', lanes: 'x' }).carrilesPorSentido).toBe(1);
  });

  it('superficie y estado salen de surface y smoothness', () => {
    expect(clasificarVia({ highway: 'residential', surface: 'unpaved' }).superficie).toBe('destapado');
    expect(clasificarVia({ highway: 'residential', surface: 'paving_stones' }).superficie).toBe('adoquin');
    expect(clasificarVia({ highway: 'residential', smoothness: 'bad' }).estado).toBe('huecos');
    expect(clasificarVia({ highway: 'residential', smoothness: 'intermediate' }).estado).toBe('regular');
  });

  it('maxspeed: números, mph y valores raros', () => {
    expect(clasificarVia({ highway: 'residential', maxspeed: '40' }).velocidadMax).toBe(40);
    expect(clasificarVia({ highway: 'residential', maxspeed: '20 mph' }).velocidadMax).toBe(32);
    expect(clasificarVia({ highway: 'residential', maxspeed: 'none' }).velocidadMax).toBe(30);
    expect(clasificarVia({ highway: 'residential', maxspeed: 'signals' }).velocidadMax).toBe(30);
  });

  it('puentes', () => {
    expect(clasificarVia({ highway: 'trunk', bridge: 'yes' }).esPuente).toBe(true);
    expect(clasificarVia({ highway: 'trunk', bridge: 'viaduct' }).esPuente).toBe(true);
    expect(clasificarVia({ highway: 'trunk', bridge: 'no' }).esPuente).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- tests/scripts/clasificarVia.test.js`
Expected: FAIL, no se puede resolver `scripts/lib/clasificarVia.js`.

- [ ] **Step 3: Implementar `scripts/lib/clasificarVia.js`**

```js
// Traduce las etiquetas de una vía de OpenStreetMap a los atributos del modelo.
// Lo que OSM no dice se llena con supuestos que el usuario corrige en el editor.

const HIGHWAYS_VEHICULARES = new Set([
  'trunk', 'trunk_link', 'primary', 'primary_link',
  'secondary', 'secondary_link', 'tertiary', 'tertiary_link',
  'unclassified', 'residential', 'living_street',
]);

const SUPERFICIE_OSM = {
  pavimento: ['asphalt', 'paved', 'concrete', 'concrete:plates', 'concrete:lanes', 'chipseal'],
  adoquin: ['paving_stones', 'sett', 'cobblestone', 'unhewn_cobblestone', 'bricks'],
  destapado: ['unpaved', 'dirt', 'gravel', 'fine_gravel', 'ground', 'compacted', 'earth', 'mud', 'sand', 'pebblestone'],
};

const SMOOTHNESS_HUECOS = new Set(['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable']);

const VELOCIDAD_POR_TIPO = {
  avenida_nacional: 50,
  variante: 60,
  doble_calzada: 40,
  doble_sentido: 30,
  un_sentido: 30,
  glorieta: 20,
};

const esVariante = (tags) => /variante/i.test(tags.name ?? '');

export function esViaVehicular(tags) {
  if (!tags) return false;
  if (HIGHWAYS_VEHICULARES.has(tags.highway)) return true;
  return tags.highway === 'construction'
    && (HIGHWAYS_VEHICULARES.has(tags.construction) || esVariante(tags));
}

function leerEntero(valor) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function leerVelocidad(valor) {
  const m = /^(\d+)\s*(mph)?$/.exec(String(valor ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] ? Math.round(n * 1.609) : n;
}

function leerSentido(tags, glorieta) {
  const oneway = tags.oneway;
  if (oneway === '-1' || oneway === 'reverse') return 'inverso';
  if (oneway === 'yes' || oneway === 'true' || oneway === '1' || glorieta) return 'adelante';
  return 'ambos';
}

function leerTipo(tags, highway, sentido, glorieta) {
  if (esVariante(tags)) return 'variante';
  if (glorieta) return 'glorieta';
  if (highway.startsWith('trunk') || highway.startsWith('primary')) return 'avenida_nacional';
  if (tags.dual_carriageway === 'yes') return 'doble_calzada';
  return sentido === 'ambos' ? 'doble_sentido' : 'un_sentido';
}

function leerSuperficie(surface) {
  for (const [superficie, valores] of Object.entries(SUPERFICIE_OSM)) {
    if (valores.includes(surface)) return superficie;
  }
  return 'pavimento';
}

function leerEstado(smoothness) {
  if (SMOOTHNESS_HUECOS.has(smoothness)) return 'huecos';
  if (smoothness === 'intermediate') return 'regular';
  return 'bueno';
}

export function clasificarVia(tags) {
  const enConstruccion = tags.highway === 'construction';
  const highway = enConstruccion ? (tags.construction ?? 'tertiary') : tags.highway;
  const glorieta = tags.junction === 'roundabout' || tags.junction === 'circular';
  const sentido = leerSentido(tags, glorieta);
  const tipo = leerTipo(tags, highway, sentido, glorieta);

  const carriles = leerEntero(tags.lanes);
  let carrilesPorSentido = 1;
  if (carriles) {
    carrilesPorSentido = sentido === 'ambos' ? Math.max(1, Math.floor(carriles / 2)) : carriles;
  }

  return {
    nombre: tags.name ?? '',
    tipo,
    sentido,
    carrilesPorSentido,
    superficie: leerSuperficie(tags.surface),
    estado: leerEstado(tags.smoothness),
    velocidadMax: leerVelocidad(tags.maxspeed) ?? VELOCIDAD_POR_TIPO[tipo],
    enConstruccion,
    esPuente: tags.bridge !== undefined && tags.bridge !== 'no',
  };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- tests/scripts/clasificarVia.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/clasificarVia.js tests/scripts/clasificarVia.test.js
git commit -m "feat(red): clasificar vías de OSM en tipos del modelo"
```

---

### Task 3: Geometría y conversión de Overpass a red

**Files:**
- Create: `src/sim/geo.js`, `scripts/lib/osmARed.js`
- Test: `tests/sim/geo.test.js`, `tests/scripts/osmARed.test.js`

**Interfaces:**
- Consumes: `clasificarVia`, `esViaVehicular` (Task 2); `JERARQUIA` (Task 1).
- Produces:
  - `src/sim/geo.js`: `distanciaMetros(a: [lon,lat], b: [lon,lat]) → number`; `longitudLinea(coords) → number`; `puntoALoLargo(coords, distancia) → { posicion: [lon,lat], segmento: number }`; `anguloPantalla(a, b) → number` (grados, antihorario desde el este).
  - `scripts/lib/osmARed.js`: `osmARed(overpass: { elements: [] }) → { nodos: Nodo[], vias: Via[], descartadas: number, pares: number }` con `Nodo` y `Via` según "Formato de la red".

- [ ] **Step 1: Escribir los tests de geometría**

`tests/sim/geo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { distanciaMetros, longitudLinea, puntoALoLargo, anguloPantalla } from '../../src/sim/geo.js';

const A = [-73.137, 6.555];
const B = [-73.136, 6.555]; // 0,001° al este de A: unos 110,5 m
const C = [-73.136, 6.556]; // 0,001° al norte de B: unos 111,2 m

describe('geo', () => {
  it('distancia entre dos puntos cercanos', () => {
    const d = distanciaMetros(A, B);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(111);
  });

  it('longitud de una línea es la suma de sus tramos', () => {
    expect(longitudLinea([A, B, C])).toBeCloseTo(distanciaMetros(A, B) + distanciaMetros(B, C), 6);
    expect(longitudLinea([A])).toBe(0);
  });

  it('punto a lo largo de la línea', () => {
    const mitad = puntoALoLargo([A, B], distanciaMetros(A, B) / 2);
    expect(mitad.segmento).toBe(0);
    expect(mitad.posicion[0]).toBeCloseTo(-73.1365, 6);
    expect(mitad.posicion[1]).toBeCloseTo(6.555, 6);

    const enSegundoTramo = puntoALoLargo([A, B, C], distanciaMetros(A, B) + 10);
    expect(enSegundoTramo.segmento).toBe(1);

    const masAlla = puntoALoLargo([A, B], 99999);
    expect(masAlla.posicion).toEqual(B);
  });

  it('ángulo en pantalla: este 0°, norte 90°, oeste 180°', () => {
    expect(anguloPantalla(A, B)).toBeCloseTo(0, 6);
    expect(anguloPantalla(B, C)).toBeCloseTo(90, 6);
    expect(Math.abs(anguloPantalla(B, A))).toBeCloseTo(180, 6);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- tests/sim/geo.test.js`
Expected: FAIL, no se puede resolver `src/sim/geo.js`.

- [ ] **Step 3: Implementar `src/sim/geo.js`**

```js
// Geometría sobre coordenadas [lon, lat]. Distancias en metros.

const RADIO_TIERRA = 6371008.8;
const rad = (grados) => (grados * Math.PI) / 180;

export function distanciaMetros([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.sqrt(a));
}

export function longitudLinea(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += distanciaMetros(coords[i - 1], coords[i]);
  return total;
}

export function puntoALoLargo(coords, distancia) {
  let acumulado = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const tramo = distanciaMetros(coords[i], coords[i + 1]);
    if (acumulado + tramo >= distancia) {
      const t = tramo === 0 ? 0 : (distancia - acumulado) / tramo;
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      return { posicion: [lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t], segmento: i };
    }
    acumulado += tramo;
  }
  return { posicion: coords[coords.length - 1], segmento: coords.length - 2 };
}

// Grados en sentido antihorario desde el este, como los usa deck.gl.
export function anguloPantalla([lon1, lat1], [lon2, lat2]) {
  const dx = (lon2 - lon1) * Math.cos(rad((lat1 + lat2) / 2));
  const dy = lat2 - lat1;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- tests/sim/geo.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Escribir los tests de la conversión**

`tests/scripts/osmARed.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { osmARed } from '../../scripts/lib/osmARed.js';

const nodo = (id, lon, lat, tags) => ({ type: 'node', id, lon, lat, ...(tags && { tags }) });
const way = (id, nodes, tags = {}) => ({ type: 'way', id, nodes, tags: { highway: 'residential', ...tags } });

// Cruz: una calle de doble sentido (1-2-3) y una de un sentido (4-2-5) que se cortan en 2.
const cruz = (extras = []) => ({
  elements: [
    nodo(1, -73.137, 6.555), nodo(2, -73.136, 6.555), nodo(3, -73.135, 6.555),
    nodo(4, -73.136, 6.556), nodo(5, -73.136, 6.554),
    way(100, [1, 2, 3]),
    way(200, [4, 2, 5], { oneway: 'yes' }),
    ...extras,
  ],
});

const porId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]));

describe('osmARed', () => {
  it('corta las vías en los cruces', () => {
    const { nodos, vias } = osmARed(cruz());
    expect(nodos.map((n) => n.id).sort()).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
    expect(vias.map((v) => v.id).sort()).toEqual(['v100_0', 'v100_1', 'v200_0', 'v200_1']);

    const v = porId(vias);
    expect(v.v100_0).toMatchObject({ desde: 'n1', hasta: 'n2', tipo: 'doble_sentido', sentido: 'ambos', abierta: true });
    expect(v.v200_0).toMatchObject({ desde: 'n4', hasta: 'n2', tipo: 'un_sentido', sentido: 'adelante' });
    expect(v.v100_0.geometria).toEqual([[-73.137, 6.555], [-73.136, 6.555]]);
    expect(v.v100_0.longitud).toBeGreaterThan(110);
    expect(v.v100_0.longitud).toBeLessThan(111);
  });

  it('cruce entre vías de distinta jerarquía es de prioridad; los extremos, sin señal', () => {
    const n = porId(osmARed(cruz()).nodos);
    expect(n.n2.control).toBe('prioridad');
    expect(n.n1.control).toBe('sin_senal');
  });

  it('ningún nodo empieza con semáforo', () => {
    const { nodos } = osmARed(cruz());
    expect(nodos.every((n) => n.control !== 'semaforo')).toBe(true);
  });

  it('un nodo de pare a mitad de vía marca el cruce más cercano', () => {
    const conPare = cruz([nodo(10, -73.136, 6.5552, { highway: 'stop' })]);
    conPare.elements.find((e) => e.id === 200).nodes = [4, 10, 2, 5];
    const { nodos, pares } = osmARed(conPare);
    expect(porId(nodos).n2.control).toBe('pare');
    expect(pares).toBe(1);
  });

  it('oneway=-1 invierte la geometría', () => {
    const { vias } = osmARed({
      elements: [nodo(6, -73.137, 6.555), nodo(7, -73.136, 6.555), way(300, [6, 7], { oneway: '-1' })],
    });
    expect(vias).toHaveLength(1);
    expect(vias[0]).toMatchObject({ desde: 'n7', hasta: 'n6', sentido: 'adelante' });
    expect(vias[0].geometria[0]).toEqual([-73.136, 6.555]);
  });

  it('omite nodos que Overpass no devolvió', () => {
    const { vias } = osmARed({
      elements: [nodo(1, -73.137, 6.555), nodo(2, -73.136, 6.555), way(100, [1, 999, 2])],
    });
    expect(vias).toHaveLength(1);
    expect(vias[0].geometria).toHaveLength(2);
  });

  it('descarta vías sin nodos suficientes', () => {
    const { vias } = osmARed({ elements: [nodo(1, -73.137, 6.555), way(100, [1, 999])] });
    expect(vias).toHaveLength(0);
  });

  it('glorieta cerrada se corta en sus cruces y no deja lazos', () => {
    const { vias } = osmARed({
      elements: [
        nodo(20, -73.1360, 6.5550), nodo(21, -73.1355, 6.5555), nodo(22, -73.1350, 6.5550),
        nodo(23, -73.1355, 6.5565),
        way(500, [20, 21, 22, 20], { junction: 'roundabout', highway: 'tertiary' }),
        way(600, [23, 21]),
      ],
    });
    expect(vias.every((v) => v.desde !== v.hasta)).toBe(true);
    expect(vias.filter((v) => v.tipo === 'glorieta')).toHaveLength(2);
  });

  it('se queda con la parte conectada más grande y cuenta lo descartado', () => {
    const { vias, descartadas } = osmARed(cruz([
      nodo(8, -73.120, 6.570), nodo(9, -73.119, 6.570), way(400, [8, 9]),
    ]));
    expect(vias.some((v) => v.osmId === 400)).toBe(false);
    expect(descartadas).toBe(1);
  });

  it('ignora vías no vehiculares', () => {
    const { vias } = osmARed(cruz([way(700, [1, 4], { highway: 'footway' })]));
    expect(vias.some((v) => v.osmId === 700)).toBe(false);
  });
});
```

- [ ] **Step 6: Correr y verificar que falla**

Run: `npm test -- tests/scripts/osmARed.test.js`
Expected: FAIL, no se puede resolver `scripts/lib/osmARed.js`.

- [ ] **Step 7: Implementar `scripts/lib/osmARed.js`**

```js
// Convierte la respuesta de Overpass en la red del modelo: los nodos son los
// cruces y extremos; las vías son los tramos entre dos nodos.

import { clasificarVia, esViaVehicular } from './clasificarVia.js';
import { distanciaMetros, longitudLinea } from '../../src/sim/geo.js';
import { JERARQUIA } from '../../src/sim/tipos.js';

const LONGITUD_MINIMA = 0.5; // metros; tramos más cortos son nodos duplicados
const RADIO_PARE = 30; // metros entre la señal de pare y el cruce que controla

function leerElementos(overpass) {
  const nodosOsm = new Map();
  const ways = [];
  for (const el of overpass.elements ?? []) {
    if (el.type === 'node') nodosOsm.set(el.id, el);
    else if (el.type === 'way' && esViaVehicular(el.tags)) ways.push(el);
  }
  return { nodosOsm, ways };
}

function prepararWays(ways, nodosOsm) {
  const preparados = [];
  for (const way of ways) {
    const atributos = clasificarVia(way.tags);
    let ids = way.nodes.filter((id) => nodosOsm.has(id));
    if (atributos.sentido === 'inverso') {
      ids = [...ids].reverse();
      atributos.sentido = 'adelante';
    }
    if (ids.length >= 2) preparados.push({ way, atributos, ids });
  }
  return preparados;
}

function cortarEnCruces(preparados, nodosOsm) {
  const usos = new Map();
  for (const { ids } of preparados) {
    for (const id of ids) usos.set(id, (usos.get(id) ?? 0) + 1);
  }

  const vias = [];
  const tramos = new Map(); // viaId -> ids OSM del tramo, para ubicar los pares
  for (const { way, atributos, ids } of preparados) {
    let inicio = 0;
    let k = 0;
    for (let i = 1; i < ids.length; i++) {
      const esCruce = i === ids.length - 1 || usos.get(ids[i]) >= 2;
      if (!esCruce) continue;
      const tramo = ids.slice(inicio, i + 1);
      inicio = i;
      if (tramo[0] === tramo[tramo.length - 1]) continue; // lazo sobre sí mismo
      const geometria = tramo.map((id) => [nodosOsm.get(id).lon, nodosOsm.get(id).lat]);
      const longitud = longitudLinea(geometria);
      if (longitud < LONGITUD_MINIMA) continue;
      const id = `v${way.id}_${k++}`;
      vias.push({
        id,
        osmId: way.id,
        ...atributos,
        desde: `n${tramo[0]}`,
        hasta: `n${tramo[tramo.length - 1]}`,
        geometria,
        longitud: Math.round(longitud * 10) / 10,
        abierta: true,
      });
      tramos.set(id, tramo);
    }
  }
  return { vias, tramos };
}

function componenteMayor(vias) {
  const padre = new Map();
  const raiz = (x) => {
    while (padre.get(x) !== x) {
      padre.set(x, padre.get(padre.get(x)));
      x = padre.get(x);
    }
    return x;
  };
  for (const v of vias) {
    if (!padre.has(v.desde)) padre.set(v.desde, v.desde);
    if (!padre.has(v.hasta)) padre.set(v.hasta, v.hasta);
    padre.set(raiz(v.desde), raiz(v.hasta));
  }
  const conteo = new Map();
  for (const v of vias) {
    const r = raiz(v.desde);
    conteo.set(r, (conteo.get(r) ?? 0) + 1);
  }
  let mejor = null;
  for (const [r, n] of conteo) if (mejor === null || n > conteo.get(mejor)) mejor = r;
  return vias.filter((v) => raiz(v.desde) === mejor);
}

function construirNodos(vias, nodosOsm) {
  const jerarquias = new Map();
  for (const v of vias) {
    for (const id of [v.desde, v.hasta]) {
      if (!jerarquias.has(id)) jerarquias.set(id, new Set());
      jerarquias.get(id).add(JERARQUIA[v.tipo]);
    }
  }
  return [...jerarquias].map(([id, js]) => {
    const n = nodosOsm.get(Number(id.slice(1)));
    return { id, lon: n.lon, lat: n.lat, control: js.size > 1 ? 'prioridad' : 'sin_senal' };
  });
}

function aplicarPares(nodos, vias, tramos, nodosOsm) {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const viasPorNodoOsm = new Map();
  for (const v of vias) {
    for (const idOsm of tramos.get(v.id)) {
      if (!viasPorNodoOsm.has(idOsm)) viasPorNodoOsm.set(idOsm, []);
      viasPorNodoOsm.get(idOsm).push(v);
    }
  }

  const marcados = new Set();
  for (const [idOsm, el] of nodosOsm) {
    if (el.tags?.highway !== 'stop') continue;
    const punto = [el.lon, el.lat];
    let mejor = null;
    let mejorDist = Infinity;
    for (const v of viasPorNodoOsm.get(idOsm) ?? []) {
      for (const idNodo of [v.desde, v.hasta]) {
        const n = porId.get(idNodo);
        const d = distanciaMetros(punto, [n.lon, n.lat]);
        if (d < mejorDist) { mejor = n; mejorDist = d; }
      }
    }
    if (mejor && mejorDist <= RADIO_PARE) {
      mejor.control = 'pare';
      marcados.add(mejor.id);
    }
  }
  return marcados.size;
}

export function osmARed(overpass) {
  const { nodosOsm, ways } = leerElementos(overpass);
  const preparados = prepararWays(ways, nodosOsm);
  const { vias: todas, tramos } = cortarEnCruces(preparados, nodosOsm);
  const vias = componenteMayor(todas);
  const nodos = construirNodos(vias, nodosOsm);
  const pares = aplicarPares(nodos, vias, tramos, nodosOsm);
  return { nodos, vias, descartadas: todas.length - vias.length, pares };
}
```

- [ ] **Step 8: Correr y verificar que pasa**

Run: `npm test -- tests/scripts/osmARed.test.js tests/sim/geo.test.js`
Expected: PASS, 14 tests.

- [ ] **Step 9: Commit**

```bash
git add src/sim/geo.js scripts/lib/osmARed.js tests/sim/geo.test.js tests/scripts/osmARed.test.js
git commit -m "feat(red): convertir respuesta de Overpass en nodos y vías"
```

---

### Task 4: Grafo de la red en el motor

**Files:**
- Create: `src/sim/red.js`
- Test: `tests/sim/red.test.js`

**Interfaces:**
- Consumes: `TIPOS_VIA`, `SENTIDOS`, `CONTROLES` (Task 1).
- Produces:
  - `validarRed(datos) → string[]` (vacío si es válida).
  - `crearRed(datos) → Red`, lanza `Error` cuyo mensaje empieza con `Red inválida` si `validarRed` devuelve errores.
  - `Red = { meta: { version, generado, fuente, bbox }, nodos: Map<id, Nodo>, vias: Map<id, Via>, arcos: Map<id, Arco>, salientes: Map<nodoId, arcoId[]> }`.
  - `Arco = { id: '<viaId>>' | '<viaId><', viaId, desde, hasta, adelante: boolean }`. Toda vía tiene el arco `>`; las de `sentido: 'ambos'` también el `<`.
  - `arcoTransitable(red, arcoId) → boolean` (vía abierta y no en construcción).
  - `alcanzables(red, origenId) → Set<nodoId>`.

- [ ] **Step 1: Escribir los tests**

`tests/sim/red.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validarRed, crearRed, arcoTransitable, alcanzables } from '../../src/sim/red.js';

const via = (id, desde, hasta, extra = {}) => ({
  id, osmId: 1, nombre: '', desde, hasta,
  geometria: [[0, 0], [0, 0.001]], longitud: 111,
  tipo: 'doble_sentido', sentido: 'ambos', carrilesPorSentido: 1,
  superficie: 'pavimento', estado: 'bueno', velocidadMax: 30,
  abierta: true, enConstruccion: false, esPuente: false,
  ...extra,
});

// a --(un sentido)--> b <--(doble)--> c
const datos = (extra = {}) => ({
  version: 1, generado: '2026-10-08T00:00:00Z', fuente: 'test', bbox: null,
  nodos: ['a', 'b', 'c'].map((id) => ({ id, lon: 0, lat: 0, control: 'sin_senal' })),
  vias: [
    via('ab', 'a', 'b', { tipo: 'un_sentido', sentido: 'adelante' }),
    via('bc', 'b', 'c', extra.bc),
  ],
});

describe('validarRed', () => {
  it('una red bien formada no tiene errores', () => {
    expect(validarRed(datos())).toEqual([]);
  });

  it('reporta nodos inexistentes, geometrías cortas y valores desconocidos', () => {
    const d = datos();
    d.vias[0].hasta = 'zzz';
    d.vias[1].geometria = [[0, 0]];
    d.vias[1].tipo = 'autopista';
    d.nodos[0].control = 'rotonda';
    const errores = validarRed(d).join('\n');
    expect(errores).toContain('ab');
    expect(errores).toContain('zzz');
    expect(errores).toContain('geometría');
    expect(errores).toContain('autopista');
    expect(errores).toContain('rotonda');
  });

  it('rechaza versiones y estructuras inesperadas', () => {
    expect(validarRed(null)).not.toEqual([]);
    expect(validarRed({ version: 2, nodos: [], vias: [] })[0]).toContain('Versión');
    expect(validarRed({ version: 1 })).not.toEqual([]);
  });
});

describe('crearRed', () => {
  it('construye arcos dirigidos según el sentido', () => {
    const red = crearRed(datos());
    expect([...red.arcos.keys()].sort()).toEqual(['ab>', 'bc<', 'bc>']);
    expect(red.salientes.get('a')).toEqual(['ab>']);
    expect(red.salientes.get('b')).toEqual(['bc>']);
    expect(red.salientes.get('c')).toEqual(['bc<']);
    expect(red.arcos.get('bc<')).toMatchObject({ desde: 'c', hasta: 'b', adelante: false });
  });

  it('lanza un error legible si la red es inválida', () => {
    const d = datos();
    d.vias[0].desde = 'zzz';
    expect(() => crearRed(d)).toThrow(/^Red inválida/);
  });
});

describe('alcanzables y arcos transitables', () => {
  it('respeta el sentido de las vías', () => {
    const red = crearRed(datos());
    expect(alcanzables(red, 'a')).toEqual(new Set(['a', 'b', 'c']));
    expect(alcanzables(red, 'c')).toEqual(new Set(['c', 'b']));
  });

  it('una vía cerrada no se puede transitar', () => {
    const red = crearRed(datos({ bc: { abierta: false } }));
    expect(arcoTransitable(red, 'bc>')).toBe(false);
    expect(alcanzables(red, 'a')).toEqual(new Set(['a', 'b']));
  });

  it('una vía en construcción no se puede transitar', () => {
    const red = crearRed(datos({ bc: { enConstruccion: true } }));
    expect(arcoTransitable(red, 'bc>')).toBe(false);
    expect(alcanzables(red, 'a')).toEqual(new Set(['a', 'b']));
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- tests/sim/red.test.js`
Expected: FAIL, no se puede resolver `src/sim/red.js`.

- [ ] **Step 3: Implementar `src/sim/red.js`**

```js
// La red vial como grafo dirigido. Cada vía produce un arco por sentido
// permitido: '<viaId>>' de desde a hasta, y '<viaId><' de hasta a desde.

import { TIPOS_VIA, SENTIDOS, CONTROLES } from './tipos.js';

export function validarRed(datos) {
  if (!datos || typeof datos !== 'object') return ['La red no es un objeto'];
  const errores = [];
  if (datos.version !== 1) errores.push(`Versión de red no soportada: ${datos.version}`);
  if (!Array.isArray(datos.nodos)) errores.push('Falta la lista de nodos');
  if (!Array.isArray(datos.vias)) errores.push('Falta la lista de vías');
  if (errores.length) return errores;

  const ids = new Set(datos.nodos.map((n) => n.id));
  for (const n of datos.nodos) {
    if (!CONTROLES.includes(n.control)) errores.push(`Nodo ${n.id}: control desconocido "${n.control}"`);
  }
  for (const v of datos.vias) {
    if (!ids.has(v.desde)) errores.push(`Vía ${v.id}: el nodo de inicio ${v.desde} no existe`);
    if (!ids.has(v.hasta)) errores.push(`Vía ${v.id}: el nodo final ${v.hasta} no existe`);
    if (!Array.isArray(v.geometria) || v.geometria.length < 2) {
      errores.push(`Vía ${v.id}: geometría con menos de 2 puntos`);
    }
    if (!TIPOS_VIA.includes(v.tipo)) errores.push(`Vía ${v.id}: tipo desconocido "${v.tipo}"`);
    if (!SENTIDOS.includes(v.sentido)) errores.push(`Vía ${v.id}: sentido desconocido "${v.sentido}"`);
  }
  return errores;
}

export function crearRed(datos) {
  const errores = validarRed(datos);
  if (errores.length) {
    throw new Error(`Red inválida:\n- ${errores.slice(0, 10).join('\n- ')}`);
  }

  const nodos = new Map(datos.nodos.map((n) => [n.id, n]));
  const vias = new Map(datos.vias.map((v) => [v.id, v]));
  const arcos = new Map();
  const salientes = new Map(datos.nodos.map((n) => [n.id, []]));

  const agregar = (arco) => {
    arcos.set(arco.id, arco);
    salientes.get(arco.desde).push(arco.id);
  };
  for (const v of datos.vias) {
    agregar({ id: `${v.id}>`, viaId: v.id, desde: v.desde, hasta: v.hasta, adelante: true });
    if (v.sentido === 'ambos') {
      agregar({ id: `${v.id}<`, viaId: v.id, desde: v.hasta, hasta: v.desde, adelante: false });
    }
  }

  const { version, generado, fuente, bbox } = datos;
  return { meta: { version, generado, fuente, bbox }, nodos, vias, arcos, salientes };
}

export function arcoTransitable(red, arcoId) {
  const via = red.vias.get(red.arcos.get(arcoId).viaId);
  return via.abierta && !via.enConstruccion;
}

export function alcanzables(red, origenId) {
  const vistos = new Set([origenId]);
  const pendientes = [origenId];
  while (pendientes.length) {
    const actual = pendientes.pop();
    for (const arcoId of red.salientes.get(actual) ?? []) {
      if (!arcoTransitable(red, arcoId)) continue;
      const siguiente = red.arcos.get(arcoId).hasta;
      if (!vistos.has(siguiente)) {
        vistos.add(siguiente);
        pendientes.push(siguiente);
      }
    }
  }
  return vistos;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- tests/sim/red.test.js`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/sim/red.js tests/sim/red.test.js
git commit -m "feat(sim): grafo dirigido de la red con validación y alcanzabilidad"
```

---

### Task 5: Descargar San Gil y cargar la red en el navegador

**Files:**
- Create: `scripts/construir-red.js`, `public/data/red-sangil.json` (generado), `src/ui/datos/cargarRed.js`
- Test: `tests/ui/cargarRed.test.js`

**Interfaces:**
- Consumes: `osmARed` (Task 3), `crearRed`, `validarRed` (Task 4).
- Produces:
  - Archivo `public/data/red-sangil.json` con el formato de la sección "Formato de la red".
  - `src/ui/datos/cargarRed.js`: `URL_RED = '/data/red-sangil.json'`; `cargarRed(fetchFn = globalThis.fetch, url = URL_RED) → Promise<Red>`.

- [ ] **Step 1: Escribir los tests de la carga**

`tests/ui/cargarRed.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { cargarRed } from '../../src/ui/datos/cargarRed.js';

const redMinima = {
  version: 1, generado: 'x', fuente: 'test', bbox: null,
  nodos: [
    { id: 'a', lon: 0, lat: 0, control: 'sin_senal' },
    { id: 'b', lon: 0, lat: 0.001, control: 'sin_senal' },
  ],
  vias: [{
    id: 'ab', osmId: 1, nombre: '', desde: 'a', hasta: 'b',
    geometria: [[0, 0], [0, 0.001]], longitud: 111,
    tipo: 'doble_sentido', sentido: 'ambos', carrilesPorSentido: 1,
    superficie: 'pavimento', estado: 'bueno', velocidadMax: 30,
    abierta: true, enConstruccion: false, esPuente: false,
  }],
};

const respuesta = ({ ok = true, status = 200, json }) => async () => ({ ok, status, json });

describe('cargarRed', () => {
  it('devuelve la red construida', async () => {
    const red = await cargarRed(respuesta({ json: async () => redMinima }));
    expect(red.vias.size).toBe(1);
    expect(red.arcos.size).toBe(2);
  });

  it('archivo ausente (HTTP 404) indica cómo generarlo', async () => {
    await expect(cargarRed(respuesta({ ok: false, status: 404 })))
      .rejects.toThrow(/HTTP 404.*npm run red/);
  });

  it('respuesta que no es JSON (Vite devuelve index.html) indica cómo generarlo', async () => {
    const noJson = respuesta({ json: async () => { throw new SyntaxError('Unexpected token <'); } });
    await expect(cargarRed(noJson)).rejects.toThrow(/npm run red/);
  });

  it('fallo de red se reporta con su causa', async () => {
    const caido = async () => { throw new Error('sin conexión'); };
    await expect(cargarRed(caido)).rejects.toThrow(/sin conexión/);
  });

  it('red con datos inválidos se reporta', async () => {
    await expect(cargarRed(respuesta({ json: async () => ({ version: 1 }) })))
      .rejects.toThrow(/Red inválida/);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- tests/ui/cargarRed.test.js`
Expected: FAIL, no se puede resolver `src/ui/datos/cargarRed.js`.

- [ ] **Step 3: Implementar `src/ui/datos/cargarRed.js`**

```js
import { crearRed } from '../../sim/red.js';

export const URL_RED = '/data/red-sangil.json';

export async function cargarRed(fetchFn = globalThis.fetch, url = URL_RED) {
  let respuesta;
  try {
    respuesta = await fetchFn(url);
  } catch (err) {
    throw new Error(`No se pudo descargar la red vial: ${err.message}`);
  }
  if (!respuesta.ok) {
    throw new Error(`No se encontró la red vial (HTTP ${respuesta.status}). Genérala con "npm run red".`);
  }

  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    throw new Error('El archivo de la red vial no existe o está dañado. Genéralo con "npm run red".');
  }
  return crearRed(datos);
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- tests/ui/cargarRed.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Implementar `scripts/construir-red.js`**

```js
// Descarga la red vial de San Gil desde Overpass (OpenStreetMap), la convierte
// al formato del modelo y la guarda en public/data/red-sangil.json.
//
// Uso:
//   npm run red              usa la copia en scripts/cache/ si existe
//   npm run red -- --fresca  vuelve a descargar desde Overpass

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { osmARed } from './lib/osmARed.js';
import { validarRed } from '../src/sim/red.js';
import { ETIQUETA_TIPO } from '../src/sim/tipos.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(RAIZ, 'scripts', 'cache', 'overpass-sangil.json');
const SALIDA = join(RAIZ, 'public', 'data', 'red-sangil.json');

// Área un poco más amplia que el casco urbano para incluir la Variante y las
// salidas a otros municipios. Verifica estos límites en openstreetmap.org.
const BBOX = { sur: 6.525, oeste: -73.16, norte: 6.585, este: -73.105 };

const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const CONSULTA = `
[out:json][timeout:120];
(
  way["highway"~"^(trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|construction)$"]
    (${BBOX.sur},${BBOX.oeste},${BBOX.norte},${BBOX.este});
);
(._;>;);
out body;
`;

async function descargar() {
  for (const url of SERVIDORES) {
    try {
      console.log(`Descargando desde ${url} ...`);
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MapaSangil/0.1 (proyecto universitario)',
        },
        body: `data=${encodeURIComponent(CONSULTA)}`,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      console.warn(`  falló: ${err.message}`);
    }
  }
  throw new Error('Ningún servidor de Overpass respondió. Intenta de nuevo en unos minutos.');
}

async function obtenerOverpass(fresca) {
  if (!fresca && existsSync(CACHE)) {
    console.log(`Usando copia local ${CACHE}`);
    return JSON.parse(await readFile(CACHE, 'utf8'));
  }
  const datos = await descargar();
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify(datos));
  return datos;
}

function imprimirInventario({ nodos, vias, descartadas, pares }) {
  console.log(`\n${nodos.length} nodos, ${vias.length} vías (${descartadas} descartadas por estar aisladas)`);
  console.log(`${pares} cruces con pare según OSM\n`);

  const porTipo = {};
  for (const v of vias) porTipo[v.tipo] = (porTipo[v.tipo] ?? 0) + v.longitud;
  console.log('Kilómetros por tipo de vía:');
  for (const [tipo, metros] of Object.entries(porTipo)) {
    console.log(`  ${ETIQUETA_TIPO[tipo].padEnd(18)} ${(metros / 1000).toFixed(1)} km`);
  }

  const puentes = vias.filter((v) => v.esPuente).sort((a, b) => b.longitud - a.longitud);
  console.log(`\n${puentes.length} tramos de puente:`);
  for (const v of puentes.slice(0, 15)) {
    console.log(`  ${String(v.longitud).padStart(7)} m  ${v.nombre || '(sin nombre)'}  [way ${v.osmId}]`);
  }

  const obras = vias.filter((v) => v.enConstruccion);
  console.log(`\n${obras.length} tramos en construcción:`);
  for (const v of obras.slice(0, 15)) {
    console.log(`  ${String(v.longitud).padStart(7)} m  ${v.nombre || '(sin nombre)'}  [way ${v.osmId}]`);
  }
}

async function main() {
  const fresca = process.argv.includes('--fresca');
  const overpass = await obtenerOverpass(fresca);
  const resultado = osmARed(overpass);

  const archivo = {
    version: 1,
    generado: new Date().toISOString(),
    fuente: '© colaboradores de OpenStreetMap (ODbL)',
    bbox: BBOX,
    nodos: resultado.nodos,
    vias: resultado.vias,
  };
  const errores = validarRed(archivo);
  if (errores.length) {
    console.error('La red generada no es válida:\n- ' + errores.slice(0, 20).join('\n- '));
    process.exit(1);
  }

  await mkdir(dirname(SALIDA), { recursive: true });
  await writeFile(SALIDA, JSON.stringify(archivo));
  imprimirInventario(resultado);
  console.log(`\nRed -> ${SALIDA}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 6: Generar la red real**

Run: `npm run red`
Expected: imprime el número de nodos y vías (del orden de cientos a pocos miles), kilómetros por tipo, la lista de puentes y la de tramos en construcción, y termina con `Red -> .../public/data/red-sangil.json`.

Verificar en la salida:
- Que en "Kilómetros por tipo" aparezca **Avenida Nacional**.
- Que la lista de puentes incluya tramos con nombre o sin nombre sobre el río Fonce.
- Si "tramos en construcción" **no** incluye la Variante, anotarlo en `.claude/contexto/estado.md` bajo "Bloqueos": la Variante se trazará a mano con la herramienta de vía nueva en la etapa 3.

Si Overpass falla en ambos servidores, esperar unos minutos y repetir con `npm run red -- --fresca`.

- [ ] **Step 7: Verificar el tamaño del archivo**

Run: `ls -la public/data/red-sangil.json`
Expected: menos de 5 MB. Si pasa de 5 MB, reducir el `BBOX` y regenerar.

- [ ] **Step 8: Correr todos los tests**

Run: `npm test`
Expected: PASS en todos los archivos.

- [ ] **Step 9: Commit**

```bash
git add scripts/construir-red.js src/ui/datos/cargarRed.js tests/ui/cargarRed.test.js public/data/red-sangil.json
git commit -m "feat(red): descargar San Gil de OSM y cargar la red en el navegador"
```

---

### Task 6: Estilos de vía y flechas de sentido

**Files:**
- Create: `src/ui/mapa/estilosVia.js`
- Test: `tests/ui/estilosVia.test.js`

**Interfaces:**
- Consumes: `TIPOS_VIA` (Task 1); `longitudLinea`, `puntoALoLargo`, `anguloPantalla` (Task 3).
- Produces: `COLOR_TIPO: Record<tipo, [r,g,b]>`, `COLOR_PUENTE`, `COLOR_PARE`, `ANCHO_TIPO: Record<tipo, number>`, `colorVia(via) → [r,g,b]`, `anchoVia(via) → number`, `flechasDeVias(vias, { longitudMinima = 25 }) → { viaId, posicion: [lon,lat], angulo }[]`.

- [ ] **Step 1: Escribir los tests**

`tests/ui/estilosVia.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { TIPOS_VIA } from '../../src/sim/tipos.js';
import { COLOR_TIPO, ANCHO_TIPO, colorVia, anchoVia, flechasDeVias } from '../../src/ui/mapa/estilosVia.js';

const via = (extra) => ({
  id: 'v', geometria: [[-73.137, 6.555], [-73.136, 6.555]], longitud: 110.5,
  tipo: 'un_sentido', sentido: 'adelante', ...extra,
});

describe('estilos de vía', () => {
  it('todo tipo tiene color y ancho', () => {
    for (const tipo of TIPOS_VIA) {
      expect(COLOR_TIPO[tipo]).toHaveLength(3);
      expect(ANCHO_TIPO[tipo]).toBeGreaterThan(0);
      expect(colorVia({ tipo })).toEqual(COLOR_TIPO[tipo]);
      expect(anchoVia({ tipo })).toBe(ANCHO_TIPO[tipo]);
    }
  });

  it('la Avenida Nacional es más ancha que una calle', () => {
    expect(ANCHO_TIPO.avenida_nacional).toBeGreaterThan(ANCHO_TIPO.un_sentido);
  });
});

describe('flechasDeVias', () => {
  it('pone una flecha en la mitad de cada vía de un sentido, apuntando hacia hasta', () => {
    const [flecha, ...resto] = flechasDeVias([via()]);
    expect(resto).toEqual([]);
    expect(flecha.viaId).toBe('v');
    expect(flecha.posicion[0]).toBeCloseTo(-73.1365, 6);
    expect(flecha.angulo).toBeCloseTo(0, 6);
  });

  it('no pone flechas en vías de doble sentido', () => {
    expect(flechasDeVias([via({ sentido: 'ambos' })])).toEqual([]);
  });

  it('no pone flechas en vías muy cortas', () => {
    expect(flechasDeVias([via({ longitud: 10 })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- tests/ui/estilosVia.test.js`
Expected: FAIL, no se puede resolver `src/ui/mapa/estilosVia.js`.

- [ ] **Step 3: Implementar `src/ui/mapa/estilosVia.js`**

```js
import { longitudLinea, puntoALoLargo, anguloPantalla } from '../../sim/geo.js';

export const COLOR_TIPO = {
  avenida_nacional: [214, 69, 65],
  variante: [142, 68, 173],
  doble_calzada: [230, 126, 34],
  glorieta: [39, 174, 96],
  doble_sentido: [52, 101, 164],
  un_sentido: [93, 109, 126],
};

export const COLOR_PUENTE = [241, 196, 15];
export const COLOR_PARE = [192, 57, 43];
export const COLOR_SELECCION = [20, 20, 20];

export const ANCHO_TIPO = {
  avenida_nacional: 7,
  variante: 7,
  doble_calzada: 6,
  glorieta: 5,
  doble_sentido: 4,
  un_sentido: 4,
};

export const colorVia = (via) => COLOR_TIPO[via.tipo];
export const anchoVia = (via) => ANCHO_TIPO[via.tipo];

export function flechasDeVias(vias, { longitudMinima = 25 } = {}) {
  const flechas = [];
  for (const via of vias) {
    if (via.sentido !== 'adelante' || via.longitud < longitudMinima) continue;
    const { posicion, segmento } = puntoALoLargo(via.geometria, longitudLinea(via.geometria) / 2);
    const angulo = anguloPantalla(via.geometria[segmento], via.geometria[segmento + 1]);
    flechas.push({ viaId: via.id, posicion, angulo });
  }
  return flechas;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- tests/ui/estilosVia.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/mapa/estilosVia.js tests/ui/estilosVia.test.js
git commit -m "feat(ui): colores por tipo de vía y flechas de sentido"
```

---

### Task 7: Mapa de San Gil con leyenda y ficha de vía

**Files:**
- Create: `src/ui/mapa/MapaSanGil.jsx`, `src/ui/paneles/Leyenda.jsx`, `src/ui/paneles/FichaVia.jsx`, `src/ui/estilos.css`
- Modify: `src/ui/App.jsx` (reemplazo completo), `.claude/contexto/estado.md`, `.claude/contexto/bitacora.md`

**Interfaces:**
- Consumes: `cargarRed` (Task 5); `colorVia`, `anchoVia`, `flechasDeVias`, `COLOR_TIPO`, `COLOR_PUENTE`, `COLOR_PARE`, `COLOR_SELECCION` (Task 6); `ETIQUETA_TIPO`, `TIPOS_VIA` (Task 1).
- Produces:
  - `<MapaSanGil red={Red} viaSeleccionada={string|null} onSeleccionarVia={(id|null) => void} />`
  - `<Leyenda />`
  - `<FichaVia via={Via} onCerrar={() => void} />`

Esta tarea es interfaz y se verifica en el navegador, no con tests automáticos.

- [ ] **Step 1: Crear `src/ui/mapa/MapaSanGil.jsx`**

```jsx
import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { PathLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  colorVia, anchoVia, flechasDeVias, COLOR_PUENTE, COLOR_PARE, COLOR_SELECCION,
} from './estilosVia.js';

const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron';
const VISTA_INICIAL = { longitude: -73.134, latitude: 6.555, zoom: 14.5, pitch: 0, bearing: 0 };
const PUNTEADO = new PathStyleExtension({ dash: true });

export default function MapaSanGil({ red, viaSeleccionada, onSeleccionarVia }) {
  const vias = useMemo(() => [...red.vias.values()], [red]);
  const puentes = useMemo(() => vias.filter((v) => v.esPuente), [vias]);
  const flechas = useMemo(() => flechasDeVias(vias), [vias]);
  const pares = useMemo(() => [...red.nodos.values()].filter((n) => n.control === 'pare'), [red]);

  const capas = [
    new PathLayer({
      id: 'puentes',
      data: puentes,
      getPath: (v) => v.geometria,
      getColor: COLOR_PUENTE,
      getWidth: (v) => anchoVia(v) + 6,
      widthUnits: 'pixels',
      capRounded: true,
    }),
    new PathLayer({
      id: 'vias',
      data: vias,
      getPath: (v) => v.geometria,
      getColor: (v) => (v.id === viaSeleccionada ? COLOR_SELECCION : colorVia(v)),
      getWidth: anchoVia,
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      pickable: true,
      getDashArray: (v) => (v.enConstruccion ? [4, 3] : [0, 0]),
      dashJustified: true,
      extensions: [PUNTEADO],
      updateTriggers: { getColor: viaSeleccionada },
    }),
    new TextLayer({
      id: 'flechas',
      data: flechas,
      getPosition: (f) => f.posicion,
      getText: () => '▶',
      getAngle: (f) => f.angulo,
      getSize: 11,
      getColor: [255, 255, 255],
      characterSet: ['▶'],
    }),
    new ScatterplotLayer({
      id: 'pares',
      data: pares,
      getPosition: (n) => [n.lon, n.lat],
      getRadius: 5,
      radiusUnits: 'pixels',
      getFillColor: COLOR_PARE,
      getLineColor: [255, 255, 255],
      stroked: true,
      lineWidthMinPixels: 1.5,
    }),
  ];

  return (
    <DeckGL
      initialViewState={VISTA_INICIAL}
      controller
      layers={capas}
      onClick={(info) => onSeleccionarVia(info.object?.id ?? null)}
      getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
    >
      <Map mapStyle={ESTILO_MAPA} />
    </DeckGL>
  );
}
```

- [ ] **Step 2: Crear `src/ui/paneles/Leyenda.jsx`**

```jsx
import { TIPOS_VIA, ETIQUETA_TIPO } from '../../sim/tipos.js';
import { COLOR_TIPO, COLOR_PUENTE, COLOR_PARE } from '../mapa/estilosVia.js';

const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

export default function Leyenda() {
  return (
    <section className="panel leyenda">
      <h2>Tipos de vía</h2>
      <ul>
        {TIPOS_VIA.map((tipo) => (
          <li key={tipo}>
            <span className="muestra-linea" style={{ background: rgb(COLOR_TIPO[tipo]) }} />
            {ETIQUETA_TIPO[tipo]}
          </li>
        ))}
        <li>
          <span className="muestra-linea" style={{ background: rgb(COLOR_PUENTE) }} />
          Puente
        </li>
        <li>
          <span className="muestra-linea punteada" />
          En construcción
        </li>
        <li>
          <span className="muestra-punto" style={{ background: rgb(COLOR_PARE) }} />
          Pare
        </li>
        <li>
          <span className="muestra-flecha">▶</span>
          Sentido de circulación
        </li>
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Crear `src/ui/paneles/FichaVia.jsx`**

```jsx
import { ETIQUETA_TIPO } from '../../sim/tipos.js';

const SUPERFICIE = { pavimento: 'Pavimento', adoquin: 'Adoquín', destapado: 'Destapada' };
const ESTADO = { bueno: 'Bueno', regular: 'Regular', huecos: 'Con huecos' };

export default function FichaVia({ via, onCerrar }) {
  const filas = [
    ['Tipo', ETIQUETA_TIPO[via.tipo]],
    ['Sentido', via.sentido === 'ambos' ? 'Doble' : 'Único'],
    ['Carriles por sentido', via.carrilesPorSentido],
    ['Superficie', SUPERFICIE[via.superficie]],
    ['Estado', ESTADO[via.estado]],
    ['Velocidad máxima', `${via.velocidadMax} km/h`],
    ['Longitud', `${via.longitud} m`],
    ['Puente', via.esPuente ? 'Sí' : 'No'],
    ['En construcción', via.enConstruccion ? 'Sí' : 'No'],
  ];

  return (
    <section className="panel ficha">
      <header>
        <h2>{via.nombre || '(vía sin nombre)'}</h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar ficha">×</button>
      </header>
      <dl>
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <a href={`https://www.openstreetmap.org/way/${via.osmId}`} target="_blank" rel="noreferrer">
        Ver en OpenStreetMap
      </a>
      <p className="nota">La edición de vías llega en la etapa 3.</p>
    </section>
  );
}
```

- [ ] **Step 4: Reemplazar `src/ui/App.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { cargarRed } from './datos/cargarRed.js';
import MapaSanGil from './mapa/MapaSanGil.jsx';
import Leyenda from './paneles/Leyenda.jsx';
import FichaVia from './paneles/FichaVia.jsx';
import './estilos.css';

export default function App() {
  const [red, setRed] = useState(null);
  const [error, setError] = useState(null);
  const [viaSeleccionada, setViaSeleccionada] = useState(null);

  useEffect(() => {
    cargarRed().then(setRed).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <main className="pantalla-mensaje">
        <h1>No se pudo cargar el mapa</h1>
        <pre>{error}</pre>
      </main>
    );
  }
  if (!red) {
    return <main className="pantalla-mensaje"><p>Cargando la red vial de San Gil…</p></main>;
  }

  const via = viaSeleccionada ? red.vias.get(viaSeleccionada) : null;

  return (
    <div className="app">
      <header className="barra">
        <h1>Simulador de tráfico · San Gil</h1>
        <span>{red.vias.size} vías · {red.nodos.size} cruces</span>
      </header>
      <div className="contenido">
        <MapaSanGil red={red} viaSeleccionada={viaSeleccionada} onSeleccionarVia={setViaSeleccionada} />
        <aside className="lateral">
          <Leyenda />
          {via && <FichaVia via={via} onCerrar={() => setViaSeleccionada(null)} />}
        </aside>
        <footer className="atribucion">{red.meta.fuente}</footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Crear `src/ui/estilos.css`**

```css
:root {
  --fondo: #f5f6f8;
  --panel: #ffffff;
  --texto: #1f2933;
  --tenue: #6b7785;
  --borde: #dfe3e8;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: var(--texto);
}

* { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; }
body { background: var(--fondo); }

.app { display: flex; flex-direction: column; height: 100%; }

.barra {
  display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
  padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--borde);
}
.barra h1 { margin: 0; font-size: 18px; }
.barra span { color: var(--tenue); font-size: 14px; }

.contenido { position: relative; flex: 1; }

.lateral {
  position: absolute; top: 12px; right: 12px; width: 280px;
  display: flex; flex-direction: column; gap: 12px;
  max-height: calc(100% - 24px); overflow-y: auto; z-index: 1;
}

.panel {
  background: var(--panel); border: 1px solid var(--borde); border-radius: 8px;
  padding: 12px 14px; box-shadow: 0 2px 8px rgb(0 0 0 / 0.08);
}
.panel h2 { margin: 0 0 8px; font-size: 15px; }

.leyenda ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 13px; }
.leyenda li { display: flex; align-items: center; gap: 8px; }
.muestra-linea { width: 24px; height: 5px; border-radius: 3px; }
.muestra-linea.punteada {
  background: repeating-linear-gradient(90deg, #8e44ad 0 6px, transparent 6px 10px);
}
.muestra-punto { width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid #fff; }
.muestra-flecha { width: 24px; text-align: center; color: #5d6d7e; font-size: 11px; }

.ficha header { display: flex; justify-content: space-between; align-items: start; gap: 8px; }
.ficha header button {
  border: none; background: none; font-size: 20px; line-height: 1; cursor: pointer; color: var(--tenue);
}
.ficha dl { margin: 0 0 10px; display: grid; gap: 4px; font-size: 13px; }
.ficha dl div { display: flex; justify-content: space-between; gap: 8px; }
.ficha dt { color: var(--tenue); }
.ficha dd { margin: 0; font-weight: 500; text-align: right; }
.ficha a { font-size: 13px; }
.nota { margin: 8px 0 0; font-size: 12px; color: var(--tenue); }

.atribucion {
  position: absolute; left: 8px; bottom: 8px; z-index: 1;
  background: rgb(255 255 255 / 0.85); padding: 2px 6px; border-radius: 4px;
  font-size: 11px; color: var(--tenue);
}

.pantalla-mensaje {
  height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 16px; text-align: center;
}
.pantalla-mensaje pre { white-space: pre-wrap; max-width: 640px; color: #c0392b; }

@media (max-width: 640px) {
  .lateral { left: 12px; right: 12px; width: auto; top: auto; bottom: 36px; max-height: 45%; }
}
```

- [ ] **Step 6: Verificar en el navegador**

Run: `npm run dev` y abrir http://localhost:5173.

Revisar uno por uno:
- [ ] El mapa base carga centrado en San Gil.
- [ ] Las vías se ven encima, con colores distintos por tipo; la Avenida Nacional es la más gruesa.
- [ ] Los puentes sobre el Fonce tienen el borde amarillo.
- [ ] Las vías de un sentido muestran flechas blancas que apuntan en la dirección de circulación; las de doble sentido no tienen flechas.
- [ ] Si OSM tiene pares, aparecen como puntos rojos en los cruces.
- [ ] Si hay tramos en construcción, se ven punteados.
- [ ] Al hacer clic en una vía se resalta en negro y se abre su ficha con nombre, tipo, sentido, carriles, superficie, estado, velocidad, longitud y puente.
- [ ] El enlace "Ver en OpenStreetMap" abre la vía correcta.
- [ ] Al hacer clic en el mapa vacío o en × se cierra la ficha.
- [ ] La atribución de OpenStreetMap se ve abajo a la izquierda.
- [ ] Con la ventana a 375 px de ancho no aparece barra de desplazamiento horizontal.

Prueba del error: renombrar temporalmente `public/data/red-sangil.json`, recargar y verificar que aparece "No se pudo cargar el mapa" con la indicación `npm run red`. Restaurar el nombre.

- [ ] **Step 7: Verificar build y tests**

Run: `npm test && npm run build`
Expected: todos los tests en PASS y `✓ built in ...`.

- [ ] **Step 8: Actualizar el contexto de sesiones**

En `.claude/contexto/estado.md`, reemplazar las secciones "Hecho" y "Sigue":

```markdown
## Hecho
- Spec aprobado.
- Etapa 1 completa: red de San Gil descargada de OSM, convertida a grafo y dibujada en el mapa por tipo de vía, con fichas de solo lectura.

## Sigue
- Escribir el plan de la etapa 2 (motor: vehículos, IDM, cruces, rutas, demanda) a partir de la red real.
- Revisar con el usuario qué vías salieron mal clasificadas en OSM.
```

Agregar en `.claude/contexto/bitacora.md` una entrada con la fecha del día, el número de vías y nodos que dio `npm run red`, si la Variante apareció o no en OSM, y "Etapa 1 completa".

- [ ] **Step 9: Commit**

```bash
git add src/ui .claude/contexto
git commit -m "feat(ui): mapa de San Gil por tipo de vía con leyenda y ficha"
```
