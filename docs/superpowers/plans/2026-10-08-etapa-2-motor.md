# Etapa 2 · Motor de simulación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el tráfico se mueva en el mapa de San Gil: motos, carros, busetas, buses y camiones que siguen al de adelante (IDM), cambian de carril (MOBIL), respetan pares, prioridad y regla de la derecha, escogen la ruta más rápida con tiempos medidos y generan métricas en vivo.

**Architecture:** El motor (`src/sim/`) es JavaScript puro, determinista con semilla, y avanza en pasos de 0,5 s. Corre dentro de un Web Worker controlado por `src/worker/controlador.js`, que envía las posiciones de los vehículos (≈20 cuadros por segundo) y un resumen de métricas cada segundo. La interfaz React dibuja los vehículos con deck.gl y agrega reloj, controles de demanda y panel de métricas.

**Tech Stack:** Node 24, Vite 5, React 18, deck.gl 9.0, MapLibre 4, Vitest 2. JavaScript, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-08-simulador-trafico-sangil-design.md` (secciones 5, 6 y 10)

Etapa 2 de 5. Fuera de esta etapa: editor de vías y cruces (etapa 3), restricción de pesados de paso al terminar la Variante (etapa 3, junto con "terminar obra"), escenarios, comparador y modo historia (etapa 4).

## Global Constraints

- JavaScript, **no TypeScript**.
- `src/sim/` no importa React ni APIs del navegador (`window`, `document`, `Worker`, `performance`).
- Paso fijo de **0,5 s** simulados. **Semilla fija**: la misma entrada produce la misma corrida.
- San Gil **no tiene semáforos**: el semáforo existe en el motor solo para cuando el usuario lo agregue (etapa 3).
- El control de pare es **por acceso** (`nodo.accesosConPare`); si un nodo con `control: 'pare'` no tiene esa lista, el pare aplica a los accesos de menor jerarquía (o a todos si son iguales).
- Sin costos en pesos.
- Textos de la interfaz en español de Colombia.
- La simulación corre en un Web Worker; la interfaz nunca corre el motor en el hilo principal.

## Review Focus

1. Viajes cuyo origen y destino no se conectan respetando sentidos (nodos fuera del componente principal): se cuentan como "viajes imposibles" y nunca rompen el motor (test en Task 9).
2. Vías más cortas que un vehículo o que lo que avanza en un paso (OSM tiene tramos de pocos metros): el vehículo no salta dos cruces en un paso ni produce posiciones `NaN` (test en Task 9).
3. Cruce sin señal con cuatro vehículos llegando a la vez, cada uno cediendo al de su derecha: se resuelve por cortesía y no queda trabado (test en Task 10).
4. Una ruta que se vuelve imposible en plena marcha (se cierran todas las salidas): el vehículo se libera como "bloqueo" sin colgar la simulación (test en Task 10).
5. El worker recibe órdenes antes de iniciar, o una red inválida: no se cae y responde un error legible (test en Task 12).

---

## Contratos de esta etapa

**Vehículo (objeto interno del motor):**

```
{ id, tipo, tipoIndice, perfil, conductor, ruta: arcoId[], i, s, v, a, carril, destino,
  tSalida, tEntradaArco, tiempoLibre, permiso, paroEnPare, esperaCruce,
  quietoDesde, transferidoEn, proximoReruteo }
```

- `ruta[i]` es el arco en que va; `s` son los metros recorridos de ese arco (posición del frente del vehículo).
- `permiso`: ya tiene paso para el próximo cruce.

**Acceso a un cruce** (uno por arco que entra a un nodo): `{ tipo: 'prioridad'|'cede'|'pare'|'derecha'|'semaforo', conflictos: arcoId[], grupo: 0|1, nodo }`.

**Mensajes del worker:**

- Entrada: `{ tipo: 'iniciar', datosRed, opciones }`, `{ tipo: 'reloj', corriendo, velocidad }` (velocidad `1 | 5 | 20 | 'max'`), `{ tipo: 'demanda', parcial }`.
- Salida: `{ tipo: 'cuadro', t, cantidad, datos: Float64Array }` (3 números por vehículo: lon, lat, tipoIndice), `{ tipo: 'resumen', resumen, vias: [{ viaId, ratio, vehiculos }] }`, `{ tipo: 'error', mensaje }`.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/sim/aleatorio.js` | Generador aleatorio con semilla |
| `src/sim/vehiculos.js` | Tipos, perfiles IDM, efecto del estado de la vía |
| `src/sim/idm.js` | Aceleración IDM y avance en un paso |
| `src/sim/geometriaArcos.js` | Largo y posición sobre cada arco |
| `src/sim/rutas.js` | Dijkstra y tiempos de viaje medidos |
| `src/sim/cruces.js` | Tipo de acceso, conflictos y permiso de paso |
| `src/sim/mobil.js` | Decisión de cambio de carril |
| `src/escenarios/zonas.js` | Zonas y salidas reales de San Gil |
| `src/sim/demanda.js` | Generación de viajes por flujo |
| `src/sim/metricas.js` | Acumulación de métricas |
| `src/sim/motor.js` | El ciclo de simulación |
| `src/worker/controlador.js` | Lógica del worker (probada sin navegador) |
| `src/worker/simulacion.worker.js` | Conecta el controlador con `self` |
| `src/worker/clienteSimulacion.js` | Lado de la interfaz del worker |
| `src/ui/formato.js` | Hora y duraciones legibles |
| `src/ui/mapa/estilosVehiculo.js` | Colores de vehículos y de congestión |
| `src/ui/paneles/BarraTiempo.jsx`, `PanelTrafico.jsx`, `PanelMetricas.jsx` | Controles y métricas |
| `tests/sim/redesPrueba.js` | Redes pequeñas para las pruebas |

---

### Task 1: Aleatorio con semilla y perfiles de vehículo

**Files:**
- Create: `src/sim/aleatorio.js`, `src/sim/vehiculos.js`
- Test: `tests/sim/aleatorio.test.js`, `tests/sim/vehiculos.test.js`

**Interfaces:**
- Produces:
  - `crearAleatorio(semilla: number) → { siguiente(): number en [0,1), entre(min, max), entero(n), elegir(lista), elegirPonderado(pesos: Record<string, number>): string, exponencial(tasa): number }`
  - `TIPOS_VEHICULO = ['moto','carro','buseta','bus_nacional','bus_intermunicipal','camion']`, `ETIQUETA_VEHICULO`, `PERFILES[tipo] = { largo, vMax, a, b, T, s0, hueco }`, `FACTOR_SUPERFICIE`, `FACTOR_ESTADO`, `factorVia(via)`, `crearConductor(aleatorio) → { agresividad, toleranciaHuecos }`, `CONDUCTOR_NEUTRO`, `velocidadDeseada(perfil, via, conductor?) → m/s`, `velocidadReferencia(via) → m/s`.

- [ ] **Step 1: Escribir los tests**

`tests/sim/aleatorio.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearAleatorio } from '../../src/sim/aleatorio.js';

describe('crearAleatorio', () => {
  it('la misma semilla da la misma secuencia', () => {
    const a = crearAleatorio(42);
    const b = crearAleatorio(42);
    const sa = Array.from({ length: 5 }, () => a.siguiente());
    const sb = Array.from({ length: 5 }, () => b.siguiente());
    expect(sa).toEqual(sb);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('semillas distintas dan secuencias distintas', () => {
    expect(crearAleatorio(1).siguiente()).not.toBe(crearAleatorio(2).siguiente());
  });

  it('entre, entero y elegir respetan sus rangos', () => {
    const r = crearAleatorio(7);
    for (let k = 0; k < 200; k++) {
      const x = r.entre(2, 3);
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThan(3);
      expect(r.entero(4)).toBeLessThan(4);
      expect(['a', 'b']).toContain(r.elegir(['a', 'b']));
    }
  });

  it('elegirPonderado nunca escoge un peso 0', () => {
    const r = crearAleatorio(3);
    for (let k = 0; k < 100; k++) expect(r.elegirPonderado({ a: 0, b: 1 })).toBe('b');
  });

  it('exponencial tiene media 1/tasa', () => {
    const r = crearAleatorio(9);
    let suma = 0;
    for (let k = 0; k < 20000; k++) suma += r.exponencial(0.5);
    expect(suma / 20000).toBeGreaterThan(1.9);
    expect(suma / 20000).toBeLessThan(2.1);
  });
});
```

`tests/sim/vehiculos.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  TIPOS_VEHICULO, ETIQUETA_VEHICULO, PERFILES, velocidadDeseada, velocidadReferencia,
  crearConductor, CONDUCTOR_NEUTRO,
} from '../../src/sim/vehiculos.js';
import { crearAleatorio } from '../../src/sim/aleatorio.js';

const via = (extra = {}) => ({ velocidadMax: 30, superficie: 'pavimento', estado: 'bueno', ...extra });

describe('perfiles de vehículo', () => {
  it('todo tipo tiene perfil completo y etiqueta', () => {
    for (const tipo of TIPOS_VEHICULO) {
      const p = PERFILES[tipo];
      for (const campo of ['largo', 'vMax', 'a', 'b', 'T', 's0', 'hueco']) expect(p[campo]).toBeGreaterThan(0);
      expect(ETIQUETA_VEHICULO[tipo]).toBeTruthy();
    }
  });

  it('la moto es la más corta y ágil; el camión el más largo y lento', () => {
    expect(PERFILES.moto.largo).toBeLessThan(PERFILES.carro.largo);
    expect(PERFILES.moto.hueco).toBeLessThan(PERFILES.carro.hueco);
    expect(PERFILES.camion.largo).toBeGreaterThan(PERFILES.bus_nacional.largo);
    expect(PERFILES.camion.a).toBeLessThan(PERFILES.carro.a);
  });
});

describe('velocidadDeseada', () => {
  it('en vía buena es el límite de la vía', () => {
    expect(velocidadDeseada(PERFILES.carro, via())).toBeCloseTo(30 / 3.6, 6);
  });

  it('el estado y la superficie la reducen', () => {
    const buena = velocidadDeseada(PERFILES.carro, via());
    const regular = velocidadDeseada(PERFILES.carro, via({ estado: 'regular' }));
    const huecos = velocidadDeseada(PERFILES.carro, via({ estado: 'huecos' }));
    const destapada = velocidadDeseada(PERFILES.carro, via({ superficie: 'destapado' }));
    expect(regular).toBeLessThan(buena);
    expect(huecos).toBeLessThan(regular);
    expect(destapada).toBeLessThan(buena);
  });

  it('el vehículo no supera su propia velocidad máxima', () => {
    expect(velocidadDeseada(PERFILES.camion, via({ velocidadMax: 50 }))).toBe(PERFILES.camion.vMax);
  });

  it('nunca baja de 1 m/s', () => {
    expect(velocidadDeseada(PERFILES.carro, via({ velocidadMax: 1, estado: 'huecos', superficie: 'destapado' }))).toBe(1);
  });

  it('con huecos los conductores se dispersan más que en vía buena', () => {
    const r = crearAleatorio(11);
    const conductores = Array.from({ length: 50 }, () => crearConductor(r));
    const rango = (estado) => {
      const vs = conductores.map((c) => velocidadDeseada(PERFILES.carro, via({ estado }), c));
      return Math.max(...vs) / Math.min(...vs);
    };
    expect(rango('huecos')).toBeGreaterThan(rango('bueno'));
  });

  it('la velocidad de referencia es la de un carro con conductor neutro', () => {
    expect(velocidadReferencia(via())).toBe(velocidadDeseada(PERFILES.carro, via(), CONDUCTOR_NEUTRO));
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/sim/aleatorio.test.js tests/sim/vehiculos.test.js`
Expected: FAIL, no se pueden resolver `src/sim/aleatorio.js` ni `src/sim/vehiculos.js`.

- [ ] **Step 3: Implementar `src/sim/aleatorio.js`**

```js
// Generador pseudoaleatorio con semilla (mulberry32). Con la misma semilla
// la simulación da exactamente el mismo resultado: así se comparan escenarios.

export function crearAleatorio(semilla) {
  let estado = semilla >>> 0;

  const siguiente = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let x = estado;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  return {
    siguiente,
    entre: (min, max) => min + (max - min) * siguiente(),
    entero: (n) => Math.floor(siguiente() * n),
    elegir: (lista) => lista[Math.floor(siguiente() * lista.length)],
    elegirPonderado(pesos) {
      const entradas = Object.entries(pesos);
      const total = entradas.reduce((suma, [, p]) => suma + p, 0);
      let r = siguiente() * total;
      for (const [clave, peso] of entradas) {
        r -= peso;
        if (r < 0) return clave;
      }
      return entradas.filter(([, p]) => p > 0).at(-1)[0];
    },
    exponencial: (tasa) => -Math.log(1 - siguiente()) / tasa,
  };
}
```

- [ ] **Step 4: Implementar `src/sim/vehiculos.js`**

```js
// Tipos de vehículo y su comportamiento. Los parámetros siguen el Intelligent
// Driver Model (IDM): largo y s0 en metros, vMax en m/s, a y b en m/s², T y
// hueco en segundos. Son supuestos razonables, documentados en "Cómo funciona".

export const TIPOS_VEHICULO = ['moto', 'carro', 'buseta', 'bus_nacional', 'bus_intermunicipal', 'camion'];

export const ETIQUETA_VEHICULO = {
  moto: 'Moto',
  carro: 'Carro / taxi',
  buseta: 'Buseta',
  bus_nacional: 'Bus nacional',
  bus_intermunicipal: 'Bus intermunicipal',
  camion: 'Camión / tractomula',
};

// a: aceleración máxima · b: frenado cómodo · T: tiempo de seguridad
// s0: distancia mínima parado · hueco: tiempo mínimo para cruzar ante otro vehículo
export const PERFILES = {
  moto: { largo: 2.0, vMax: 16.7, a: 2.5, b: 3.0, T: 1.0, s0: 1.0, hueco: 2.0 },
  carro: { largo: 4.5, vMax: 16.7, a: 1.5, b: 2.5, T: 1.4, s0: 2.0, hueco: 3.0 },
  buseta: { largo: 7.0, vMax: 13.9, a: 1.0, b: 2.0, T: 1.6, s0: 2.5, hueco: 3.5 },
  bus_nacional: { largo: 12.0, vMax: 13.9, a: 0.8, b: 1.8, T: 1.8, s0: 3.0, hueco: 4.5 },
  bus_intermunicipal: { largo: 10.0, vMax: 13.9, a: 0.8, b: 1.8, T: 1.8, s0: 3.0, hueco: 4.5 },
  camion: { largo: 16.5, vMax: 12.5, a: 0.5, b: 1.5, T: 2.0, s0: 3.5, hueco: 5.5 },
};

export const FACTOR_SUPERFICIE = { pavimento: 1, adoquin: 0.85, destapado: 0.6 };
export const FACTOR_ESTADO = { bueno: 1, regular: 0.8, huecos: 0.5 };

export const factorVia = (via) => FACTOR_SUPERFICIE[via.superficie] * FACTOR_ESTADO[via.estado];

export const CONDUCTOR_NEUTRO = { agresividad: 1, toleranciaHuecos: 1 };

// Cada conductor maneja un poco distinto; en una vía con huecos la diferencia
// es mayor (unos esquivan despacio, otros pasan rápido).
export function crearConductor(aleatorio) {
  return {
    agresividad: aleatorio.entre(0.9, 1.1),
    toleranciaHuecos: aleatorio.entre(0.7, 1.3),
  };
}

export function velocidadDeseada(perfil, via, conductor = CONDUCTOR_NEUTRO) {
  let factor = factorVia(via);
  if (via.estado === 'huecos') factor *= conductor.toleranciaHuecos;
  const limite = Math.min(perfil.vMax, (via.velocidadMax / 3.6) * conductor.agresividad);
  return Math.max(1, limite * factor);
}

export const velocidadReferencia = (via) => velocidadDeseada(PERFILES.carro, via, CONDUCTOR_NEUTRO);
```

- [ ] **Step 5: Correr y verificar que pasan**

Run: `npx vitest run tests/sim/aleatorio.test.js tests/sim/vehiculos.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sim/aleatorio.js src/sim/vehiculos.js tests/sim/aleatorio.test.js tests/sim/vehiculos.test.js
git commit -m "feat(sim): aleatorio con semilla y perfiles de vehículo"
```

---

### Task 2: Seguimiento del vehículo de adelante (IDM)

**Files:**
- Create: `src/sim/idm.js`
- Test: `tests/sim/idm.test.js`

**Interfaces:**
- Consumes: `PERFILES` (Task 1).
- Produces: `aceleracionIDM(perfil, v, v0, gap, vLider) → m/s²` (con `gap = Infinity` si no hay nadie adelante; nunca menor que −9); `avanzar(v, a, dt) → { v, dx }` (nunca velocidad negativa).

- [ ] **Step 1: Escribir los tests**

`tests/sim/idm.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { aceleracionIDM, avanzar } from '../../src/sim/idm.js';
import { PERFILES } from '../../src/sim/vehiculos.js';

const carro = PERFILES.carro;

describe('aceleracionIDM', () => {
  it('sin nadie adelante acelera al máximo desde parado y deja de acelerar a su velocidad deseada', () => {
    expect(aceleracionIDM(carro, 0, 10, Infinity, 10)).toBeCloseTo(carro.a, 6);
    expect(aceleracionIDM(carro, 10, 10, Infinity, 10)).toBeCloseTo(0, 6);
  });

  it('nunca frena más fuerte que 9 m/s²', () => {
    expect(aceleracionIDM(carro, 15, 15, 0.001, 0)).toBe(-9);
  });

  it('frena hasta detenerse antes de un obstáculo quieto, sin atravesarlo', () => {
    let x = 0;
    let v = 10;
    const obstaculo = 100;
    for (let k = 0; k < 120; k++) {
      const a = aceleracionIDM(carro, v, 10, obstaculo - x, 0);
      const paso = avanzar(v, a, 0.5);
      v = paso.v;
      x += paso.dx;
      expect(obstaculo - x).toBeGreaterThan(0);
    }
    expect(v).toBeLessThan(0.1);
    expect(obstaculo - x).toBeLessThan(carro.s0 + 1);
  });

  it('detrás de un líder constante converge a su velocidad y a la distancia s0 + vT', () => {
    let xLider = 50;
    let x = 0;
    let v = 0;
    for (let k = 0; k < 480; k++) {
      const a = aceleracionIDM(carro, v, 15, xLider - carro.largo - x, 8);
      const paso = avanzar(v, a, 0.5);
      v = paso.v;
      x += paso.dx;
      xLider += 8 * 0.5;
    }
    expect(v).toBeCloseTo(8, 0);
    const brecha = xLider - carro.largo - x;
    expect(brecha).toBeGreaterThan(carro.s0 + 8 * carro.T - 1.5);
    expect(brecha).toBeLessThan(carro.s0 + 8 * carro.T + 1.5);
  });
});

describe('avanzar', () => {
  it('integra con aceleración constante', () => {
    expect(avanzar(10, 2, 0.5)).toEqual({ v: 11, dx: 5.25 });
  });

  it('si el frenado lo detendría a mitad de paso, se detiene sin retroceder', () => {
    const r = avanzar(1, -9, 0.5);
    expect(r.v).toBe(0);
    expect(r.dx).toBeCloseTo(1 / 18, 6);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/sim/idm.test.js`
Expected: FAIL, no se puede resolver `src/sim/idm.js`.

- [ ] **Step 3: Implementar `src/sim/idm.js`**

```js
// Intelligent Driver Model (Treiber, Hennecke y Helbing, 2000).
//   a_IDM = a · [ 1 − (v/v0)^4 − (s*/s)^2 ]
//   s*    = s0 + v·T + v·Δv / (2·√(a·b))
// gap = metros libres hasta la cola del vehículo de adelante (o el obstáculo).

const FRENADO_MAXIMO = -9; // m/s², límite físico de un frenado de emergencia

export function aceleracionIDM(perfil, v, v0, gap, vLider) {
  const terminoLibre = 1 - (v / v0) ** 4;
  if (!Number.isFinite(gap)) return perfil.a * terminoLibre;
  const deseada = perfil.s0
    + Math.max(0, v * perfil.T + (v * (v - vLider)) / (2 * Math.sqrt(perfil.a * perfil.b)));
  const s = Math.max(gap, 0.01);
  return Math.max(FRENADO_MAXIMO, perfil.a * (terminoLibre - (deseada / s) ** 2));
}

// Avance de un paso con aceleración constante. Si el frenado lo detiene antes
// de terminar el paso, se detiene ahí: los vehículos nunca retroceden.
export function avanzar(v, a, dt) {
  const vNueva = v + a * dt;
  if (vNueva < 0) return { v: 0, dx: a < 0 ? (v * v) / (-2 * a) : 0 };
  return { v: vNueva, dx: v * dt + 0.5 * a * dt * dt };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/sim/idm.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/idm.js tests/sim/idm.test.js
git commit -m "feat(sim): seguimiento del vehículo de adelante con IDM"
```

---

### Task 3: Geometría de los arcos y redes de prueba

**Files:**
- Create: `src/sim/geometriaArcos.js`, `tests/sim/redesPrueba.js`
- Test: `tests/sim/geometriaArcos.test.js`

**Interfaces:**
- Consumes: `crearRed` (`src/sim/red.js`), `distanciaMetros`, `longitudLinea` (`src/sim/geo.js`).
- Produces:
  - `prepararGeometria(red) → Map<arcoId, { coords, acumulado: number[], largo }>` (coords invertidas en arcos `<`).
  - `posicionEnArco(geo, s, lateral = 0) → [lon, lat]` (lateral en metros, positivo a la derecha del sentido de marcha; `s` se limita al arco).
  - `direccionLlegada(geo) → [dx, dy]` unitario del último tramo (x al este, y al norte).
  - Redes de prueba (`tests/sim/redesPrueba.js`): `punto(x, y)`, `viaEntre(id, nodos, desde, hasta, extra)`, `armarDatos(nodos, vias, controles)`, `armarRed(...)`, `datosRedLinea(opciones)`, `redLinea(opciones)`, `redCruce(opciones)`, `redDosRutas()`.

- [ ] **Step 1: Crear `tests/sim/redesPrueba.js`**

```js
// Redes pequeñas, en metros, para probar el motor sin depender de OSM.
// x crece al este e y al norte, alrededor de San Gil.

import { crearRed } from '../../src/sim/red.js';
import { longitudLinea } from '../../src/sim/geo.js';

const LAT = 6.555;
const M_LON = 111320 * Math.cos((LAT * Math.PI) / 180);
const M_LAT = 110574;

export const punto = (x, y) => [-73.14 + x / M_LON, LAT + y / M_LAT];

export function viaEntre(id, nodos, desde, hasta, extra = {}) {
  const geometria = [punto(...nodos[desde]), punto(...nodos[hasta])];
  return {
    id, osmId: 1, nombre: id, desde, hasta, geometria,
    longitud: Math.round(longitudLinea(geometria) * 10) / 10,
    tipo: 'un_sentido', sentido: 'adelante', carrilesPorSentido: 1,
    superficie: 'pavimento', estado: 'bueno', velocidadMax: 30,
    abierta: true, enConstruccion: false, esPuente: false,
    ...extra,
  };
}

export function armarDatos(nodos, vias, controles = {}) {
  return {
    version: 1, generado: 'prueba', fuente: 'prueba',
    bbox: { sur: 6.54, oeste: -73.16, norte: 6.57, este: -73.12 },
    nodos: Object.entries(nodos).map(([id, [x, y]]) => {
      const [lon, lat] = punto(x, y);
      const c = controles[id] ?? {};
      return { id, lon, lat, control: c.control ?? 'sin_senal', ...(c.accesosConPare && { accesosConPare: c.accesosConPare }) };
    }),
    vias,
  };
}

export const armarRed = (nodos, vias, controles) => crearRed(armarDatos(nodos, vias, controles));

// n0 → n1 → … → nN en línea recta hacia el este; tramos t0, t1, …
export function datosRedLinea({ tramos = 3, largo = 200, extra = {}, extraPorTramo = () => ({}) } = {}) {
  const nodos = {};
  for (let i = 0; i <= tramos; i++) nodos[`n${i}`] = [i * largo, 0];
  const vias = [];
  for (let i = 0; i < tramos; i++) {
    vias.push(viaEntre(`t${i}`, nodos, `n${i}`, `n${i + 1}`, { ...extra, ...extraPorTramo(i) }));
  }
  return armarDatos(nodos, vias);
}

export const redLinea = (opciones) => crearRed(datosRedLinea(opciones));

// Cruce en c: avenida oeste–este (o–c–e) y calle norte–sur (n–c–s), tramos de 200 m.
export function redCruce({
  control = 'prioridad',
  avenida = { tipo: 'avenida_nacional', sentido: 'ambos', velocidadMax: 50 },
  calle = { tipo: 'un_sentido', sentido: 'adelante' },
  accesosConPare,
} = {}) {
  const nodos = { o: [-200, 0], c: [0, 0], e: [200, 0], n: [0, 200], s: [0, -200] };
  const vias = [
    viaEntre('oc', nodos, 'o', 'c', avenida),
    viaEntre('ce', nodos, 'c', 'e', avenida),
    viaEntre('nc', nodos, 'n', 'c', calle),
    viaEntre('cs', nodos, 'c', 's', calle),
  ];
  return armarRed(nodos, vias, { c: { control, accesosConPare } });
}

// a → b → d directo, o a → b → m → d por la alterna. Todo de un sentido.
export function redDosRutas() {
  const nodos = { a: [0, 0], b: [200, 0], d: [400, 0], m: [300, 150] };
  return armarRed(nodos, [
    viaEntre('ab', nodos, 'a', 'b'),
    viaEntre('bd', nodos, 'b', 'd'),
    viaEntre('bm', nodos, 'b', 'm'),
    viaEntre('md', nodos, 'm', 'd'),
  ]);
}
```

- [ ] **Step 2: Escribir los tests de geometría**

`tests/sim/geometriaArcos.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { prepararGeometria, posicionEnArco, direccionLlegada } from '../../src/sim/geometriaArcos.js';
import { redLinea, punto } from './redesPrueba.js';

const red = redLinea({ tramos: 1, largo: 200, extra: { sentido: 'ambos', tipo: 'doble_sentido' } });
const geo = prepararGeometria(red);

describe('prepararGeometria', () => {
  it('cada arco tiene el largo de su vía', () => {
    expect(geo.get('t0>').largo).toBeCloseTo(red.vias.get('t0').longitud, 0);
    expect(geo.get('t0<').largo).toBeCloseTo(red.vias.get('t0').longitud, 0);
  });

  it('el arco de vuelta recorre la geometría al revés', () => {
    expect(geo.get('t0<').coords[0]).toEqual(red.vias.get('t0').geometria.at(-1));
  });
});

describe('posicionEnArco', () => {
  it('a mitad del arco devuelve el punto medio', () => {
    const [lon, lat] = posicionEnArco(geo.get('t0>'), 100);
    expect(lon).toBeCloseTo(punto(100, 0)[0], 6);
    expect(lat).toBeCloseTo(punto(100, 0)[1], 6);
  });

  it('fuera de rango se queda en los extremos', () => {
    expect(posicionEnArco(geo.get('t0>'), -5)).toEqual(geo.get('t0>').coords[0]);
    expect(posicionEnArco(geo.get('t0>'), 9999)).toEqual(geo.get('t0>').coords.at(-1));
  });

  it('el desplazamiento lateral va a la derecha del sentido de marcha', () => {
    const [, latIda] = posicionEnArco(geo.get('t0>'), 100, 3);
    const [, latVuelta] = posicionEnArco(geo.get('t0<'), 100, 3);
    expect(latIda).toBeLessThan(punto(100, 0)[1]); // hacia el este, la derecha es el sur
    expect(latVuelta).toBeGreaterThan(punto(100, 0)[1]); // hacia el oeste, la derecha es el norte
  });
});

describe('direccionLlegada', () => {
  it('apunta en el sentido de marcha', () => {
    const [dx, dy] = direccionLlegada(geo.get('t0>'));
    expect(dx).toBeCloseTo(1, 3);
    expect(dy).toBeCloseTo(0, 3);
    expect(direccionLlegada(geo.get('t0<'))[0]).toBeCloseTo(-1, 3);
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run tests/sim/geometriaArcos.test.js`
Expected: FAIL, no se puede resolver `src/sim/geometriaArcos.js`.

- [ ] **Step 4: Implementar `src/sim/geometriaArcos.js`**

```js
// Geometría de cada arco dirigido: sus puntos en el sentido de marcha y la
// distancia acumulada, para ubicar un vehículo a s metros del inicio.

import { distanciaMetros } from './geo.js';

const METROS_POR_GRADO_LAT = 110574;
const metrosPorGradoLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

export function prepararGeometria(red) {
  const geometria = new Map();
  for (const arco of red.arcos.values()) {
    const via = red.vias.get(arco.viaId);
    const coords = arco.adelante ? via.geometria : [...via.geometria].reverse();
    const acumulado = [0];
    for (let i = 1; i < coords.length; i++) {
      acumulado.push(acumulado[i - 1] + distanciaMetros(coords[i - 1], coords[i]));
    }
    geometria.set(arco.id, { coords, acumulado, largo: Math.max(acumulado.at(-1), 0.5) });
  }
  return geometria;
}

function vectorMetros([lon1, lat1], [lon2, lat2]) {
  return [(lon2 - lon1) * metrosPorGradoLon(lat1), (lat2 - lat1) * METROS_POR_GRADO_LAT];
}

export function posicionEnArco(geo, s, lateral = 0) {
  const { coords, acumulado } = geo;
  const d = Math.min(Math.max(s, 0), acumulado.at(-1));
  let i = 0;
  while (i < coords.length - 2 && acumulado[i + 1] < d) i++;
  const tramo = acumulado[i + 1] - acumulado[i];
  const f = tramo > 0 ? (d - acumulado[i]) / tramo : 0;
  const [lon1, lat1] = coords[i];
  const [lon2, lat2] = coords[i + 1];
  let lon = lon1 + (lon2 - lon1) * f;
  let lat = lat1 + (lat2 - lat1) * f;
  if (lateral) {
    const [dx, dy] = vectorMetros(coords[i], coords[i + 1]);
    const n = Math.hypot(dx, dy) || 1;
    // la derecha de (dx, dy) es (dy, −dx)
    lon += (lateral * dy) / n / metrosPorGradoLon(lat);
    lat += (lateral * -dx) / n / METROS_POR_GRADO_LAT;
  }
  return [lon, lat];
}

export function direccionLlegada(geo) {
  const { coords } = geo;
  const [dx, dy] = vectorMetros(coords[coords.length - 2], coords[coords.length - 1]);
  const n = Math.hypot(dx, dy) || 1;
  return [dx / n, dy / n];
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run tests/sim/geometriaArcos.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sim/geometriaArcos.js tests/sim/geometriaArcos.test.js tests/sim/redesPrueba.js
git commit -m "feat(sim): geometría de arcos y redes de prueba"
```

---

### Task 4: Rutas más rápidas con tiempos medidos

**Files:**
- Create: `src/sim/rutas.js`
- Test: `tests/sim/rutas.test.js`

**Interfaces:**
- Consumes: `velocidadReferencia` (Task 1); `prepararGeometria` (Task 3); `redDosRutas` (Task 3).
- Produces:
  - `rutaMasRapida(red, origen, destino, costoArco: (arcoId) => segundos | Infinity) → { arcos: arcoId[], tiempo } | null`. Con `origen === destino` devuelve `{ arcos: [], tiempo: 0 }`.
  - `crearTiempos(red, geometria) → { libre(arcoId), estimado(arcoId), registrar(arcoId, segundos), marcarEspera(arcoId, segundos) }`.

- [ ] **Step 1: Escribir los tests**

`tests/sim/rutas.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { rutaMasRapida, crearTiempos } from '../../src/sim/rutas.js';
import { prepararGeometria } from '../../src/sim/geometriaArcos.js';
import { redDosRutas } from './redesPrueba.js';

const red = redDosRutas();
const geo = prepararGeometria(red);
const porLargo = (arcoId) => geo.get(arcoId).largo;

describe('rutaMasRapida', () => {
  it('toma el camino más corto', () => {
    expect(rutaMasRapida(red, 'a', 'd', porLargo).arcos).toEqual(['ab>', 'bd>']);
  });

  it('evita los arcos con costo infinito', () => {
    const sinDirecta = (id) => (id === 'bd>' ? Infinity : porLargo(id));
    expect(rutaMasRapida(red, 'a', 'd', sinDirecta).arcos).toEqual(['ab>', 'bm>', 'md>']);
  });

  it('devuelve null si no hay camino respetando sentidos', () => {
    expect(rutaMasRapida(red, 'd', 'a', porLargo)).toBeNull();
  });

  it('origen igual a destino es una ruta vacía', () => {
    expect(rutaMasRapida(red, 'b', 'b', porLargo)).toEqual({ arcos: [], tiempo: 0 });
  });
});

describe('crearTiempos', () => {
  it('el tiempo libre es largo / velocidad de referencia', () => {
    const tiempos = crearTiempos(red, geo);
    expect(tiempos.libre('ab>')).toBeCloseTo(geo.get('ab>').largo / (30 / 3.6), 3);
  });

  it('el estimado nunca es menor que el libre y sigue a lo medido', () => {
    const tiempos = crearTiempos(red, geo);
    const libre = tiempos.libre('ab>');
    tiempos.registrar('ab>', 1);
    expect(tiempos.estimado('ab>')).toBe(libre);
    tiempos.registrar('ab>', 100);
    expect(tiempos.estimado('ab>')).toBeCloseTo(0.7 * 1 + 0.3 * 100, 6);
  });

  it('una espera en el frente del arco lo encarece', () => {
    const tiempos = crearTiempos(red, geo);
    tiempos.marcarEspera('bd>', 50);
    expect(tiempos.estimado('bd>')).toBeCloseTo(tiempos.libre('bd>') + 50, 6);
  });

  it('con tiempos medidos altos en la directa, la ruta cambia a la alterna', () => {
    const tiempos = crearTiempos(red, geo);
    for (let k = 0; k < 5; k++) tiempos.registrar('bd>', 300);
    expect(rutaMasRapida(red, 'a', 'd', tiempos.estimado).arcos).toEqual(['ab>', 'bm>', 'md>']);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/sim/rutas.test.js`
Expected: FAIL, no se puede resolver `src/sim/rutas.js`.

- [ ] **Step 3: Implementar `src/sim/rutas.js`**

```js
// Rutas más rápidas (Dijkstra) con el tiempo de viaje que se está midiendo en
// cada arco. Así, si una vía se congestiona o se arregla, las rutas cambian.

import { velocidadReferencia } from './vehiculos.js';

class Monticulo {
  constructor() { this.datos = []; }

  get size() { return this.datos.length; }

  push(prioridad, valor) {
    const d = this.datos;
    d.push([prioridad, valor]);
    let i = d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p][0] <= d[i][0]) break;
      [d[p], d[i]] = [d[i], d[p]];
      i = p;
    }
  }

  pop() {
    const d = this.datos;
    const tope = d[0];
    const ultimo = d.pop();
    if (d.length) {
      d[0] = ultimo;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < d.length && d[l][0] < d[m][0]) m = l;
        if (r < d.length && d[r][0] < d[m][0]) m = r;
        if (m === i) break;
        [d[m], d[i]] = [d[i], d[m]];
        i = m;
      }
    }
    return tope;
  }
}

export function rutaMasRapida(red, origen, destino, costoArco) {
  if (origen === destino) return { arcos: [], tiempo: 0 };
  const distancia = new Map([[origen, 0]]);
  const previo = new Map();
  const cerrados = new Set();
  const monticulo = new Monticulo();
  monticulo.push(0, origen);

  while (monticulo.size) {
    const [d, nodo] = monticulo.pop();
    if (cerrados.has(nodo)) continue;
    cerrados.add(nodo);
    if (nodo === destino) break;
    for (const arcoId of red.salientes.get(nodo) ?? []) {
      const costo = costoArco(arcoId);
      if (!Number.isFinite(costo)) continue;
      const siguiente = red.arcos.get(arcoId).hasta;
      const nueva = d + costo;
      if (nueva < (distancia.get(siguiente) ?? Infinity)) {
        distancia.set(siguiente, nueva);
        previo.set(siguiente, arcoId);
        monticulo.push(nueva, siguiente);
      }
    }
  }

  if (!cerrados.has(destino)) return null;
  const arcos = [];
  for (let n = destino; n !== origen; n = red.arcos.get(arcos.at(-1)).desde) arcos.push(previo.get(n));
  arcos.reverse();
  return { arcos, tiempo: distancia.get(destino) };
}

const PESO_NUEVA_MEDIDA = 0.3;

export function crearTiempos(red, geometria) {
  const medido = new Map();
  const espera = new Map();
  const libre = (arcoId) => geometria.get(arcoId).largo
    / velocidadReferencia(red.vias.get(red.arcos.get(arcoId).viaId));

  return {
    libre,
    estimado(arcoId) {
      const base = libre(arcoId);
      return Math.max(base, medido.get(arcoId) ?? 0, base + (espera.get(arcoId) ?? 0));
    },
    registrar(arcoId, segundos) {
      const previo = medido.get(arcoId);
      medido.set(arcoId, previo === undefined ? segundos : (1 - PESO_NUEVA_MEDIDA) * previo + PESO_NUEVA_MEDIDA * segundos);
    },
    marcarEspera(arcoId, segundos) {
      espera.set(arcoId, segundos);
    },
  };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/sim/rutas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/rutas.js tests/sim/rutas.test.js
git commit -m "feat(sim): rutas más rápidas con tiempos medidos"
```

---

### Task 5: Reglas de los cruces

**Files:**
- Create: `src/sim/cruces.js`
- Test: `tests/sim/cruces.test.js`

**Interfaces:**
- Consumes: `JERARQUIA` (`src/sim/tipos.js`); `prepararGeometria`, `direccionLlegada` (Task 3); `redCruce` (Task 3).
- Produces:
  - `analizarAccesos(red, geometria) → Map<arcoId, { tipo, conflictos: arcoId[], grupo: 0|1, nodo }>`.
  - `semaforoEnVerde(acceso, t, ciclo = CICLO_SEMAFORO) → boolean`; `CICLO_SEMAFORO = { verde: 25, todoRojo: 4 }`.
  - `ESPERA_CORTESIA = 20`.
  - `puedeEntrar({ acceso, vehiculo: { perfil, paroEnPare, esperaCruce }, t, ocupadoHasta, llegadas: (arcoId) => segundos }) → boolean`.

Reglas:

| Situación del nodo | Tipo de acceso |
|---|---|
| Un solo arco entra | `prioridad` |
| `control: 'semaforo'` | `semaforo` (grupo 0 = paralelo al primer acceso, grupo 1 = el resto) |
| Algún acceso es glorieta | glorieta → `prioridad`; los demás → `cede` |
| `control: 'pare'` con `accesosConPare` | la vía listada → `pare`; las demás → `prioridad` |
| `control: 'pare'` sin lista | menor jerarquía (o todas iguales) → `pare`; la mayor → `prioridad` |
| `control: 'prioridad'` con jerarquías distintas | menor → `cede`; mayor → `prioridad` |
| Cualquier otro caso | `derecha` (cede al que viene por la derecha) |

Conflictos: `cede` y `pare` ceden a los accesos con `prioridad`; si no hay ninguno, ceden a los de la derecha. `derecha` cede a los de la derecha.

- [ ] **Step 1: Escribir los tests**

`tests/sim/cruces.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { analizarAccesos, puedeEntrar, semaforoEnVerde, ESPERA_CORTESIA } from '../../src/sim/cruces.js';
import { prepararGeometria } from '../../src/sim/geometriaArcos.js';
import { PERFILES } from '../../src/sim/vehiculos.js';
import { redCruce } from './redesPrueba.js';

const analizar = (opciones) => {
  const red = redCruce(opciones);
  return analizarAccesos(red, prepararGeometria(red));
};

describe('analizarAccesos', () => {
  it('prioridad: la calle cede a los dos sentidos de la avenida', () => {
    const accesos = analizar({ control: 'prioridad' });
    expect(accesos.get('oc>').tipo).toBe('prioridad');
    expect(accesos.get('ce<').tipo).toBe('prioridad');
    expect(accesos.get('nc>').tipo).toBe('cede');
    expect([...accesos.get('nc>').conflictos].sort()).toEqual(['ce<', 'oc>']);
  });

  it('pare por acceso: solo para la vía listada', () => {
    const accesos = analizar({ control: 'pare', accesosConPare: ['nc'] });
    expect(accesos.get('nc>').tipo).toBe('pare');
    expect(accesos.get('oc>').tipo).toBe('prioridad');
  });

  it('pare sin lista: para la vía de menor jerarquía', () => {
    const accesos = analizar({ control: 'pare' });
    expect(accesos.get('nc>').tipo).toBe('pare');
    expect(accesos.get('oc>').tipo).toBe('prioridad');
  });

  it('sin señal entre vías iguales: cada uno cede al de su derecha', () => {
    const iguales = { tipo: 'doble_sentido', sentido: 'ambos' };
    const accesos = analizar({ control: 'sin_senal', avenida: iguales, calle: iguales });
    // quien baja hacia el sur tiene a su derecha al que viene del oeste
    expect(accesos.get('nc>')).toMatchObject({ tipo: 'derecha', conflictos: ['oc>'] });
    // quien va hacia el este tiene a su derecha al que sube desde el sur
    expect(accesos.get('oc>')).toMatchObject({ tipo: 'derecha', conflictos: ['cs<'] });
  });

  it('glorieta: quien circula en la glorieta tiene prioridad', () => {
    const accesos = analizar({ control: 'sin_senal', avenida: { tipo: 'glorieta', sentido: 'ambos' } });
    expect(accesos.get('oc>').tipo).toBe('prioridad');
    expect(accesos.get('nc>').tipo).toBe('cede');
  });

  it('semáforo: los accesos paralelos comparten fase', () => {
    const accesos = analizar({ control: 'semaforo' });
    expect(accesos.get('oc>').tipo).toBe('semaforo');
    expect(accesos.get('oc>').grupo).toBe(accesos.get('ce<').grupo);
    expect(accesos.get('nc>').grupo).not.toBe(accesos.get('oc>').grupo);
  });
});

describe('semaforoEnVerde', () => {
  it('alterna 25 s de verde por grupo con 4 s de todo rojo', () => {
    expect(semaforoEnVerde({ grupo: 0 }, 10)).toBe(true);
    expect(semaforoEnVerde({ grupo: 1 }, 10)).toBe(false);
    expect(semaforoEnVerde({ grupo: 0 }, 27)).toBe(false);
    expect(semaforoEnVerde({ grupo: 1 }, 27)).toBe(false);
    expect(semaforoEnVerde({ grupo: 1 }, 30)).toBe(true);
    expect(semaforoEnVerde({ grupo: 0 }, 58 + 1)).toBe(true);
  });
});

describe('puedeEntrar', () => {
  const vehiculo = (extra = {}) => ({ perfil: PERFILES.carro, paroEnPare: false, esperaCruce: 0, ...extra });
  const base = { t: 100, ocupadoHasta: -Infinity, llegadas: () => Infinity };

  it('con prioridad siempre entra', () => {
    expect(puedeEntrar({ ...base, acceso: { tipo: 'prioridad', conflictos: [] }, vehiculo: vehiculo(), ocupadoHasta: 999 })).toBe(true);
  });

  it('en un pare no entra si no se ha detenido', () => {
    const acceso = { tipo: 'pare', conflictos: [] };
    expect(puedeEntrar({ ...base, acceso, vehiculo: vehiculo() })).toBe(false);
    expect(puedeEntrar({ ...base, acceso, vehiculo: vehiculo({ paroEnPare: true }) })).toBe(true);
  });

  it('no entra si el cruce está ocupado', () => {
    expect(puedeEntrar({ ...base, acceso: { tipo: 'cede', conflictos: [] }, vehiculo: vehiculo(), ocupadoHasta: 101 })).toBe(false);
  });

  it('cede si alguien con prelación llega antes de su hueco', () => {
    const acceso = { tipo: 'cede', conflictos: ['x'] };
    expect(puedeEntrar({ ...base, acceso, vehiculo: vehiculo(), llegadas: () => 2 })).toBe(false);
    expect(puedeEntrar({ ...base, acceso, vehiculo: vehiculo(), llegadas: () => 5 })).toBe(true);
  });

  it('la moto acepta huecos más cortos que el camión', () => {
    const acceso = { tipo: 'cede', conflictos: ['x'] };
    const llegadas = () => 2.5;
    expect(puedeEntrar({ ...base, acceso, llegadas, vehiculo: vehiculo({ perfil: PERFILES.moto }) })).toBe(true);
    expect(puedeEntrar({ ...base, acceso, llegadas, vehiculo: vehiculo({ perfil: PERFILES.camion }) })).toBe(false);
  });

  it('después de esperar mucho entra por cortesía si el cruce está libre', () => {
    const acceso = { tipo: 'derecha', conflictos: ['x'] };
    const largo = vehiculo({ esperaCruce: ESPERA_CORTESIA + 1 });
    expect(puedeEntrar({ ...base, acceso, vehiculo: largo, llegadas: () => 1 })).toBe(true);
    expect(puedeEntrar({ ...base, acceso, vehiculo: largo, llegadas: () => 1, ocupadoHasta: 101 })).toBe(false);
  });

  it('en semáforo depende de la fase', () => {
    expect(puedeEntrar({ ...base, t: 10, acceso: { tipo: 'semaforo', grupo: 0 }, vehiculo: vehiculo() })).toBe(true);
    expect(puedeEntrar({ ...base, t: 10, acceso: { tipo: 'semaforo', grupo: 1 }, vehiculo: vehiculo() })).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/sim/cruces.test.js`
Expected: FAIL, no se puede resolver `src/sim/cruces.js`.

- [ ] **Step 3: Implementar `src/sim/cruces.js`**

```js
// Reglas de paso en los cruces de San Gil: pares, prioridad por jerarquía,
// glorietas y la regla de la derecha donde no hay señal. El semáforo existe
// solo como intervención que el usuario puede agregar.

import { JERARQUIA } from './tipos.js';
import { direccionLlegada } from './geometriaArcos.js';

export const CICLO_SEMAFORO = { verde: 25, todoRojo: 4 };
export const ESPERA_CORTESIA = 20; // s detenido en la línea antes de pasar por cortesía

const viaDe = (red, arcoId) => red.vias.get(red.arcos.get(arcoId).viaId);

// b viene por la derecha de a cuando circula de derecha a izquierda frente a a.
const vieneDeLaDerecha = ([ax, ay], [bx, by]) => ax * by - ay * bx > 0.3;

function tipoDeAcceso(red, nodo, arcoId, entrantes) {
  if (entrantes.length <= 1) return 'prioridad';
  if (nodo.control === 'semaforo') return 'semaforo';

  const via = viaDe(red, arcoId);
  if (entrantes.some((id) => viaDe(red, id).tipo === 'glorieta')) {
    return via.tipo === 'glorieta' ? 'prioridad' : 'cede';
  }

  const jerarquias = entrantes.map((id) => JERARQUIA[viaDe(red, id).tipo]);
  const maxima = Math.max(...jerarquias);
  const todasIguales = jerarquias.every((j) => j === maxima);
  const propia = JERARQUIA[via.tipo];

  if (nodo.control === 'pare') {
    if (nodo.accesosConPare?.length) return nodo.accesosConPare.includes(via.id) ? 'pare' : 'prioridad';
    return todasIguales || propia < maxima ? 'pare' : 'prioridad';
  }
  if (nodo.control === 'prioridad' && !todasIguales) return propia < maxima ? 'cede' : 'prioridad';
  return 'derecha';
}

export function analizarAccesos(red, geometria) {
  const accesos = new Map();
  for (const nodo of red.nodos.values()) {
    const entrantes = red.entrantes.get(nodo.id) ?? [];
    if (!entrantes.length) continue;
    const tipos = new Map(entrantes.map((id) => [id, tipoDeAcceso(red, nodo, id, entrantes)]));
    const direcciones = new Map(entrantes.map((id) => [id, direccionLlegada(geometria.get(id))]));
    const referencia = direcciones.get(entrantes[0]);
    const hayPrioridad = [...tipos.values()].includes('prioridad');

    for (const id of entrantes) {
      const tipo = tipos.get(id);
      const propia = direcciones.get(id);
      const deLaDerecha = () => entrantes.filter((otro) => otro !== id && vieneDeLaDerecha(propia, direcciones.get(otro)));
      let conflictos = [];
      if (tipo === 'cede' || tipo === 'pare') {
        conflictos = hayPrioridad ? entrantes.filter((otro) => tipos.get(otro) === 'prioridad') : deLaDerecha();
      } else if (tipo === 'derecha') {
        conflictos = deLaDerecha();
      }
      const paralelo = Math.abs(propia[0] * referencia[0] + propia[1] * referencia[1]) > 0.7;
      accesos.set(id, { tipo, conflictos, grupo: paralelo ? 0 : 1, nodo: nodo.id });
    }
  }
  return accesos;
}

export function semaforoEnVerde(acceso, t, ciclo = CICLO_SEMAFORO) {
  const periodo = 2 * (ciclo.verde + ciclo.todoRojo);
  const fase = ((t % periodo) + periodo) % periodo;
  const inicio = acceso.grupo === 0 ? 0 : ciclo.verde + ciclo.todoRojo;
  return fase >= inicio && fase < inicio + ciclo.verde;
}

export function puedeEntrar({ acceso, vehiculo, t, ocupadoHasta, llegadas }) {
  if (acceso.tipo === 'prioridad') return true;
  if (acceso.tipo === 'semaforo') return semaforoEnVerde(acceso, t);
  if (acceso.tipo === 'pare' && !vehiculo.paroEnPare) return false;
  if (t < ocupadoHasta) return false;
  if (vehiculo.esperaCruce > ESPERA_CORTESIA) return true;
  return acceso.conflictos.every((arcoId) => llegadas(arcoId) >= vehiculo.perfil.hueco);
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/sim/cruces.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/cruces.js tests/sim/cruces.test.js
git commit -m "feat(sim): reglas de paso en los cruces"
```

---

### Task 6: Cambio de carril (MOBIL)

**Files:**
- Create: `src/sim/mobil.js`
- Test: `tests/sim/mobil.test.js`

**Interfaces:**
- Produces: `MOBIL = { cortesia: 0.3, umbral: 0.2, frenadoSeguro: 4 }`; `convieneCambiar({ aActual, aNueva, seguidorNuevo?: { antes, despues }, seguidorViejo?: { antes, despues } }, parametros = MOBIL) → boolean`.

- [ ] **Step 1: Escribir los tests**

`tests/sim/mobil.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { convieneCambiar } from '../../src/sim/mobil.js';

describe('convieneCambiar', () => {
  it('cambia si gana bastante y nadie sale perjudicado', () => {
    expect(convieneCambiar({ aActual: -2, aNueva: 1 })).toBe(true);
  });

  it('no cambia si obligaría al de atrás a frenar en seco', () => {
    expect(convieneCambiar({ aActual: -2, aNueva: 1, seguidorNuevo: { antes: 0, despues: -5 } })).toBe(false);
  });

  it('no cambia por una ganancia marginal', () => {
    expect(convieneCambiar({ aActual: 0.5, aNueva: 0.6 })).toBe(false);
  });

  it('la cortesía pesa: no cambia si perjudica mucho a los demás', () => {
    expect(convieneCambiar({
      aActual: 0, aNueva: 0.6,
      seguidorNuevo: { antes: 1, despues: -1.5 },
    })).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/sim/mobil.test.js`
Expected: FAIL, no se puede resolver `src/sim/mobil.js`.

- [ ] **Step 3: Implementar `src/sim/mobil.js`**

```js
// MOBIL (Kesting, Treiber y Helbing, 2007): cambiar de carril si la ganancia
// propia, más una fracción de lo que ganan o pierden los demás, supera un
// umbral, y nunca si obliga al nuevo seguidor a frenar más de lo seguro.

export const MOBIL = { cortesia: 0.3, umbral: 0.2, frenadoSeguro: 4 };

export function convieneCambiar({ aActual, aNueva, seguidorNuevo = null, seguidorViejo = null }, parametros = MOBIL) {
  if (seguidorNuevo && seguidorNuevo.despues < -parametros.frenadoSeguro) return false;
  const ganancia = aNueva - aActual;
  const efectoEnOtros = (seguidorNuevo ? seguidorNuevo.despues - seguidorNuevo.antes : 0)
    + (seguidorViejo ? seguidorViejo.despues - seguidorViejo.antes : 0);
  return ganancia + parametros.cortesia * efectoEnOtros > parametros.umbral;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/sim/mobil.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/mobil.js tests/sim/mobil.test.js
git commit -m "feat(sim): decisión de cambio de carril con MOBIL"
```

---

### Task 7: Zonas, salidas y demanda de viajes

**Files:**
- Create: `src/escenarios/zonas.js`, `src/sim/demanda.js`
- Test: `tests/sim/demanda.test.js`

**Interfaces:**
- Consumes: `crearAleatorio` (Task 1); `componentePrincipal` (`src/sim/red.js`); `distanciaMetros` (`src/sim/geo.js`); `redLinea`, `punto` (Task 3).
- Produces:
  - `ZONAS: Record<clave, { nombre, lon, lat, peso }>` con claves `centro`, `mercado`, `terminal`, `terminalito`.
  - `SALIDAS: Record<clave, { nombre, nodo, avenida }>`.
  - `DEMANDA_BASE` (veh/h por flujo), `MEZCLA_LOCAL`, `MEZCLA_PASO`, `PERFIL_HORARIO` (24 valores), `FLUJOS`.
  - `prepararPuntos(red, zonas, salidas) → { zonas: Record<clave, { nombre, nodo, peso }>, salidas: Record<clave, { nombre, nodo, avenida }>, nodosLocales: nodoId[], avisos: string[] }`.
  - `crearDemanda(puntos, config, aleatorio) → { generar(t, dt) → viaje[], configurar(parcial), config() }`, con `viaje = { tipo, origen, destino, flujo }` y `config = { factor, temporada, horaInicio }`.

Flujos y su lógica:

| Flujo | veh/h base | Tipos | Origen ↔ destino |
|---|---|---|---|
| `local` | 1000 | 50 % moto, 30 % carro, 20 % buseta | 40 % zonas (por peso), 60 % cruces locales |
| `paso` | 300 | 70 % carro, 30 % moto | dos salidas distintas |
| `pesado` | 120 | camión | dos salidas de la Avenida |
| `busNacional` | 20 | bus nacional | salida de la Avenida ↔ Terminal |
| `busPaso` | 10 | bus nacional | dos salidas de la Avenida |
| `intermunicipal` | 30 | bus intermunicipal | Terminalito ↔ cualquier salida |

- [ ] **Step 1: Crear `src/escenarios/zonas.js`**

```js
// Lugares que generan y atraen viajes en San Gil. Coordenadas tomadas de
// OpenStreetMap salvo donde se indica. Las salidas son nodos de la red
// (public/data/red-sangil.json) en el borde del área descargada.

export const ZONAS = {
  centro: { nombre: 'Parque La Libertad (centro)', lon: -73.13356, lat: 6.55483, peso: 4 },
  // La plaza de mercado no está en OSM: ubicación aproximada, por confirmar con el usuario.
  mercado: { nombre: 'Plaza de mercado (aproximada)', lon: -73.1342, lat: 6.5570, peso: 3 },
  terminal: { nombre: 'Terminal de Transportes', lon: -73.14899, lat: 6.55444, peso: 2 },
  terminalito: { nombre: 'Terminalito', lon: -73.13686, lat: 6.55661, peso: 1 },
};

export const SALIDAS = {
  socorro: { nombre: 'Salida a Socorro / Bogotá', nodo: 'n268142246', avenida: true },
  bucaramanga: { nombre: 'Salida a Bucaramanga', nodo: 'n277771396', avenida: true },
  curiti: { nombre: 'Salida a Curití', nodo: 'n1420096299', avenida: false },
  mogotes: { nombre: 'Salida a Mogotes', nodo: 'n580927953', avenida: false },
  barichara: { nombre: 'Salida a Barichara', nodo: 'n8679370924', avenida: false },
};
```

- [ ] **Step 2: Escribir los tests**

`tests/sim/demanda.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearDemanda, prepararPuntos, DEMANDA_BASE, PERFIL_HORARIO } from '../../src/sim/demanda.js';
import { crearAleatorio } from '../../src/sim/aleatorio.js';
import { redLinea, punto } from './redesPrueba.js';

const puntos = {
  zonas: {
    centro: { nombre: 'Centro', nodo: 'Z', peso: 4 },
    terminal: { nombre: 'Terminal', nodo: 'T', peso: 2 },
    terminalito: { nombre: 'Terminalito', nodo: 't', peso: 1 },
  },
  salidas: {
    s1: { nombre: 'S1', nodo: 'S1', avenida: true },
    s2: { nombre: 'S2', nodo: 'S2', avenida: true },
    s3: { nombre: 'S3', nodo: 'S3', avenida: false },
  },
  nodosLocales: ['L1', 'L2', 'L3', 'L4'],
  avisos: [],
};

const unaHora = (config, semilla = 1) => {
  const demanda = crearDemanda(puntos, config, crearAleatorio(semilla));
  const viajes = [];
  for (let t = 0; t < 3600; t += 0.5) viajes.push(...demanda.generar(t, 0.5));
  return viajes;
};

describe('crearDemanda', () => {
  it('es determinista con la misma semilla', () => {
    expect(unaHora({ horaInicio: 11 }, 5)).toEqual(unaHora({ horaInicio: 11 }, 5));
  });

  it('genera cerca del volumen base en una hora con perfil 1,0', () => {
    expect(PERFIL_HORARIO[11]).toBe(1);
    const locales = unaHora({ horaInicio: 11 }).filter((v) => v.flujo === 'local').length;
    expect(locales).toBeGreaterThan(DEMANDA_BASE.local * 0.85);
    expect(locales).toBeLessThan(DEMANDA_BASE.local * 1.15);
  });

  it('el factor y la temporada multiplican la demanda', () => {
    const normal = unaHora({ horaInicio: 11 }).length;
    const alta = unaHora({ horaInicio: 11, temporada: 1.4 }).length;
    const doble = unaHora({ horaInicio: 11, factor: 2 }).length;
    expect(alta / normal).toBeGreaterThan(1.25);
    expect(alta / normal).toBeLessThan(1.55);
    expect(doble / normal).toBeGreaterThan(1.8);
    expect(doble / normal).toBeLessThan(2.2);
  });

  it('nunca genera un viaje con origen igual a destino', () => {
    expect(unaHora({ horaInicio: 11 }).every((v) => v.origen !== v.destino)).toBe(true);
  });

  it('los pesados van entre salidas de la Avenida y son camiones', () => {
    const pesados = unaHora({ horaInicio: 11 }).filter((v) => v.flujo === 'pesado');
    expect(pesados.length).toBeGreaterThan(0);
    for (const v of pesados) {
      expect(v.tipo).toBe('camion');
      expect(['S1', 'S2']).toContain(v.origen);
      expect(['S1', 'S2']).toContain(v.destino);
    }
  });

  it('los buses nacionales van entre la Avenida y la Terminal; los intermunicipales salen del Terminalito', () => {
    const viajes = unaHora({ horaInicio: 11, factor: 3 });
    for (const v of viajes.filter((x) => x.flujo === 'busNacional')) {
      expect(v.tipo).toBe('bus_nacional');
      expect([v.origen, v.destino]).toContain('T');
    }
    const inter = viajes.filter((x) => x.flujo === 'intermunicipal');
    expect(inter.length).toBeGreaterThan(0);
    for (const v of inter) expect([v.origen, v.destino]).toContain('t');
  });

  it('con factor 0 no genera nada', () => {
    const demanda = crearDemanda(puntos, { horaInicio: 11 }, crearAleatorio(1));
    demanda.configurar({ factor: 0 });
    let total = 0;
    for (let t = 0; t < 600; t += 0.5) total += demanda.generar(t, 0.5).length;
    expect(total).toBe(0);
  });

  it('el perfil horario cambia la tasa con la hora simulada', () => {
    const madrugada = unaHora({ horaInicio: 3 }).length;
    const pico = unaHora({ horaInicio: 7 }).length;
    expect(pico).toBeGreaterThan(madrugada * 3);
  });
});

describe('prepararPuntos', () => {
  const red = redLinea({ tramos: 3, extra: { sentido: 'ambos', tipo: 'doble_sentido' } });

  it('ubica cada zona en el cruce más cercano y excluye las salidas de los cruces locales', () => {
    const [lon, lat] = punto(210, 5);
    const p = prepararPuntos(red, { centro: { nombre: 'C', lon, lat, peso: 1 } }, { x: { nombre: 'X', nodo: 'n3', avenida: true } });
    expect(p.zonas.centro.nodo).toBe('n1');
    expect(p.salidas.x.nodo).toBe('n3');
    expect(p.nodosLocales).not.toContain('n3');
    expect(p.avisos).toEqual([]);
  });

  it('avisa de las salidas cuyo nodo no está en la red', () => {
    const p = prepararPuntos(red, {}, { mala: { nombre: 'Mala', nodo: 'zzz', avenida: false } });
    expect(p.salidas.mala).toBeUndefined();
    expect(p.avisos.join(' ')).toContain('zzz');
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run tests/sim/demanda.test.js`
Expected: FAIL, no se puede resolver `src/sim/demanda.js`.

- [ ] **Step 4: Implementar `src/sim/demanda.js`**

```js
// Demanda de viajes. Los volúmenes son SUPUESTOS (no hay aforos): sirven para
// comparar escenarios entre sí, no para predecir tiempos absolutos.

import { componentePrincipal } from './red.js';
import { distanciaMetros } from './geo.js';

export const DEMANDA_BASE = {
  local: 1000,
  paso: 300,
  pesado: 120,
  busNacional: 20,
  busPaso: 10,
  intermunicipal: 30,
};
export const FLUJOS = Object.keys(DEMANDA_BASE);

export const MEZCLA_LOCAL = { moto: 0.5, carro: 0.3, buseta: 0.2 };
export const MEZCLA_PASO = { carro: 0.7, moto: 0.3 };

// Multiplicador por hora del día: picos de mañana, mediodía y tarde.
export const PERFIL_HORARIO = [
  0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.7, 1.3, 1.1, 0.9, 0.9, 1.0,
  1.2, 1.1, 0.9, 0.9, 0.9, 1.2, 1.3, 1.0, 0.7, 0.5, 0.3, 0.3,
];

const PROPORCION_A_ZONAS = 0.4;
const RADIO_LOCAL = 2000; // m alrededor del centro para los viajes locales

export function prepararPuntos(red, zonas, salidas) {
  const principal = componentePrincipal(red);
  const candidatos = [...principal].map((id) => red.nodos.get(id));
  const masCercano = (lon, lat) => {
    let mejor = null;
    let mejorDistancia = Infinity;
    for (const n of candidatos) {
      const d = distanciaMetros([lon, lat], [n.lon, n.lat]);
      if (d < mejorDistancia) { mejor = n; mejorDistancia = d; }
    }
    return mejor;
  };

  const avisos = [];
  const zonasListas = {};
  for (const [clave, z] of Object.entries(zonas)) {
    const n = masCercano(z.lon, z.lat);
    if (n) zonasListas[clave] = { nombre: z.nombre, nodo: n.id, peso: z.peso };
  }

  const salidasListas = {};
  for (const [clave, s] of Object.entries(salidas)) {
    if (!principal.has(s.nodo)) {
      avisos.push(`${s.nombre}: el nodo ${s.nodo} no está en la red principal`);
      continue;
    }
    salidasListas[clave] = { nombre: s.nombre, nodo: s.nodo, avenida: s.avenida };
  }

  const nodosSalida = new Set(Object.values(salidasListas).map((s) => s.nodo));
  const centro = zonas.centro;
  const nodosLocales = candidatos
    .filter((n) => !nodosSalida.has(n.id))
    .filter((n) => !centro || distanciaMetros([centro.lon, centro.lat], [n.lon, n.lat]) <= RADIO_LOCAL)
    .map((n) => n.id);

  return { zonas: zonasListas, salidas: salidasListas, nodosLocales, avisos };
}

export function crearDemanda(puntos, configInicial, aleatorio) {
  let config = { factor: 1, temporada: 1, horaInicio: 7, ...configInicial };
  const proximo = Object.fromEntries(FLUJOS.map((f) => [f, null]));

  const salidas = Object.values(puntos.salidas);
  const salidasAvenida = salidas.filter((s) => s.avenida);
  const pesosZonas = Object.fromEntries(Object.entries(puntos.zonas).map(([k, z]) => [k, z.peso]));

  const hora = (t) => Math.floor(config.horaInicio + t / 3600) % 24;
  const tasa = (flujo, t) => (DEMANDA_BASE[flujo] * config.factor * config.temporada * PERFIL_HORARIO[hora(t)]) / 3600;

  const dosDistintas = (lista) => {
    if (lista.length < 2) return null;
    const a = aleatorio.elegir(lista);
    let b = aleatorio.elegir(lista);
    while (b === a) b = aleatorio.elegir(lista);
    return [a.nodo, b.nodo];
  };
  const alAzar = (a, b) => (aleatorio.siguiente() < 0.5 ? [a, b] : [b, a]);

  const puntoLocal = () => {
    if (Object.keys(pesosZonas).length && aleatorio.siguiente() < PROPORCION_A_ZONAS) {
      return puntos.zonas[aleatorio.elegirPonderado(pesosZonas)].nodo;
    }
    return aleatorio.elegir(puntos.nodosLocales);
  };

  function crearViaje(flujo) {
    let tipo;
    let par = null;
    if (flujo === 'local') {
      if (!puntos.nodosLocales.length) return null;
      tipo = aleatorio.elegirPonderado(MEZCLA_LOCAL);
      const origen = puntoLocal();
      let destino = puntoLocal();
      for (let intento = 0; destino === origen && intento < 5; intento++) destino = puntoLocal();
      if (destino !== origen) par = [origen, destino];
    } else if (flujo === 'paso') {
      tipo = aleatorio.elegirPonderado(MEZCLA_PASO);
      par = dosDistintas(salidas);
    } else if (flujo === 'pesado') {
      tipo = 'camion';
      par = dosDistintas(salidasAvenida);
    } else if (flujo === 'busNacional') {
      tipo = 'bus_nacional';
      const terminal = puntos.zonas.terminal?.nodo;
      if (terminal && salidasAvenida.length) par = alAzar(aleatorio.elegir(salidasAvenida).nodo, terminal);
    } else if (flujo === 'busPaso') {
      tipo = 'bus_nacional';
      par = dosDistintas(salidasAvenida);
    } else if (flujo === 'intermunicipal') {
      tipo = 'bus_intermunicipal';
      const terminalito = puntos.zonas.terminalito?.nodo;
      if (terminalito && salidas.length) par = alAzar(aleatorio.elegir(salidas).nodo, terminalito);
    }
    if (!par || par[0] === par[1]) return null;
    return { tipo, origen: par[0], destino: par[1], flujo };
  }

  return {
    generar(t, dt) {
      const viajes = [];
      for (const flujo of FLUJOS) {
        const r = tasa(flujo, t);
        if (r <= 0) { proximo[flujo] = null; continue; }
        if (proximo[flujo] === null) proximo[flujo] = t + aleatorio.exponencial(r);
        while (proximo[flujo] < t + dt) {
          const viaje = crearViaje(flujo);
          if (viaje) viajes.push(viaje);
          proximo[flujo] += aleatorio.exponencial(r);
        }
      }
      return viajes;
    },
    configurar(parcial) {
      config = { ...config, ...parcial };
      for (const flujo of FLUJOS) proximo[flujo] = null;
    },
    config: () => ({ ...config }),
  };
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run tests/sim/demanda.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/escenarios/zonas.js src/sim/demanda.js tests/sim/demanda.test.js
git commit -m "feat(sim): zonas, salidas y demanda de viajes por flujo"
```

---

### Task 8: Métricas

**Files:**
- Create: `src/sim/metricas.js`
- Test: `tests/sim/metricas.test.js`

**Interfaces:**
- Produces: `crearMetricas() → { viajeCompletado({ tipo, duracion, tiempoLibre }), viajeImposible(), bloqueo(), muestra({ t, enRed, enCola }), resumen() → { viajesCompletados, viajesImposibles, bloqueos, tiempoMedio, demoraMedia, demoraTotalVh, porTipo }, serie() → muestra[] }`.

- [ ] **Step 1: Escribir los tests**

`tests/sim/metricas.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearMetricas } from '../../src/sim/metricas.js';

describe('crearMetricas', () => {
  it('sin viajes todo es cero', () => {
    expect(crearMetricas().resumen()).toEqual({
      viajesCompletados: 0, viajesImposibles: 0, bloqueos: 0,
      tiempoMedio: 0, demoraMedia: 0, demoraTotalVh: 0, porTipo: {},
    });
  });

  it('la demora es lo que el viaje tardó por encima del tiempo libre', () => {
    const m = crearMetricas();
    m.viajeCompletado({ tipo: 'carro', duracion: 100, tiempoLibre: 60 });
    m.viajeCompletado({ tipo: 'moto', duracion: 50, tiempoLibre: 50 });
    m.viajeCompletado({ tipo: 'moto', duracion: 3600, tiempoLibre: 0 });
    const r = m.resumen();
    expect(r.viajesCompletados).toBe(3);
    expect(r.tiempoMedio).toBeCloseTo((100 + 50 + 3600) / 3, 6);
    expect(r.demoraMedia).toBeCloseTo((40 + 0 + 3600) / 3, 6);
    expect(r.demoraTotalVh).toBeCloseTo(3640 / 3600, 6);
    expect(r.porTipo).toEqual({ carro: 1, moto: 2 });
  });

  it('una demora negativa (llegó antes de lo libre) cuenta como cero', () => {
    const m = crearMetricas();
    m.viajeCompletado({ tipo: 'carro', duracion: 50, tiempoLibre: 60 });
    expect(m.resumen().demoraMedia).toBe(0);
  });

  it('cuenta imposibles y bloqueos, y guarda la serie', () => {
    const m = crearMetricas();
    m.viajeImposible();
    m.bloqueo();
    m.bloqueo();
    m.muestra({ t: 1, enRed: 3, enCola: 1 });
    expect(m.resumen()).toMatchObject({ viajesImposibles: 1, bloqueos: 2 });
    expect(m.serie()).toEqual([{ t: 1, enRed: 3, enCola: 1 }]);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/sim/metricas.test.js`
Expected: FAIL, no se puede resolver `src/sim/metricas.js`.

- [ ] **Step 3: Implementar `src/sim/metricas.js`**

```js
// Métricas de la corrida, las mismas que comparaba la base Python
// (04_analyze.py): viajes, tiempo de viaje, demora y bloqueos.

const MAXIMO_MUESTRAS = 7200; // dos horas a una muestra por segundo

export function crearMetricas() {
  let completados = 0;
  let imposibles = 0;
  let bloqueos = 0;
  let sumaDuracion = 0;
  let sumaDemora = 0;
  const porTipo = {};
  const serie = [];

  return {
    viajeCompletado({ tipo, duracion, tiempoLibre }) {
      completados += 1;
      sumaDuracion += duracion;
      sumaDemora += Math.max(0, duracion - tiempoLibre);
      porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
    },
    viajeImposible() { imposibles += 1; },
    bloqueo() { bloqueos += 1; },
    muestra(m) {
      serie.push(m);
      if (serie.length > MAXIMO_MUESTRAS) serie.shift();
    },
    resumen() {
      return {
        viajesCompletados: completados,
        viajesImposibles: imposibles,
        bloqueos,
        tiempoMedio: completados ? sumaDuracion / completados : 0,
        demoraMedia: completados ? sumaDemora / completados : 0,
        demoraTotalVh: sumaDemora / 3600,
        porTipo: { ...porTipo },
      };
    },
    serie: () => serie,
  };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/sim/metricas.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/metricas.js tests/sim/metricas.test.js
git commit -m "feat(sim): acumulación de métricas de la corrida"
```

---

### Task 9: Motor — vehículos que avanzan por la red

**Files:**
- Create: `src/sim/motor.js`
- Test: `tests/sim/motor.test.js`

**Interfaces:**
- Consumes: todo lo de las tasks 1 a 8; `arcoTransitable` (`src/sim/red.js`).
- Produces: `crearMotor(red, opciones) → Motor`.
  - `opciones`: `{ semilla = 1, dt = 0.5, umbralBloqueo = 180, intervaloReruteo = 90, demanda = {}, conDemanda = true, zonas = ZONAS, salidas = SALIDAS, alCruzar?: (veh, nodoId, t) => void, alTerminar?: (veh, t) => void }`.
  - `Motor`: `t` (getter), `dt`, `paso()`, `avanzar(segundos)`, `agregarVehiculo({ tipo, origen, destino, conductor? }) → vehiculo | null`, `vehiculos() → vehiculo[]`, `posiciones() → { cantidad, datos: Float64Array }`, `estadoVias() → { viaId, ratio, vehiculos }[]`, `usoVias() → Map<viaId, número>`, `configurarDemanda(parcial)`, `resumen() → { t, …metricas, enRed, enCola, pendientes, avisos, cuellos: { viaId, nombre, ratio, vehiculos }[] }`.

El ciclo de un paso:

1. La demanda genera viajes; cada uno calcula su ruta y queda pendiente (o cuenta como imposible).
2. Los pendientes entran a su primer arco si hay espacio.
3. Se calcula la aceleración IDM de todos: el de adelante en el carril, o la línea del cruce si no tiene permiso, o la cola del arco siguiente si sí lo tiene.
4. Todos avanzan; nadie atraviesa al de adelante ni la línea sin permiso.
5. Los que pasan la línea cruzan al arco siguiente (o terminan el viaje). Un vehículo solo cruza un nodo por paso.
6. Cada 1 s: cambios de carril. Cada 2 s: re-ruteo y espera en los frentes. Cada paso: liberación de bloqueados.

Esta tarea cubre los puntos 1 a 5 en una red sin conflictos; la Task 10 prueba cruces, re-ruteo, bloqueos y carriles con el mismo archivo.

- [ ] **Step 1: Escribir los tests**

`tests/sim/motor.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearMotor } from '../../src/sim/motor.js';
import { CONDUCTOR_NEUTRO } from '../../src/sim/vehiculos.js';
import { redLinea, armarRed, viaEntre } from './redesPrueba.js';

const sinDemanda = (red, extra = {}) => crearMotor(red, { conDemanda: false, ...extra });
const carro = (origen, destino) => ({ tipo: 'carro', origen, destino, conductor: CONDUCTOR_NEUTRO });

describe('motor · recorrido básico', () => {
  it('un carro solo recorre la línea y termina cerca del tiempo libre', () => {
    const motor = sinDemanda(redLinea());
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(200);
    const r = motor.resumen();
    expect(r.viajesCompletados).toBe(1);
    const libre = 600 / (30 / 3.6);
    expect(r.tiempoMedio).toBeGreaterThan(libre);
    expect(r.tiempoMedio).toBeLessThan(libre * 1.3);
    expect(r.enRed).toBe(0);
  });

  it('dos carros en el mismo carril nunca se traslapan', () => {
    const motor = sinDemanda(redLinea());
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.agregarVehiculo(carro('n0', 'n3'));
    for (let k = 0; k < 400; k++) {
      motor.paso();
      const vs = motor.vehiculos();
      for (const a of vs) {
        for (const b of vs) {
          if (a === b || a.ruta[a.i] !== b.ruta[b.i] || a.s < b.s) continue;
          expect(a.s - a.perfil.largo - b.s).toBeGreaterThanOrEqual(0);
        }
      }
    }
    expect(motor.resumen().viajesCompletados).toBe(2);
  });

  it('una vía con huecos se recorre más despacio', () => {
    const tiempo = (estado) => {
      const motor = sinDemanda(redLinea({ extra: { estado } }));
      motor.agregarVehiculo(carro('n0', 'n3'));
      motor.avanzar(400);
      return motor.resumen().tiempoMedio;
    };
    expect(tiempo('huecos')).toBeGreaterThan(tiempo('bueno') * 1.5);
  });

  it('un viaje contra el sentido de las vías cuenta como imposible', () => {
    const motor = sinDemanda(redLinea());
    expect(motor.agregarVehiculo(carro('n3', 'n0'))).toBeNull();
    expect(motor.resumen().viajesImposibles).toBe(1);
  });

  it('si el primer tramo está lleno, los vehículos esperan para entrar y luego terminan todos', () => {
    const motor = sinDemanda(redLinea());
    for (let k = 0; k < 40; k++) motor.agregarVehiculo(carro('n0', 'n3'));
    motor.paso();
    expect(motor.vehiculos().length).toBe(1);
    expect(motor.resumen().pendientes).toBe(39);
    motor.avanzar(600);
    expect(motor.resumen().viajesCompletados).toBe(40);
  });

  it('las posiciones traen lon, lat y tipo de cada vehículo en la red', () => {
    const motor = sinDemanda(redLinea());
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.agregarVehiculo({ tipo: 'moto', origen: 'n0', destino: 'n3' });
    motor.avanzar(20);
    const { cantidad, datos } = motor.posiciones();
    expect(cantidad).toBe(motor.vehiculos().length);
    expect(datos.length).toBe(cantidad * 3);
    for (let k = 0; k < cantidad; k++) {
      expect(Number.isFinite(datos[k * 3])).toBe(true);
      expect(Number.isFinite(datos[k * 3 + 1])).toBe(true);
      expect([0, 1]).toContain(datos[k * 3 + 2]); // moto o carro
    }
  });

  it('un tramo de 3 m no hace saltar dos cruces en un paso ni da posiciones inválidas', () => {
    const nodos = { a: [0, 0], b: [200, 0], c: [203, 0], d: [400, 0] };
    const red = armarRed(nodos, [
      viaEntre('ab', nodos, 'a', 'b', { velocidadMax: 50 }),
      viaEntre('bc', nodos, 'b', 'c', { velocidadMax: 50 }),
      viaEntre('cd', nodos, 'c', 'd', { velocidadMax: 50 }),
    ]);
    const cruces = [];
    const motor = sinDemanda(red, { alCruzar: (veh, nodo, t) => cruces.push({ nodo, t }) });
    motor.agregarVehiculo(carro('a', 'd'));
    for (let k = 0; k < 200; k++) {
      motor.paso();
      const { datos } = motor.posiciones();
      expect([...datos].every(Number.isFinite)).toBe(true);
    }
    expect(motor.resumen().viajesCompletados).toBe(1);
    expect(cruces.map((c) => c.nodo)).toEqual(['b', 'c']);
    expect(cruces[1].t).toBeGreaterThan(cruces[0].t);
  });

  it('el estado de las vías informa qué tan rápido va el tráfico', () => {
    const motor = sinDemanda(redLinea());
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(30);
    const [via] = motor.estadoVias();
    expect(via.vehiculos).toBe(1);
    expect(via.ratio).toBeGreaterThan(0.5);
    expect(via.ratio).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/sim/motor.test.js`
Expected: FAIL, no se puede resolver `src/sim/motor.js`.

- [ ] **Step 3: Implementar `src/sim/motor.js`**

```js
// El motor de simulación: avanza el tiempo en pasos fijos y mueve cada
// vehículo con IDM, respetando cruces, carriles y rutas. JavaScript puro.

import { crearAleatorio } from './aleatorio.js';
import { PERFILES, TIPOS_VEHICULO, crearConductor, velocidadDeseada } from './vehiculos.js';
import { aceleracionIDM, avanzar } from './idm.js';
import { prepararGeometria, posicionEnArco } from './geometriaArcos.js';
import { rutaMasRapida, crearTiempos } from './rutas.js';
import { analizarAccesos, puedeEntrar } from './cruces.js';
import { convieneCambiar } from './mobil.js';
import { crearDemanda, prepararPuntos } from './demanda.js';
import { crearMetricas } from './metricas.js';
import { arcoTransitable } from './red.js';
import { ZONAS, SALIDAS } from '../escenarios/zonas.js';

const DISTANCIA_DECISION = 60; // m: la vía con prioridad confirma el paso desde aquí
const DISTANCIA_SEMAFORO = 30; // m: se mira el color del semáforo desde aquí
const MARGEN_CEDER = 8; // m sobre s0: quien cede evalúa el hueco ya en la línea
const DISTANCIA_SIN_CAMBIO = 15; // m antes del cruce en que ya no se cambia de carril
const ANCHO_CARRIL = 3.2;

function insertarOrdenado(lista, veh) {
  const k = lista.findIndex((otro) => otro.s < veh.s);
  if (k === -1) lista.push(veh);
  else lista.splice(k, 0, veh);
}

export function crearMotor(red, opciones = {}) {
  const {
    semilla = 1, dt = 0.5, umbralBloqueo = 180, intervaloReruteo = 90,
    demanda: configDemanda = {}, conDemanda = true, zonas = ZONAS, salidas = SALIDAS,
    alCruzar = null, alTerminar = null,
  } = opciones;

  const aleatorio = crearAleatorio(semilla);
  const geometria = prepararGeometria(red);
  const tiempos = crearTiempos(red, geometria);
  const accesos = analizarAccesos(red, geometria);
  const metricas = crearMetricas();
  const puntos = prepararPuntos(red, zonas, salidas);
  const demanda = conDemanda ? crearDemanda(puntos, configDemanda, aleatorio) : null;

  // Cada arco guarda sus carriles; cada carril, sus vehículos del frente hacia atrás.
  const estadoArco = new Map();
  for (const [arcoId, geo] of geometria) {
    const via = red.vias.get(red.arcos.get(arcoId).viaId);
    estadoArco.set(arcoId, {
      id: arcoId, via, geo, largo: geo.largo,
      carriles: Array.from({ length: via.carrilesPorSentido }, () => []),
    });
  }

  const ocupadoHasta = new Map();
  const usoVias = new Map();
  const pendientes = [];
  const vivos = new Set();
  let t = 0;
  let pasos = 0;
  let siguienteId = 1;

  const costo = (arcoId) => (arcoTransitable(red, arcoId) ? tiempos.estimado(arcoId) : Infinity);

  function frente(e) {
    let f = null;
    for (const carril of e.carriles) if (carril[0] && (!f || carril[0].s > f.s)) f = carril[0];
    return f;
  }

  function ultimo(e) {
    let u = null;
    for (const carril of e.carriles) {
      const x = carril.at(-1);
      if (x && (!u || x.s < u.s)) u = x;
    }
    return u;
  }

  // Segundos hasta que el primer vehículo de un arco llegue al cruce.
  function llegadas(arcoId) {
    const e = estadoArco.get(arcoId);
    const f = frente(e);
    if (!f) return Infinity;
    if (f.v < 0.5 && !f.permiso) return Infinity; // está detenido cediendo: no llega
    return (e.largo - f.s) / Math.max(f.v, 0.5);
  }

  function agregarVehiculo({ tipo, origen, destino, conductor }) {
    const ruta = rutaMasRapida(red, origen, destino, costo);
    if (!ruta || ruta.arcos.length === 0) {
      metricas.viajeImposible();
      return null;
    }
    const perfil = PERFILES[tipo];
    const cond = conductor ?? crearConductor(aleatorio);
    const tiempoLibre = ruta.arcos.reduce((suma, id) => {
      const e = estadoArco.get(id);
      return suma + e.largo / velocidadDeseada(perfil, e.via, cond);
    }, 0);
    const veh = {
      id: siguienteId++, tipo, tipoIndice: TIPOS_VEHICULO.indexOf(tipo), perfil, conductor: cond,
      ruta: ruta.arcos, i: 0, s: 0, v: 0, a: 0, carril: 0, destino,
      tSalida: t, tEntradaArco: t, tiempoLibre,
      permiso: false, paroEnPare: false, esperaCruce: 0, quietoDesde: null, transferidoEn: -1,
      proximoReruteo: t + intervaloReruteo * (0.5 + aleatorio.siguiente()),
    };
    pendientes.push(veh);
    return veh;
  }

  function intentarInsertar() {
    const restantes = [];
    for (const veh of pendientes) {
      const e = estadoArco.get(veh.ruta[0]);
      let carril = -1;
      if (arcoTransitable(red, e.id)) {
        for (let c = 0; c < e.carriles.length; c++) {
          const ult = e.carriles[c].at(-1);
          if (!ult || ult.s - ult.perfil.largo >= veh.perfil.s0 + 1) { carril = c; break; }
        }
      }
      if (carril === -1) { restantes.push(veh); continue; }
      const ult = e.carriles[carril].at(-1);
      veh.carril = carril;
      veh.s = 0;
      veh.v = ult ? Math.min(ult.v, 5) : 5;
      veh.tEntradaArco = t;
      e.carriles[carril].push(veh);
      vivos.add(veh);
    }
    pendientes.length = 0;
    pendientes.push(...restantes);
  }

  // Lo que tiene adelante el primer vehículo de un carril: la línea del cruce
  // si no tiene permiso, o la cola del arco siguiente si ya lo tiene.
  function obstaculoEnCruce(veh, e) {
    const distLinea = e.largo - veh.s;
    const siguienteArco = veh.ruta[veh.i + 1];
    const sig = estadoArco.get(siguienteArco);
    const ult = ultimo(sig);
    const espacio = ult ? ult.s - ult.perfil.largo : Infinity;

    if (!veh.permiso) {
      const acceso = accesos.get(e.id);
      if (acceso.tipo === 'pare' && veh.v < 0.3 && distLinea < veh.perfil.s0 + 3) veh.paroEnPare = true;
      if (veh.v < 0.3 && distLinea < veh.perfil.s0 + 5) veh.esperaCruce += dt;
      const transitable = arcoTransitable(red, siguienteArco);
      if (!transitable) veh.proximoReruteo = Math.min(veh.proximoReruteo, t);
      let alcance = veh.perfil.s0 + MARGEN_CEDER;
      if (acceso.tipo === 'prioridad') alcance = DISTANCIA_DECISION;
      else if (acceso.tipo === 'semaforo') alcance = DISTANCIA_SEMAFORO;
      if (transitable && distLinea < alcance && espacio >= veh.perfil.largo + 1) {
        const nodo = acceso.nodo;
        veh.permiso = puedeEntrar({
          acceso, vehiculo: veh, t, ocupadoHasta: ocupadoHasta.get(nodo) ?? -Infinity, llegadas,
        });
        // Quien cede reserva el cruce mientras lo atraviesa.
        if (veh.permiso && acceso.tipo !== 'prioridad' && acceso.tipo !== 'semaforo') {
          const despeje = (distLinea + veh.perfil.largo + 6) / Math.max(veh.v, 3);
          ocupadoHasta.set(nodo, Math.max(ocupadoHasta.get(nodo) ?? -Infinity, t + despeje));
        }
      }
    }
    if (veh.permiso) {
      const v0Siguiente = velocidadDeseada(veh.perfil, sig.via, veh.conductor);
      return { gap: distLinea + espacio, vLider: ult ? ult.v : v0Siguiente };
    }
    return { gap: distLinea, vLider: 0 };
  }

  function calcularAceleraciones() {
    for (const e of estadoArco.values()) {
      for (const carril of e.carriles) {
        for (let k = 0; k < carril.length; k++) {
          const veh = carril[k];
          const v0 = velocidadDeseada(veh.perfil, e.via, veh.conductor);
          let gap = Infinity;
          let vLider = v0;
          if (k > 0) {
            const lider = carril[k - 1];
            gap = lider.s - lider.perfil.largo - veh.s;
            vLider = lider.v;
          } else if (veh.i < veh.ruta.length - 1) {
            ({ gap, vLider } = obstaculoEnCruce(veh, e));
          }
          veh.a = aceleracionIDM(veh.perfil, veh.v, v0, gap, vLider);
        }
      }
    }
  }

  function mover() {
    for (const e of estadoArco.values()) {
      for (const carril of e.carriles) {
        for (let k = 0; k < carril.length; k++) {
          const veh = carril[k];
          const antes = veh.s;
          const { v, dx } = avanzar(veh.v, veh.a, dt);
          veh.v = v;
          veh.s += dx;
          if (k > 0) {
            const lider = carril[k - 1];
            const tope = lider.s - lider.perfil.largo - 0.1;
            if (veh.s > tope) {
              veh.s = Math.max(tope, antes);
              veh.v = Math.min(veh.v, lider.v);
            }
          } else if (!veh.permiso && veh.i < veh.ruta.length - 1 && veh.s > e.largo - 0.1) {
            veh.s = Math.max(e.largo - 0.1, antes);
            veh.v = 0;
          }
          veh.quietoDesde = veh.v < 0.1 ? (veh.quietoDesde ?? t) : null;
        }
      }
    }
  }

  function transferir() {
    for (const e of estadoArco.values()) {
      for (const carril of e.carriles) {
        while (carril.length && carril[0].s >= e.largo && carril[0].transferidoEn !== pasos) {
          const veh = carril.shift();
          const instante = t + dt;
          tiempos.registrar(e.id, instante - veh.tEntradaArco);
          usoVias.set(e.via.id, (usoVias.get(e.via.id) ?? 0) + 1);

          if (veh.i === veh.ruta.length - 1) {
            vivos.delete(veh);
            metricas.viajeCompletado({ tipo: veh.tipo, duracion: instante - veh.tSalida, tiempoLibre: veh.tiempoLibre });
            alTerminar?.(veh, instante);
            continue;
          }

          const nodo = red.arcos.get(e.id).hasta;
          const despeje = (veh.perfil.largo + 6) / Math.max(veh.v, 2);
          ocupadoHasta.set(nodo, Math.max(ocupadoHasta.get(nodo) ?? -Infinity, t + despeje));
          alCruzar?.(veh, nodo, instante);

          const sobrante = veh.s - e.largo;
          veh.i += 1;
          const sig = estadoArco.get(veh.ruta[veh.i]);
          veh.s = Math.min(sobrante, sig.largo - 0.1);
          veh.carril = Math.min(veh.carril, sig.carriles.length - 1);
          veh.permiso = false;
          veh.paroEnPare = false;
          veh.esperaCruce = 0;
          veh.tEntradaArco = instante;
          veh.transferidoEn = pasos;
          insertarOrdenado(sig.carriles[veh.carril], veh);
        }
      }
    }
  }

  function vecinosEn(carril, s) {
    let lider = null;
    let seguidor = null;
    for (const otro of carril) {
      if (otro.s > s) lider = otro;
      else { seguidor = otro; break; }
    }
    return { lider, seguidor };
  }

  function aceleracionTras(veh, e, lider) {
    const v0 = velocidadDeseada(veh.perfil, e.via, veh.conductor);
    if (lider) return aceleracionIDM(veh.perfil, veh.v, v0, lider.s - lider.perfil.largo - veh.s, lider.v);
    if (veh.i < veh.ruta.length - 1 && !veh.permiso) return aceleracionIDM(veh.perfil, veh.v, v0, e.largo - veh.s, 0);
    return aceleracionIDM(veh.perfil, veh.v, v0, Infinity, v0);
  }

  function cambiosDeCarril() {
    for (const e of estadoArco.values()) {
      if (e.carriles.length < 2) continue;
      for (let c = 0; c < e.carriles.length; c++) {
        for (const veh of [...e.carriles[c]]) {
          if (e.largo - veh.s < DISTANCIA_SIN_CAMBIO) continue;
          for (const destino of [c + 1, c - 1]) {
            if (destino < 0 || destino >= e.carriles.length) continue;
            const { lider, seguidor } = vecinosEn(e.carriles[destino], veh.s);
            if (lider && lider.s - lider.perfil.largo - veh.s < 1) continue;
            if (seguidor && veh.s - veh.perfil.largo - seguidor.s < 1) continue;
            const actual = e.carriles[c];
            const idx = actual.indexOf(veh);
            const liderViejo = idx > 0 ? actual[idx - 1] : null;
            const seguidorViejo = actual[idx + 1] ?? null;
            const conviene = convieneCambiar({
              aActual: veh.a,
              aNueva: aceleracionTras(veh, e, lider),
              seguidorNuevo: seguidor && {
                antes: aceleracionTras(seguidor, e, lider),
                despues: aceleracionTras(seguidor, e, veh),
              },
              seguidorViejo: seguidorViejo && {
                antes: aceleracionTras(seguidorViejo, e, veh),
                despues: aceleracionTras(seguidorViejo, e, liderViejo),
              },
            });
            if (conviene) {
              actual.splice(idx, 1);
              insertarOrdenado(e.carriles[destino], veh);
              veh.carril = destino;
              break;
            }
          }
        }
      }
    }
  }

  // Un vehículo quieto demasiado tiempo se retira y se cuenta como bloqueo
  // (equivale al "teleport" de SUMO): síntoma de colapso.
  function liberarBloqueados() {
    for (const e of estadoArco.values()) {
      for (const carril of e.carriles) {
        for (let k = carril.length - 1; k >= 0; k--) {
          const veh = carril[k];
          if (veh.quietoDesde !== null && t - veh.quietoDesde > umbralBloqueo) {
            carril.splice(k, 1);
            vivos.delete(veh);
            metricas.bloqueo();
          }
        }
      }
    }
  }

  function reRutear() {
    for (const veh of vivos) {
      if (t < veh.proximoReruteo || veh.i >= veh.ruta.length - 1) continue;
      veh.proximoReruteo = t + intervaloReruteo;
      const desde = red.arcos.get(veh.ruta[veh.i]).hasta;
      const nueva = rutaMasRapida(red, desde, veh.destino, costo);
      if (!nueva || nueva.arcos.length === 0) continue;
      if (nueva.arcos[0] !== veh.ruta[veh.i + 1]) veh.permiso = false;
      veh.ruta = veh.ruta.slice(0, veh.i + 1).concat(nueva.arcos);
    }
  }

  function marcarEsperas() {
    for (const e of estadoArco.values()) {
      const f = frente(e);
      tiempos.marcarEspera(e.id, f && f.quietoDesde !== null ? t - f.quietoDesde : 0);
    }
  }

  function contarEnCola() {
    let n = 0;
    for (const veh of vivos) if (veh.v < 1) n += 1;
    return n;
  }

  function estadoVias() {
    const acumulado = new Map();
    for (const e of estadoArco.values()) {
      for (const carril of e.carriles) {
        for (const veh of carril) {
          const x = acumulado.get(e.via.id) ?? { suma: 0, n: 0 };
          x.suma += veh.v / velocidadDeseada(veh.perfil, e.via, veh.conductor);
          x.n += 1;
          acumulado.set(e.via.id, x);
        }
      }
    }
    return [...acumulado].map(([viaId, { suma, n }]) => ({ viaId, ratio: Math.min(1, suma / n), vehiculos: n }));
  }

  function paso() {
    if (demanda) for (const viaje of demanda.generar(t, dt)) agregarVehiculo(viaje);
    intentarInsertar();
    calcularAceleraciones();
    mover();
    transferir();
    if (pasos % 2 === 0) cambiosDeCarril();
    liberarBloqueados();
    if (pasos % 4 === 0) {
      reRutear();
      marcarEsperas();
    }
    t += dt;
    pasos += 1;
    if (pasos % Math.round(1 / dt) === 0) metricas.muestra({ t, enRed: vivos.size, enCola: contarEnCola() });
  }

  return {
    get t() { return t; },
    dt,
    paso,
    avanzar(segundos) {
      const n = Math.round(segundos / dt);
      for (let k = 0; k < n; k++) paso();
    },
    agregarVehiculo,
    vehiculos: () => [...vivos],
    posiciones() {
      const datos = new Float64Array(vivos.size * 3);
      let j = 0;
      for (const veh of vivos) {
        const e = estadoArco.get(veh.ruta[veh.i]);
        const n = e.carriles.length;
        const lateral = e.via.sentido === 'ambos'
          ? (veh.carril + 0.5) * ANCHO_CARRIL
          : (veh.carril - (n - 1) / 2) * ANCHO_CARRIL;
        const [lon, lat] = posicionEnArco(e.geo, veh.s - veh.perfil.largo / 2, lateral);
        datos[j++] = lon;
        datos[j++] = lat;
        datos[j++] = veh.tipoIndice;
      }
      return { cantidad: vivos.size, datos };
    },
    estadoVias,
    usoVias: () => new Map(usoVias),
    configurarDemanda: (parcial) => demanda?.configurar(parcial),
    resumen() {
      const cuellos = estadoVias()
        .filter((x) => x.vehiculos >= 3)
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 5)
        .map((x) => {
          const via = red.vias.get(x.viaId);
          return { ...x, nombre: via.nombrePuente ?? (via.nombre || '(vía sin nombre)') };
        });
      return {
        t,
        ...metricas.resumen(),
        enRed: vivos.size,
        enCola: contarEnCola(),
        pendientes: pendientes.length,
        avisos: puntos.avisos,
        cuellos,
      };
    },
  };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/sim/motor.test.js`
Expected: PASS.

- [ ] **Step 5: Correr toda la suite**

Run: `npm test`
Expected: PASS en todos los archivos.

- [ ] **Step 6: Commit**

```bash
git add src/sim/motor.js tests/sim/motor.test.js
git commit -m "feat(sim): motor que mueve vehículos por la red con IDM"
```

---

### Task 10: Motor — cruces, re-ruteo, bloqueos y carriles

**Files:**
- Test: `tests/sim/motorCruces.test.js`
- Modify (solo si un test lo exige): `src/sim/motor.js`

**Interfaces:**
- Consumes: `crearMotor` (Task 9); `redCruce`, `redDosRutas`, `redLinea` (Task 3); `CONDUCTOR_NEUTRO` (Task 1).
- Produces: nada nuevo; fija el comportamiento del motor en cruces y en marcha.

El código de la Task 9 ya implementa estos comportamientos. Esta tarea los prueba en escenarios completos. Si un test falla, la causa se busca con superpowers:systematic-debugging y se corrige en `motor.js`.

- [ ] **Step 1: Escribir los tests**

`tests/sim/motorCruces.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearMotor } from '../../src/sim/motor.js';
import { CONDUCTOR_NEUTRO } from '../../src/sim/vehiculos.js';
import { redCruce, redDosRutas, redLinea } from './redesPrueba.js';

const viaje = (tipo, origen, destino) => ({ tipo, origen, destino, conductor: CONDUCTOR_NEUTRO });

function conRegistro(red, extra = {}) {
  const cruces = [];
  const terminados = [];
  const motor = crearMotor(red, {
    conDemanda: false,
    alCruzar: (veh, nodo, t) => cruces.push({ id: veh.id, nodo, t, arco: veh.ruta[veh.i - 1] }),
    alTerminar: (veh, t) => terminados.push({ id: veh.id, t }),
    ...extra,
  });
  return { motor, cruces, terminados };
}

// Velocidad mínima de un vehículo en los últimos `metros` de un arco.
function velocidadMinimaAntesDe(motor, veh, arcoId, metros, segundos) {
  let minima = Infinity;
  for (let k = 0; k < segundos / motor.dt; k++) {
    motor.paso();
    const largo = 200;
    if (veh.ruta[veh.i] === arcoId && veh.s > largo - metros) minima = Math.min(minima, veh.v);
  }
  return minima;
}

describe('motor · cruces', () => {
  it('en un pare el carro se detiene por completo antes de cruzar', () => {
    const { motor, terminados } = conRegistro(redCruce({ control: 'pare', accesosConPare: ['nc'] }));
    const carro = motor.agregarVehiculo(viaje('carro', 'n', 's'));
    expect(velocidadMinimaAntesDe(motor, carro, 'nc>', 10, 120)).toBeLessThan(0.3);
    expect(terminados).toHaveLength(1);
  });

  it('en la vía con prioridad no frena en el cruce', () => {
    const { motor, terminados } = conRegistro(redCruce({ control: 'pare', accesosConPare: ['nc'] }));
    const carro = motor.agregarVehiculo(viaje('carro', 'o', 'e'));
    expect(velocidadMinimaAntesDe(motor, carro, 'oc>', 30, 80)).toBeGreaterThan(4);
    expect(terminados).toHaveLength(1);
  });

  it('el que cede no entra al cruce al mismo tiempo que la avenida', () => {
    const { motor, cruces, terminados } = conRegistro(redCruce({ control: 'prioridad' }));
    const calle = motor.agregarVehiculo(viaje('carro', 'n', 's'));
    for (let k = 0; k < 10; k++) {
      motor.agregarVehiculo(viaje('carro', 'o', 'e'));
      motor.avanzar(6);
    }
    motor.avanzar(200);
    expect(terminados.some((x) => x.id === calle.id)).toBe(true);
    const tCalle = cruces.find((x) => x.id === calle.id && x.nodo === 'c').t;
    for (const x of cruces.filter((c) => c.nodo === 'c' && c.id !== calle.id)) {
      expect(Math.abs(x.t - tCalle)).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('sin señal entre vías iguales pasa primero el que viene por la derecha', () => {
    const iguales = { tipo: 'doble_sentido', sentido: 'ambos' };
    const { motor, cruces } = conRegistro(redCruce({ control: 'sin_senal', avenida: iguales, calle: iguales }));
    const haciaElEste = motor.agregarVehiculo(viaje('carro', 'o', 'e'));
    const haciaElSur = motor.agregarVehiculo(viaje('carro', 'n', 's'));
    motor.avanzar(120);
    const t = (veh) => cruces.find((x) => x.id === veh.id && x.nodo === 'c').t;
    // quien va al sur tiene a su derecha a quien viene del oeste: cede
    expect(t(haciaElEste)).toBeLessThan(t(haciaElSur));
  });

  it('cuatro vehículos llegando a la vez a un cruce sin señal no se traban', () => {
    const iguales = { tipo: 'doble_sentido', sentido: 'ambos' };
    const { motor, cruces, terminados } = conRegistro(redCruce({ control: 'sin_senal', avenida: iguales, calle: iguales }));
    for (const [o, d] of [['o', 'e'], ['e', 'o'], ['n', 's'], ['s', 'n']]) motor.agregarVehiculo(viaje('carro', o, d));
    motor.avanzar(150);
    expect(terminados).toHaveLength(4);
    expect(motor.resumen().bloqueos).toBe(0);
    const tiempos = cruces.filter((x) => x.nodo === 'c').map((x) => x.t).sort((a, b) => a - b);
    for (let k = 1; k < tiempos.length; k++) expect(tiempos[k] - tiempos[k - 1]).toBeGreaterThanOrEqual(0.5);
  });
});

describe('motor · rutas en marcha', () => {
  it('si se cierra la vía de adelante, el vehículo busca la alterna', () => {
    const red = redDosRutas();
    const { motor, terminados } = conRegistro(red);
    const carro = motor.agregarVehiculo(viaje('carro', 'a', 'd'));
    expect(carro.ruta).toEqual(['ab>', 'bd>']);
    motor.avanzar(2);
    red.vias.get('bd').abierta = false;
    motor.avanzar(150);
    expect(carro.ruta).toContain('bm>');
    expect(terminados).toHaveLength(1);
  });

  it('si no queda ninguna salida, el vehículo se libera como bloqueo', () => {
    const red = redDosRutas();
    const { motor } = conRegistro(red, { umbralBloqueo: 10 });
    motor.agregarVehiculo(viaje('carro', 'a', 'd'));
    motor.avanzar(2);
    red.vias.get('bd').abierta = false;
    red.vias.get('bm').abierta = false;
    motor.avanzar(120);
    const r = motor.resumen();
    expect(r.bloqueos).toBe(1);
    expect(r.enRed).toBe(0);
  });
});

describe('motor · carriles', () => {
  it('un carro rápido cambia de carril para pasar a un camión lento', () => {
    const red = redLinea({ tramos: 3, largo: 300, extra: { carrilesPorSentido: 2, velocidadMax: 60 } });
    const { motor, terminados } = conRegistro(red);
    const camion = motor.agregarVehiculo(viaje('camion', 'n0', 'n3'));
    motor.avanzar(10);
    const carro = motor.agregarVehiculo(viaje('carro', 'n0', 'n3'));
    let cambio = false;
    for (let k = 0; k < 400; k++) {
      motor.paso();
      if (carro.carril === 1) cambio = true;
    }
    expect(cambio).toBe(true);
    const fin = (veh) => terminados.find((x) => x.id === veh.id).t;
    expect(fin(carro)).toBeLessThan(fin(camion));
  });
});
```

- [ ] **Step 2: Correr los tests**

Run: `npx vitest run tests/sim/motorCruces.test.js`
Expected: PASS. Si algún test falla, aplicar superpowers:systematic-debugging, corregir la causa en `src/sim/motor.js` (o en el módulo que corresponda), volver a correr este archivo y luego `npm test`.

- [ ] **Step 3: Commit**

```bash
git add tests/sim/motorCruces.test.js src/sim
git commit -m "test(sim): cruces, re-ruteo, bloqueos y carriles del motor"
```

---

### Task 11: Motor sobre la red real de San Gil

**Files:**
- Test: `tests/sim/motorSanGil.test.js`
- Modify (solo si un test lo exige): `src/sim/*.js`, `src/escenarios/zonas.js`

**Interfaces:**
- Consumes: `crearMotor` (Task 9), `crearRed`, `public/data/red-sangil.json`.

- [ ] **Step 1: Escribir los tests**

`tests/sim/motorSanGil.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearRed } from '../../src/sim/red.js';
import { crearMotor } from '../../src/sim/motor.js';

const datos = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'red-sangil.json'), 'utf8'));
const ROJAS_PINILLA = 24670013;

const redSanGil = (cerrarOsm = []) => {
  const copia = structuredClone(datos);
  for (const v of copia.vias) if (cerrarOsm.includes(v.osmId)) v.abierta = false;
  return crearRed(copia);
};

describe('motor en San Gil', () => {
  it('todas las zonas y salidas existen en la red', () => {
    const motor = crearMotor(redSanGil(), { conDemanda: false });
    expect(motor.resumen().avisos).toEqual([]);
  });

  it('15 minutos de hora pico: hay tráfico, viajes completos y ninguna posición inválida', () => {
    const inicio = Date.now();
    const motor = crearMotor(redSanGil(), { semilla: 1, demanda: { horaInicio: 7 } });
    motor.avanzar(900);
    const r = motor.resumen();
    console.log(`15 min simulados en ${((Date.now() - inicio) / 1000).toFixed(1)} s:`, JSON.stringify({
      enRed: r.enRed, completados: r.viajesCompletados, imposibles: r.viajesImposibles,
      bloqueos: r.bloqueos, tiempoMedio: Math.round(r.tiempoMedio), demoraMedia: Math.round(r.demoraMedia),
    }));
    expect(r.viajesCompletados).toBeGreaterThan(50);
    expect(r.enRed).toBeGreaterThan(20);
    expect(r.bloqueos).toBeLessThan(r.viajesCompletados * 0.2);
    const { bbox } = datos;
    const { cantidad, datos: pos } = motor.posiciones();
    for (let k = 0; k < cantidad; k++) {
      expect(pos[k * 3]).toBeGreaterThan(bbox.oeste - 0.05);
      expect(pos[k * 3]).toBeLessThan(bbox.este + 0.05);
      expect(pos[k * 3 + 1]).toBeGreaterThan(bbox.sur - 0.05);
      expect(pos[k * 3 + 1]).toBeLessThan(bbox.norte + 0.05);
    }
  }, 180000);

  it('misma semilla, mismo resultado', () => {
    const correr = () => {
      const motor = crearMotor(redSanGil(), { semilla: 7, demanda: { horaInicio: 7 } });
      motor.avanzar(120);
      return { resumen: motor.resumen(), posiciones: [...motor.posiciones().datos] };
    };
    expect(correr()).toEqual(correr());
  }, 60000);

  it('cerrar el Rojas Pinilla empeora la demora y nadie pasa por él', () => {
    const correr = (cerrar) => {
      const motor = crearMotor(redSanGil(cerrar), { semilla: 3, demanda: { horaInicio: 7 } });
      motor.avanzar(1800);
      return motor;
    };
    const base = correr([]);
    const cerrado = correr([ROJAS_PINILLA]);
    const rb = base.resumen();
    const rc = cerrado.resumen();
    console.log('base:', Math.round(rb.demoraMedia), 's · cerrado:', Math.round(rc.demoraMedia), 's');
    expect(rc.demoraMedia).toBeGreaterThan(rb.demoraMedia);
    const viasRojas = datos.vias.filter((v) => v.osmId === ROJAS_PINILLA).map((v) => v.id);
    for (const id of viasRojas) expect(cerrado.usoVias().get(id) ?? 0).toBe(0);
  }, 600000);
});
```

- [ ] **Step 2: Correr los tests**

Run: `npx vitest run tests/sim/motorSanGil.test.js`
Expected: PASS, y en la consola el tiempo que tardaron 15 minutos simulados y la demora base frente a la demora con el puente cerrado.

Si falla:
- "zonas y salidas": corregir el nodo en `src/escenarios/zonas.js` con el que reporte el aviso (buscar el nodo de borde más cercano con `npm run red`).
- Rendimiento: si 15 minutos simulados tardan más de 60 s, perfilar con `node --cpu-prof` sobre un script que llame `crearMotor(...).avanzar(900)` y optimizar el punto caliente (lo más probable: `rutaMasRapida` en `reRutear`).
- "cerrar el Rojas Pinilla": aplicar superpowers:systematic-debugging; un resultado inverso es un hallazgo del modelo y se registra antes de tocar código.

- [ ] **Step 3: Commit**

```bash
git add tests/sim/motorSanGil.test.js src
git commit -m "test(sim): motor sobre la red real de San Gil"
```

---

### Task 12: Worker de simulación

**Files:**
- Create: `src/worker/controlador.js`, `src/worker/simulacion.worker.js`, `src/worker/clienteSimulacion.js`
- Modify: `src/ui/datos/cargarRed.js`
- Test: `tests/worker/controlador.test.js`, `tests/ui/cargarRed.test.js`

**Interfaces:**
- Consumes: `crearRed`, `validarRed` (`src/sim/red.js`), `crearMotor` (Task 9), `datosRedLinea` (Task 3).
- Produces:
  - `crearReloj() → { pasos(velocidad, ms, dt) → número de pasos (Infinity si 'max'), reiniciar() }`.
  - `crearControlador(enviar: (mensaje, transferibles?) => void, { ahora, presupuestoMs }) → { recibir(mensaje), tick(ms) }`.
  - `crearClienteSimulacion(alRecibir) → { iniciar(datosRed, opciones), reloj(corriendo, velocidad), demanda(parcial), terminar() }`.
  - `cargarDatosRed(fetchFn?, url?) → Promise<datos crudos validados>`; `cargarRed` se mantiene.

- [ ] **Step 1: Escribir los tests del controlador**

`tests/worker/controlador.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearReloj, crearControlador } from '../../src/worker/controlador.js';
import { datosRedLinea } from '../sim/redesPrueba.js';

describe('crearReloj', () => {
  it('a ×1 con ticks de 50 ms da un paso de 0,5 s cada 10 ticks', () => {
    const reloj = crearReloj();
    const pasos = Array.from({ length: 10 }, () => reloj.pasos(1, 50, 0.5));
    expect(pasos.slice(0, 9).every((n) => n === 0)).toBe(true);
    expect(pasos[9]).toBe(1);
  });

  it('a ×20 da dos pasos por tick y en máximo no tiene límite', () => {
    expect(crearReloj().pasos(20, 50, 0.5)).toBe(2);
    expect(crearReloj().pasos('max', 50, 0.5)).toBe(Infinity);
  });
});

describe('crearControlador', () => {
  const armar = () => {
    const enviados = [];
    const controlador = crearControlador((m) => enviados.push(m), { ahora: () => 0, presupuestoMs: 35 });
    return { enviados, controlador };
  };

  it('ignora órdenes antes de iniciar', () => {
    const { enviados, controlador } = armar();
    expect(() => {
      controlador.recibir({ tipo: 'reloj', corriendo: true, velocidad: 5 });
      controlador.recibir({ tipo: 'demanda', parcial: { factor: 2 } });
      controlador.tick(50);
    }).not.toThrow();
    expect(enviados).toEqual([]);
  });

  it('una red inválida responde un error legible', () => {
    const { enviados, controlador } = armar();
    controlador.recibir({ tipo: 'iniciar', datosRed: { version: 1 }, opciones: {} });
    expect(enviados).toEqual([expect.objectContaining({ tipo: 'error', mensaje: expect.stringMatching(/Red inválida/) })]);
  });

  it('al iniciar envía un cuadro y un resumen; corriendo, avanza el tiempo', () => {
    const { enviados, controlador } = armar();
    controlador.recibir({ tipo: 'iniciar', datosRed: datosRedLinea(), opciones: { conDemanda: false } });
    expect(enviados.map((m) => m.tipo)).toEqual(['cuadro', 'resumen']);
    controlador.tick(50);
    expect(enviados).toHaveLength(2); // en pausa no avanza
    controlador.recibir({ tipo: 'reloj', corriendo: true, velocidad: 20 });
    controlador.tick(50);
    const cuadro = enviados.at(-1);
    expect(cuadro.tipo).toBe('cuadro');
    expect(cuadro.t).toBe(1);
  });
});
```

- [ ] **Step 2: Agregar el test de `cargarDatosRed`**

Agregar al final de `tests/ui/cargarRed.test.js`:

```js
describe('cargarDatosRed', () => {
  it('devuelve los datos crudos ya validados, listos para enviar al worker', async () => {
    const { cargarDatosRed } = await import('../../src/ui/datos/cargarRed.js');
    const datos = await cargarDatosRed(respuesta({ json: async () => redMinima }));
    expect(datos).toBe(redMinima);
    await expect(cargarDatosRed(respuesta({ json: async () => ({ version: 1 }) }))).rejects.toThrow(/Red inválida/);
  });
});
```

- [ ] **Step 3: Correr y verificar que fallan**

Run: `npx vitest run tests/worker/controlador.test.js tests/ui/cargarRed.test.js`
Expected: FAIL: no se puede resolver `src/worker/controlador.js`, y `cargarDatosRed` no es una función.

- [ ] **Step 4: Implementar `src/worker/controlador.js`**

```js
// Lógica del worker de simulación, separada de `self` para poder probarla.
// Recibe órdenes de la interfaz, avanza el motor en ticks y envía posiciones
// y métricas.

import { crearRed } from '../sim/red.js';
import { crearMotor } from '../sim/motor.js';

export function crearReloj() {
  let acumulado = 0;
  return {
    pasos(velocidad, ms, dt) {
      if (velocidad === 'max') return Infinity;
      acumulado += (velocidad * ms) / 1000;
      const n = Math.floor(acumulado / dt + 1e-9);
      acumulado -= n * dt;
      return n;
    },
    reiniciar() { acumulado = 0; },
  };
}

export function crearControlador(enviar, { ahora = () => performance.now(), presupuestoMs = 35 } = {}) {
  let motor = null;
  let corriendo = false;
  let velocidad = 1;
  let ultimoResumen = -Infinity;
  const reloj = crearReloj();

  function enviarCuadro() {
    const { cantidad, datos } = motor.posiciones();
    enviar({ tipo: 'cuadro', t: motor.t, cantidad, datos }, [datos.buffer]);
  }

  function enviarResumen() {
    enviar({ tipo: 'resumen', resumen: motor.resumen(), vias: motor.estadoVias() });
    ultimoResumen = ahora();
  }

  return {
    recibir(mensaje) {
      try {
        if (mensaje.tipo === 'iniciar') {
          motor = crearMotor(crearRed(mensaje.datosRed), mensaje.opciones);
          corriendo = false;
          reloj.reiniciar();
          enviarCuadro();
          enviarResumen();
        } else if (mensaje.tipo === 'reloj') {
          corriendo = Boolean(mensaje.corriendo);
          velocidad = mensaje.velocidad;
        } else if (mensaje.tipo === 'demanda') {
          motor?.configurarDemanda(mensaje.parcial);
        }
      } catch (err) {
        motor = null;
        enviar({ tipo: 'error', mensaje: err.message });
      }
    },
    tick(ms) {
      if (!motor || !corriendo) return;
      const inicio = ahora();
      const n = reloj.pasos(velocidad, ms, motor.dt);
      for (let k = 0; k < n; k++) {
        motor.paso();
        if (ahora() - inicio > presupuestoMs) break;
      }
      enviarCuadro();
      if (ahora() - ultimoResumen >= 1000) enviarResumen();
    },
  };
}
```

- [ ] **Step 5: Implementar `src/worker/simulacion.worker.js` y `src/worker/clienteSimulacion.js`**

`src/worker/simulacion.worker.js`:

```js
import { crearControlador } from './controlador.js';

const TICK_MS = 50;
const controlador = crearControlador((mensaje, transferibles) => self.postMessage(mensaje, transferibles ?? []));

self.onmessage = ({ data }) => controlador.recibir(data);
setInterval(() => controlador.tick(TICK_MS), TICK_MS);
```

`src/worker/clienteSimulacion.js`:

```js
// Lado de la interfaz: crea el worker y le envía órdenes.

export function crearClienteSimulacion(alRecibir) {
  const worker = new Worker(new URL('./simulacion.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => alRecibir(data);
  worker.onerror = (evento) => alRecibir({ tipo: 'error', mensaje: evento.message || 'Falló el worker de simulación' });

  return {
    iniciar: (datosRed, opciones) => worker.postMessage({ tipo: 'iniciar', datosRed, opciones }),
    reloj: (corriendo, velocidad) => worker.postMessage({ tipo: 'reloj', corriendo, velocidad }),
    demanda: (parcial) => worker.postMessage({ tipo: 'demanda', parcial }),
    terminar: () => worker.terminate(),
  };
}
```

- [ ] **Step 6: Separar `cargarDatosRed` en `src/ui/datos/cargarRed.js`**

Reemplazar el contenido completo del archivo:

```js
import { crearRed, validarRed } from '../../sim/red.js';

// Relativa a la base de la app, para que funcione aunque se publique en una subcarpeta.
export const urlRed = (base = import.meta.env?.BASE_URL ?? '/') => `${base}data/red-sangil.json`;
export const URL_RED = urlRed();

// Datos crudos ya validados: así se envían al worker, que arma su propia red.
export async function cargarDatosRed(fetchFn = globalThis.fetch, url = URL_RED) {
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
  const errores = validarRed(datos);
  if (errores.length) throw new Error(`Red inválida:\n- ${errores.slice(0, 10).join('\n- ')}`);
  return datos;
}

export async function cargarRed(fetchFn, url) {
  return crearRed(await cargarDatosRed(fetchFn, url));
}
```

- [ ] **Step 7: Correr y verificar que pasan**

Run: `npx vitest run tests/worker/controlador.test.js tests/ui/cargarRed.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/worker src/ui/datos/cargarRed.js tests/worker tests/ui/cargarRed.test.js
git commit -m "feat(worker): simulación en un Web Worker con controlador probado"
```

---

### Task 13: Interfaz — vehículos, reloj, demanda y métricas

**Files:**
- Create: `src/ui/formato.js`, `src/ui/mapa/estilosVehiculo.js`, `src/ui/paneles/BarraTiempo.jsx`, `src/ui/paneles/PanelTrafico.jsx`, `src/ui/paneles/PanelMetricas.jsx`
- Modify (reemplazo completo): `src/ui/mapa/MapaSanGil.jsx`, `src/ui/paneles/Leyenda.jsx`, `src/ui/App.jsx`
- Modify: `src/ui/estilos.css` (agregar al final)
- Test: `tests/ui/formato.test.js`, `tests/ui/estilosVehiculo.test.js`

**Interfaces:**
- Consumes: `crearClienteSimulacion` (Task 12), `cargarDatosRed` (Task 12), `TIPOS_VEHICULO`, `ETIQUETA_VEHICULO` (Task 1).
- Produces:
  - `formatearHora(horaInicio, t) → 'HH:MM'`, `formatearDuracion(segundos) → texto`.
  - `COLOR_VEHICULO`, `COLOR_POR_INDICE`, `RADIO_POR_INDICE`, `COLOR_SIN_TRAFICO`, `colorCongestion(ratio?)`, `ESCALA_CONGESTION`.
  - Componentes: `<BarraTiempo t horaInicio corriendo velocidad onAlternar onVelocidad />`, `<PanelTrafico config onCambiar colorPor onColorPor onReiniciar />`, `<PanelMetricas resumen onSeleccionarVia />`, `<Leyenda colorPor />`, `<MapaSanGil red vehiculos colorPor congestion viaSeleccionada onSeleccionarVia />`.

- [ ] **Step 1: Escribir los tests de las funciones puras**

`tests/ui/formato.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { formatearHora, formatearDuracion } from '../../src/ui/formato.js';

describe('formatearHora', () => {
  it('suma el tiempo simulado a la hora de inicio', () => {
    expect(formatearHora(7, 0)).toBe('07:00');
    expect(formatearHora(7, 3600 + 30 * 60 + 59)).toBe('08:30');
    expect(formatearHora(23, 2 * 3600)).toBe('01:00');
  });
});

describe('formatearDuracion', () => {
  it('escribe segundos y minutos', () => {
    expect(formatearDuracion(45.4)).toBe('45 s');
    expect(formatearDuracion(120)).toBe('2 min');
    expect(formatearDuracion(200)).toBe('3 min 20 s');
    expect(formatearDuracion(NaN)).toBe('—');
  });
});
```

`tests/ui/estilosVehiculo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { TIPOS_VEHICULO } from '../../src/sim/vehiculos.js';
import {
  COLOR_VEHICULO, COLOR_POR_INDICE, RADIO_POR_INDICE, colorCongestion, COLOR_SIN_TRAFICO,
} from '../../src/ui/mapa/estilosVehiculo.js';

describe('estilos de vehículo', () => {
  it('todo tipo tiene color y radio, en el orden de TIPOS_VEHICULO', () => {
    TIPOS_VEHICULO.forEach((tipo, i) => {
      expect(COLOR_VEHICULO[tipo]).toHaveLength(3);
      expect(COLOR_POR_INDICE[i]).toBe(COLOR_VEHICULO[tipo]);
      expect(RADIO_POR_INDICE[i]).toBeGreaterThan(0);
    });
  });
});

describe('colorCongestion', () => {
  it('va de verde a vino tinto según qué tan rápido fluye', () => {
    expect(colorCongestion(0.9)).toEqual([46, 160, 67]);
    expect(colorCongestion(0.5)).toEqual([241, 196, 15]);
    expect(colorCongestion(0.2)).toEqual([214, 69, 65]);
    expect(colorCongestion(0.05)).toEqual([120, 20, 30]);
  });

  it('sin vehículos la vía queda en gris', () => {
    expect(colorCongestion(undefined)).toBe(COLOR_SIN_TRAFICO);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/ui/formato.test.js tests/ui/estilosVehiculo.test.js`
Expected: FAIL, no se pueden resolver los módulos.

- [ ] **Step 3: Implementar `src/ui/formato.js` y `src/ui/mapa/estilosVehiculo.js`**

`src/ui/formato.js`:

```js
const dos = (n) => String(n).padStart(2, '0');

export function formatearHora(horaInicio, t) {
  const total = Math.floor(horaInicio * 3600 + t);
  const horas = Math.floor(total / 3600) % 24;
  const minutos = Math.floor((total % 3600) / 60);
  return `${dos(horas)}:${dos(minutos)}`;
}

export function formatearDuracion(segundos) {
  if (!Number.isFinite(segundos)) return '—';
  const s = Math.round(segundos);
  if (s < 60) return `${s} s`;
  const minutos = Math.floor(s / 60);
  const resto = s % 60;
  return resto ? `${minutos} min ${resto} s` : `${minutos} min`;
}
```

`src/ui/mapa/estilosVehiculo.js`:

```js
import { TIPOS_VEHICULO } from '../../sim/vehiculos.js';

export const COLOR_VEHICULO = {
  moto: [230, 126, 34],
  carro: [41, 128, 185],
  buseta: [39, 174, 96],
  bus_nacional: [142, 68, 173],
  bus_intermunicipal: [22, 160, 133],
  camion: [44, 62, 80],
};

const RADIO_VEHICULO = { moto: 1.5, carro: 2.2, buseta: 3, bus_nacional: 4, bus_intermunicipal: 3.5, camion: 4.5 };

// El motor envía el índice del tipo; estos arreglos se leen por ese índice.
export const COLOR_POR_INDICE = TIPOS_VEHICULO.map((tipo) => COLOR_VEHICULO[tipo]);
export const RADIO_POR_INDICE = TIPOS_VEHICULO.map((tipo) => RADIO_VEHICULO[tipo]);

export const COLOR_SIN_TRAFICO = [180, 186, 194];

export function colorCongestion(ratio) {
  if (ratio === undefined || ratio === null) return COLOR_SIN_TRAFICO;
  if (ratio >= 0.7) return [46, 160, 67];
  if (ratio >= 0.4) return [241, 196, 15];
  if (ratio >= 0.15) return [214, 69, 65];
  return [120, 20, 30];
}

export const ESCALA_CONGESTION = [
  { etiqueta: 'Fluido', color: [46, 160, 67] },
  { etiqueta: 'Lento', color: [241, 196, 15] },
  { etiqueta: 'Congestionado', color: [214, 69, 65] },
  { etiqueta: 'Detenido', color: [120, 20, 30] },
  { etiqueta: 'Sin tráfico', color: COLOR_SIN_TRAFICO },
];
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/ui/formato.test.js tests/ui/estilosVehiculo.test.js`
Expected: PASS.

- [ ] **Step 5: Crear los paneles**

`src/ui/paneles/BarraTiempo.jsx`:

```jsx
import { formatearHora } from '../formato.js';

const VELOCIDADES = [1, 5, 20, 'max'];

export default function BarraTiempo({ t, horaInicio, corriendo, velocidad, onAlternar, onVelocidad }) {
  return (
    <div className="tiempo">
      <button type="button" className="principal" onClick={onAlternar}>
        {corriendo ? '⏸ Pausa' : '▶ Simular'}
      </button>
      <span className="reloj" aria-label="Hora simulada">{formatearHora(horaInicio, t)}</span>
      <div className="velocidades" role="group" aria-label="Velocidad de simulación">
        {VELOCIDADES.map((v) => (
          <button
            key={v}
            type="button"
            className={v === velocidad ? 'activa' : ''}
            onClick={() => onVelocidad(v)}
          >
            {v === 'max' ? 'Máx' : `×${v}`}
          </button>
        ))}
      </div>
    </div>
  );
}
```

`src/ui/paneles/PanelTrafico.jsx`:

```jsx
const HORAS = Array.from({ length: 24 }, (_, h) => h);

export default function PanelTrafico({ config, onCambiar, colorPor, onColorPor, onReiniciar }) {
  return (
    <section className="panel controles">
      <h2>Tráfico</h2>
      <label>
        <span>Cantidad de vehículos: <strong>{Math.round(config.factor * 100)} %</strong></span>
        <input
          type="range" min="0" max="2" step="0.1" value={config.factor}
          onChange={(e) => onCambiar({ factor: Number(e.target.value) })}
        />
      </label>
      <label>
        <span>Temporada</span>
        <select value={config.temporada} onChange={(e) => onCambiar({ temporada: Number(e.target.value) })}>
          <option value={1}>Normal</option>
          <option value={1.4}>Alta (festivos, turismo) ×1,4</option>
        </select>
      </label>
      <label>
        <span>Hora de inicio</span>
        <select value={config.horaInicio} onChange={(e) => onCambiar({ horaInicio: Number(e.target.value) })}>
          {HORAS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
        </select>
      </label>
      <p className="nota">Cambiar la hora de inicio reinicia la simulación.</p>
      <fieldset>
        <legend>Colorear vías por</legend>
        <label className="opcion">
          <input type="radio" name="colorPor" checked={colorPor === 'tipo'} onChange={() => onColorPor('tipo')} />
          Tipo de vía
        </label>
        <label className="opcion">
          <input type="radio" name="colorPor" checked={colorPor === 'congestion'} onChange={() => onColorPor('congestion')} />
          Congestión
        </label>
      </fieldset>
      <button type="button" onClick={onReiniciar}>Reiniciar simulación</button>
    </section>
  );
}
```

`src/ui/paneles/PanelMetricas.jsx`:

```jsx
import { formatearDuracion } from '../formato.js';

export default function PanelMetricas({ resumen, onSeleccionarVia }) {
  if (!resumen) return null;
  const filas = [
    ['Vehículos en la vía', resumen.enRed],
    ['Detenidos o en cola', resumen.enCola],
    ['Esperando para entrar', resumen.pendientes],
    ['Viajes completados', resumen.viajesCompletados],
    ['Tiempo medio de viaje', formatearDuracion(resumen.tiempoMedio)],
    ['Demora media', formatearDuracion(resumen.demoraMedia)],
    ['Bloqueos', resumen.bloqueos],
    ['Viajes imposibles', resumen.viajesImposibles],
  ];

  return (
    <section className="panel metricas">
      <h2>Métricas</h2>
      {resumen.t === 0 && <p className="nota">La simulación arranca en pausa: dale ▶ Simular.</p>}
      <dl>
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      {resumen.cuellos.length > 0 && (
        <>
          <h3>Cuellos de botella ahora</h3>
          <ol className="cuellos">
            {resumen.cuellos.map((c) => (
              <li key={c.viaId}>
                <button type="button" onClick={() => onSeleccionarVia(c.viaId)}>
                  {c.nombre}
                  <span>{Math.round(c.ratio * 100)} % de su velocidad · {c.vehiculos} veh.</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
      {resumen.avisos.length > 0 && (
        <p className="aviso">{resumen.avisos.join(' · ')}</p>
      )}
    </section>
  );
}
```

`src/ui/paneles/Leyenda.jsx` (reemplazo completo):

```jsx
import { TIPOS_VIA, ETIQUETA_TIPO } from '../../sim/tipos.js';
import { TIPOS_VEHICULO, ETIQUETA_VEHICULO } from '../../sim/vehiculos.js';
import { COLOR_TIPO, COLOR_PUENTE, COLOR_PARE } from '../mapa/estilosVia.js';
import { COLOR_VEHICULO, ESCALA_CONGESTION } from '../mapa/estilosVehiculo.js';

const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

export default function Leyenda({ colorPor }) {
  return (
    <section className="panel leyenda">
      <h2>{colorPor === 'congestion' ? 'Congestión' : 'Tipos de vía'}</h2>
      <ul>
        {colorPor === 'congestion'
          ? ESCALA_CONGESTION.map(({ etiqueta, color }) => (
            <li key={etiqueta}>
              <span className="muestra-linea" style={{ background: rgb(color) }} />
              {etiqueta}
            </li>
          ))
          : TIPOS_VIA.map((tipo) => (
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
      <h3>Vehículos</h3>
      <ul>
        {TIPOS_VEHICULO.map((tipo) => (
          <li key={tipo}>
            <span className="muestra-punto" style={{ background: rgb(COLOR_VEHICULO[tipo]) }} />
            {ETIQUETA_VEHICULO[tipo]}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: Reemplazar `src/ui/mapa/MapaSanGil.jsx`**

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
import { COLOR_POR_INDICE, RADIO_POR_INDICE, colorCongestion } from './estilosVehiculo.js';

const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron';
const VISTA_INICIAL = { longitude: -73.134, latitude: 6.555, zoom: 14.5, pitch: 0, bearing: 0 };
const PUNTEADO = new PathStyleExtension({ dash: true });

export default function MapaSanGil({ red, vehiculos, colorPor, congestion, viaSeleccionada, onSeleccionarVia }) {
  const vias = useMemo(() => [...red.vias.values()], [red]);
  const puentes = useMemo(() => vias.filter((v) => v.esPuente), [vias]);
  const flechas = useMemo(() => flechasDeVias(vias), [vias]);
  const etiquetasPuentes = useMemo(
    () => puentes
      .filter((v) => v.nombrePuente)
      .map((v) => ({ texto: v.nombrePuente.replace(/\s*\(.*\)$/, ''), posicion: v.geometria[Math.floor(v.geometria.length / 2)] })),
    [puentes],
  );
  const pares = useMemo(() => [...red.nodos.values()].filter((n) => n.control === 'pare'), [red]);

  const colorDeVia = (v) => {
    if (v.id === viaSeleccionada) return COLOR_SELECCION;
    return colorPor === 'congestion' ? colorCongestion(congestion.get(v.id)) : colorVia(v);
  };

  const { cantidad, datos } = vehiculos;

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
      getColor: colorDeVia,
      getWidth: anchoVia,
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      pickable: true,
      getDashArray: (v) => (v.enConstruccion ? [4, 3] : [0, 0]),
      dashJustified: true,
      extensions: [PUNTEADO],
      updateTriggers: { getColor: [viaSeleccionada, colorPor, congestion] },
    }),
    new TextLayer({
      id: 'flechas',
      data: flechas,
      getPosition: (f) => f.posicion,
      getText: () => '▶',
      getAngle: (f) => f.angulo,
      getSize: 16,
      getColor: [30, 40, 50],
      fontFamily: 'Arial, sans-serif',
      characterSet: ['▶'],
      outlineWidth: 2,
      outlineColor: [255, 255, 255],
      fontSettings: { sdf: true },
    }),
    new ScatterplotLayer({
      id: 'vehiculos',
      data: { length: cantidad },
      getPosition: (_, { index }) => [datos[index * 3], datos[index * 3 + 1]],
      getFillColor: (_, { index }) => COLOR_POR_INDICE[datos[index * 3 + 2]],
      getRadius: (_, { index }) => RADIO_POR_INDICE[datos[index * 3 + 2]],
      radiusUnits: 'meters',
      radiusMinPixels: 2,
      radiusMaxPixels: 9,
      stroked: true,
      getLineColor: [255, 255, 255],
      lineWidthMinPixels: 0.5,
      updateTriggers: { getPosition: datos, getFillColor: datos, getRadius: datos },
    }),
    new TextLayer({
      id: 'nombres-puentes',
      data: etiquetasPuentes,
      getPosition: (e) => e.posicion,
      getText: (e) => e.texto,
      getSize: 12,
      getColor: [60, 45, 0],
      getPixelOffset: [0, -16],
      fontFamily: 'system-ui, Segoe UI, Arial, sans-serif',
      fontWeight: 600,
      fontSettings: { sdf: true },
      outlineWidth: 3,
      outlineColor: [255, 255, 255],
      characterSet: 'auto',
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
      onClick={(info) => onSeleccionarVia(info.layer?.id === 'vias' ? info.object.id : null)}
      getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
    >
      <Map mapStyle={ESTILO_MAPA} />
    </DeckGL>
  );
}
```

- [ ] **Step 7: Reemplazar `src/ui/App.jsx`**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarDatosRed } from './datos/cargarRed.js';
import { crearRed } from '../sim/red.js';
import { crearClienteSimulacion } from '../worker/clienteSimulacion.js';
import MapaSanGil from './mapa/MapaSanGil.jsx';
import Leyenda from './paneles/Leyenda.jsx';
import FichaVia from './paneles/FichaVia.jsx';
import BarraTiempo from './paneles/BarraTiempo.jsx';
import PanelTrafico from './paneles/PanelTrafico.jsx';
import PanelMetricas from './paneles/PanelMetricas.jsx';
import './estilos.css';

const CONFIG_INICIAL = { factor: 1, temporada: 1, horaInicio: 7 };
const SIN_VEHICULOS = { cantidad: 0, datos: new Float64Array(0), t: 0 };

export default function App() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [viaSeleccionada, setViaSeleccionada] = useState(null);
  const [vehiculos, setVehiculos] = useState(SIN_VEHICULOS);
  const [resumen, setResumen] = useState(null);
  const [congestion, setCongestion] = useState(() => new Map());
  const [corriendo, setCorriendo] = useState(false);
  const [velocidad, setVelocidad] = useState(5);
  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [colorPor, setColorPor] = useState('tipo');
  const [reinicios, setReinicios] = useState(0);
  const cliente = useRef(null);

  const red = useMemo(() => (datos ? crearRed(datos) : null), [datos]);

  useEffect(() => {
    cargarDatosRed().then(setDatos).catch((err) => setError(err.message));
  }, []);

  // Crea el worker; se vuelve a crear al reiniciar. La configuración se lee aquí,
  // por eso cambiar la hora de inicio exige reiniciar.
  useEffect(() => {
    if (!datos) return undefined;
    const c = crearClienteSimulacion((mensaje) => {
      if (mensaje.tipo === 'cuadro') {
        setVehiculos({ cantidad: mensaje.cantidad, datos: mensaje.datos, t: mensaje.t });
      } else if (mensaje.tipo === 'resumen') {
        setResumen(mensaje.resumen);
        setCongestion(new Map(mensaje.vias.map((x) => [x.viaId, x.ratio])));
      } else if (mensaje.tipo === 'error') {
        setError(mensaje.mensaje);
      }
    });
    c.iniciar(datos, { semilla: 1, demanda: config });
    cliente.current = c;
    setCorriendo(false);
    setVehiculos(SIN_VEHICULOS);
    return () => c.terminar();
  }, [datos, reinicios]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cliente.current?.reloj(corriendo, velocidad);
  }, [corriendo, velocidad, reinicios]);

  const cambiarDemanda = (parcial) => {
    setConfig((actual) => ({ ...actual, ...parcial }));
    if ('horaInicio' in parcial) setReinicios((n) => n + 1);
    else cliente.current?.demanda(parcial);
  };

  if (error) {
    return (
      <main className="pantalla-mensaje">
        <h1>No se pudo cargar el simulador</h1>
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
        <BarraTiempo
          t={vehiculos.t}
          horaInicio={config.horaInicio}
          corriendo={corriendo}
          velocidad={velocidad}
          onAlternar={() => setCorriendo((c) => !c)}
          onVelocidad={setVelocidad}
        />
      </header>
      <div className="contenido">
        <MapaSanGil
          red={red}
          vehiculos={vehiculos}
          colorPor={colorPor}
          congestion={congestion}
          viaSeleccionada={viaSeleccionada}
          onSeleccionarVia={setViaSeleccionada}
        />
        <aside className="lateral lateral-izq">
          <PanelTrafico
            config={config}
            onCambiar={cambiarDemanda}
            colorPor={colorPor}
            onColorPor={setColorPor}
            onReiniciar={() => setReinicios((n) => n + 1)}
          />
          <Leyenda colorPor={colorPor} />
        </aside>
        <aside className="lateral">
          {via && <FichaVia via={via} onCerrar={() => setViaSeleccionada(null)} />}
          <PanelMetricas resumen={resumen} onSeleccionarVia={setViaSeleccionada} />
        </aside>
        <footer className="atribucion">{red.meta.fuente}</footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Agregar estilos al final de `src/ui/estilos.css`**

```css
/* --- Etapa 2: reloj, controles y métricas --- */

.barra { align-items: center; flex-wrap: wrap; }

.tiempo { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tiempo .reloj { font-variant-numeric: tabular-nums; font-size: 18px; font-weight: 600; min-width: 56px; }
.velocidades { display: flex; gap: 2px; }

button {
  font: inherit; font-size: 13px; padding: 5px 10px; border-radius: 6px;
  border: 1px solid var(--borde); background: var(--panel); color: var(--texto); cursor: pointer;
}
button:hover { border-color: #9aa5b1; }
button.activa { background: var(--texto); color: #fff; border-color: var(--texto); }
button.principal { background: #1f6feb; color: #fff; border-color: #1f6feb; font-weight: 600; }

.lateral-izq { left: 12px; right: auto; }

.controles label { display: grid; gap: 4px; margin-bottom: 10px; font-size: 13px; }
.controles select, .controles input[type='range'] { width: 100%; font: inherit; }
.controles fieldset { border: 1px solid var(--borde); border-radius: 6px; margin: 0 0 10px; padding: 6px 10px; font-size: 13px; }
.controles legend { color: var(--tenue); padding: 0 4px; }
.controles .opcion { display: flex; align-items: center; gap: 6px; margin: 4px 0; }

.panel h3 { margin: 10px 0 6px; font-size: 13px; color: var(--tenue); }
.metricas dl { margin: 0; display: grid; gap: 4px; font-size: 13px; }
.metricas dl div { display: flex; justify-content: space-between; gap: 8px; }
.metricas dt { color: var(--tenue); }
.metricas dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.cuellos { margin: 0; padding-left: 18px; font-size: 13px; display: grid; gap: 4px; }
.cuellos button {
  border: none; padding: 0; background: none; text-align: left; display: grid; color: var(--texto);
}
.cuellos button span { color: var(--tenue); font-size: 12px; }
.aviso { margin: 8px 0 0; font-size: 12px; color: #b9770e; }

@media (max-width: 640px) {
  .lateral-izq { top: 12px; bottom: auto; left: 12px; right: 12px; max-height: 35%; }
  .lateral { top: auto; bottom: 36px; max-height: 35%; }
  .tiempo { width: 100%; }
}
```

- [ ] **Step 9: Verificar en el navegador**

Run: `npm run dev` y abrir la dirección que muestra la terminal.

Revisar uno por uno:
- [ ] Carga el mapa con los paneles: "Tráfico" y leyenda a la izquierda, "Métricas" a la derecha, reloj en la barra superior marcando 07:00.
- [ ] Al dar ▶ Simular aparecen vehículos de colores que se mueven por las vías, y el reloj avanza.
- [ ] Los vehículos frenan en los cruces y se forman colas; en las calles de doble sentido cada sentido va por su lado.
- [ ] ×1, ×5, ×20 y Máx cambian la velocidad del reloj; ⏸ Pausa detiene todo.
- [ ] Mover "Cantidad de vehículos" a 200 % aumenta los vehículos en la vía en el panel de métricas al cabo de un minuto simulado.
- [ ] "Colorear vías por: Congestión" pinta las vías con tráfico de verde a rojo y la leyenda cambia a la escala de congestión.
- [ ] Un clic en un cuello de botella del panel selecciona esa vía y abre su ficha.
- [ ] Cambiar la hora de inicio reinicia el reloj en esa hora.
- [ ] La consola del navegador no muestra errores.
- [ ] A 375 px de ancho los paneles no tapan el reloj y no hay barra de desplazamiento horizontal.

- [ ] **Step 10: Verificar tests y build**

Run: `npm test && npm run build`
Expected: todos los tests en PASS y `✓ built in ...`.

- [ ] **Step 11: Commit**

```bash
git add src/ui tests/ui
git commit -m "feat(ui): vehículos en el mapa, reloj, demanda y métricas en vivo"
```

---

### Task 14: Cierre de la etapa

**Files:**
- Modify: `.claude/contexto/estado.md`, `.claude/contexto/bitacora.md`, `.claude/contexto/decisiones.md`, `README.md`

- [ ] **Step 1: Actualizar `README.md`**

Agregar después de la sección "Correr en local":

```markdown
## Usar el simulador

1. Dale **▶ Simular** en la barra superior. El reloj arranca a las 07:00.
2. Cambia la velocidad con ×1, ×5, ×20 o Máx.
3. En el panel **Tráfico** ajusta la cantidad de vehículos, la temporada y la hora de inicio.
4. Activa **Colorear vías por: Congestión** para ver dónde se forman las colas.
5. El panel **Métricas** muestra tiempo de viaje, demora, bloqueos y los cuellos de botella del momento.

El modelo no está calibrado con aforos: sirve para comparar escenarios entre sí,
no para predecir tiempos exactos.
```

- [ ] **Step 2: Actualizar el contexto**

En `.claude/contexto/estado.md`: etapa actual "2 de 5 terminada — sigue la etapa 3 (editor)", plan activo "ninguno; falta escribir el de la etapa 3"; en "Hecho" agregar la etapa 2 con el tiempo que tardaron 15 minutos simulados y la demora base frente a la del Rojas Pinilla cerrado (los números que imprimió la Task 11); en "Sigue": "Escribir el plan de la etapa 3 (editor de vías y cruces, terminar la Variante, restricción de pesados, vías nuevas)"; en "Bloqueos / pendientes del usuario" agregar "Confirmar la ubicación de la plaza de mercado (`src/escenarios/zonas.js`)".

En `.claude/contexto/decisiones.md` agregar:

```markdown
| 2026-10-08 | Parámetros IDM por tipo de vehículo en `src/sim/vehiculos.js` | Supuestos razonables; se documentan en "Cómo funciona" |
| 2026-10-08 | Estado de la vía multiplica la velocidad deseada (huecos ×0,5, regular ×0,8, destapado ×0,6, adoquín ×0,85) | Es lo que hace que los carros "descubran" una vía arreglada |
| 2026-10-08 | Volúmenes base: 1000 locales, 300 de paso, 120 pesados, 20 buses nacionales, 10 de paso y 30 intermunicipales por hora | Supuestos sin aforos; sirven para comparar escenarios |
| 2026-10-08 | Vehículo quieto más de 180 s se retira y cuenta como bloqueo | Equivale al teleport de SUMO; métrica de colapso |
| 2026-10-08 | Salidas del municipio declaradas a mano en `src/escenarios/zonas.js` | La detección automática daba 40 caminos rurales sin nombre |
| 2026-10-08 | Restricción de pesados de paso se implementa en la etapa 3 | Va con "terminar la Variante" |
```

En `.claude/contexto/bitacora.md` agregar una entrada con la fecha del día y "Etapa 2 completa: motor IDM + MOBIL + cruces + rutas + demanda en Web Worker; vehículos en el mapa".

- [ ] **Step 3: Commit**

```bash
git add README.md .claude/contexto
git commit -m "docs: cierre de la etapa 2"
```
