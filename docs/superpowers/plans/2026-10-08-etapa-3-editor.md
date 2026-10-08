# Etapa 3 · Editor de la red — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editar la red de San Gil mientras la simulación corre y ver el efecto en vivo: cerrar y abrir vías, cambiar o invertir sentidos, cambiar estado y superficie, velocidad y carriles, poner pares o semáforos, dibujar vías y puentes nuevos, trazar y terminar la Variante con la restricción de pesados de paso, y doble calzada en la Avenida y la Variante, con deshacer y rehacer.

**Architecture:** Cada edición es un **cambio** (un objeto de datos). `src/escenarios/cambios.js` aplica un cambio sobre los datos de la red y devuelve datos nuevos sin modificar los anteriores. La interfaz guarda la lista de cambios (historial con deshacer y rehacer, autoguardado en el navegador), recalcula la red y se la envía al worker, que la aplica en caliente con `motor.aplicarRed`. Antes de aplicar, se evalúa si el cambio aísla zonas o salidas, y si es así se pide confirmación.

**Tech Stack:** Node 24, Vite 5, React 18, deck.gl 9.0, MapLibre 4, Vitest 2. JavaScript, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-08-simulador-trafico-sangil-design.md` (secciones 4, 5 "Restricción de pesados", 6 "Editor", 8)

Etapa 3 de 5. Fuera de esta etapa: escenarios con nombre, exportar e importar, comparador y modo historia (etapa 4).

## Global Constraints

- JavaScript, **no TypeScript**.
- `src/sim/` y `src/escenarios/` no importan React ni APIs del navegador.
- Un cambio nunca modifica los datos que recibe: devuelve datos nuevos.
- **Doble calzada solo para la Avenida Nacional y la Variante.**
- San Gil no tiene semáforos: el semáforo existe solo como intervención.
- Sin costos en pesos.
- Textos de la interfaz en español de Colombia.
- Las ediciones se aplican **en vivo** sobre la simulación en curso.
- Un cambio que deja zonas o salidas sin conexión avisa **antes** de aplicarse.

## Review Focus

1. Invertir o cambiar a un sentido una vía que figura en `accesosConPare` de un cruce: la red debe seguir siendo válida (el pare de un acceso que ya no llega se quita) (test en Task 2).
2. Dibujar una vía cuyos dos extremos caen en el mismo cruce, o que parte una vía muy cerca de su extremo: error claro o uso del cruce existente, nunca una red inválida (test en Task 3).
3. Editar la vía por la que va un vehículo, o reducir los carriles donde hay vehículos lado a lado: el vehículo se retira y se cuenta, sin vehículos encimados ni rutas con arcos inexistentes (test en Task 7).
4. Activar la restricción de pesados cuando la Variante no conecta: los pesados pasan por el centro como hoy, sin volverse viajes imposibles (test en Task 6).
5. Un historial autoguardado que ya no se puede aplicar (la red de OSM cambió): se ignora y la app arranca sin cambios (test en Task 4, `deserializar` + verificación en `useEdicion`).

---

## Contratos de esta etapa

**Cambios** (`src/escenarios/cambios.js`):

| `tipo` | Campos | Efecto |
|---|---|---|
| `via` | `viaId`, `propiedades` (`sentido`, `abierta`, `estado`, `superficie`, `velocidadMax`, `carrilesPorSentido`, `nombre`) | Cambia esas propiedades. Al cambiar `sentido`, `un_sentido` ↔ `doble_sentido`. |
| `invertirVia` | `viaId` | Intercambia `desde`/`hasta` e invierte la geometría. |
| `cruce` | `nodoId`, `control`, `accesosConPare?` | Cambia el control del cruce. |
| `terminarObra` | `viaIds` | `enConstruccion: false`. |
| `dobleCalzada` | `alcance` (`avenida_nacional` \| `variante`), `activa` | Todas las vías de ese tipo pasan a 2 carriles por sentido (y vuelven a los que tenían). |
| `viaNueva` | `id`, `puntos`, `extremos: [ajuste, ajuste]`, `atributos` | Agrega una vía; cada extremo es un cruce existente, la mitad de una vía (que se parte) o un punto suelto. |

**Ajuste de un punto** (`src/escenarios/ajuste.js`): `{ tipo: 'nodo', nodo, punto } | { tipo: 'via', via, punto } | { tipo: 'libre', punto }`.

**Historial** (`src/escenarios/historial.js`): `{ entradas: { cambio, descripcion }[], indice }`; los cambios activos son `entradas.slice(0, indice)`.

**Nuevos campos de vía:** `dobleCalzada?: boolean`, `carrilesAntesDobleCalzada?: number`, `nueva?: true`; `osmId` es `null` en vías dibujadas.

**Mensajes nuevos del worker:** `{ tipo: 'red', datosRed }`, `{ tipo: 'restriccion', activa }`; `iniciar` acepta `opciones.restriccionPesados`.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/sim/tipos.js` | + etiquetas de estado, superficie y control |
| `src/sim/geo.js` | + `proyectarEnLinea`, `lineasSeCruzan` |
| `src/escenarios/cambios.js` | Aplicar cambios sobre los datos |
| `src/escenarios/impacto.js` | ¿El cambio aísla zonas o salidas? |
| `src/escenarios/historial.js` | Deshacer, rehacer, serializar |
| `src/escenarios/ajuste.js` | Pegar un punto al cruce o vía más cercana |
| `src/escenarios/zonas.js` | + `CASCO_URBANO` |
| `src/sim/restriccion.js` | Casco urbano y rutas de pesados restringidos |
| `src/sim/motor.js`, `rutas.js`, `demanda.js`, `metricas.js` | Red en caliente y restricción |
| `scripts/construir-red.js` | + `public/data/rios.json` |
| `src/ui/datos/cargarRios.js` | Cargar los ríos (opcional) |
| `src/worker/controlador.js`, `clienteSimulacion.js` | Mensajes `red` y `restriccion` |
| `src/ui/edicion/useEdicion.js`, `dibujo.js` | Estado de la edición y del dibujo |
| `src/ui/mapa/geometriaUi.js`, `estilosVia.js` | Círculo del casco, anchos y colores nuevos |
| `src/ui/paneles/FichaVia.jsx`, `FichaCruce.jsx`, `PanelObras.jsx`, `PanelDibujo.jsx`, `Confirmacion.jsx`, `Leyenda.jsx` | Editor |
| `src/ui/mapa/MapaSanGil.jsx`, `src/ui/App.jsx` | Conexión de todo |

---

### Task 1: Etiquetas y geometría auxiliar

**Files:**
- Modify: `src/sim/tipos.js`, `src/sim/geo.js`
- Test: `tests/sim/tipos.test.js`, `tests/sim/geo.test.js`

**Interfaces:**
- Produces: `ETIQUETA_ESTADO`, `ETIQUETA_SUPERFICIE`, `ETIQUETA_CONTROL` (`src/sim/tipos.js`); `proyectarEnLinea(coords, p) → { punto, distancia, segmento }`, `lineasSeCruzan(a, b) → boolean` (`src/sim/geo.js`).

- [ ] **Step 1: Agregar los tests**

Al final de `tests/sim/tipos.test.js`:

```js
import { ETIQUETA_ESTADO, ETIQUETA_SUPERFICIE, ETIQUETA_CONTROL } from '../../src/sim/tipos.js';

describe('etiquetas de edición', () => {
  it('todo estado, superficie y control tiene etiqueta', () => {
    for (const e of ESTADOS) expect(ETIQUETA_ESTADO[e]).toBeTruthy();
    for (const s of SUPERFICIES) expect(ETIQUETA_SUPERFICIE[s]).toBeTruthy();
    for (const c of CONTROLES) expect(ETIQUETA_CONTROL[c]).toBeTruthy();
  });
});
```

Al final de `tests/sim/geo.test.js`:

```js
import { proyectarEnLinea, lineasSeCruzan } from '../../src/sim/geo.js';

describe('proyectarEnLinea', () => {
  it('encuentra el punto más cercano dentro de la línea', () => {
    const encima = [-73.1365, 6.5551]; // ~11 m al norte de la mitad de A–B
    const r = proyectarEnLinea([A, B], encima);
    expect(r.segmento).toBe(0);
    expect(r.punto[0]).toBeCloseTo(-73.1365, 6);
    expect(r.punto[1]).toBeCloseTo(6.555, 6);
    expect(r.distancia).toBeGreaterThan(10);
    expect(r.distancia).toBeLessThan(12);
  });

  it('más allá del final se queda en el extremo', () => {
    const r = proyectarEnLinea([A, B, C], [-73.136, 6.5575]);
    expect(r.segmento).toBe(1);
    expect(r.punto).toEqual(C);
  });
});

describe('lineasSeCruzan', () => {
  it('detecta un cruce en X y no uno paralelo ni uno que solo se toca en un extremo', () => {
    expect(lineasSeCruzan([A, C], [[-73.137, 6.556], B])).toBe(true);
    expect(lineasSeCruzan([A, B], [[-73.137, 6.556], [-73.136, 6.556]])).toBe(false);
    expect(lineasSeCruzan([A, B], [B, C])).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/sim/tipos.test.js tests/sim/geo.test.js`
Expected: FAIL: `ETIQUETA_ESTADO`, `proyectarEnLinea` y `lineasSeCruzan` no existen.

- [ ] **Step 3: Implementar**

Al final de `src/sim/tipos.js`:

```js
export const ETIQUETA_ESTADO = { bueno: 'Bueno', regular: 'Regular', huecos: 'Con huecos' };
export const ETIQUETA_SUPERFICIE = { pavimento: 'Pavimento', adoquin: 'Adoquín', destapado: 'Destapada' };
export const ETIQUETA_CONTROL = {
  pare: 'Pare',
  prioridad: 'Prioridad por jerarquía',
  sin_senal: 'Sin señal (cede a la derecha)',
  semaforo: 'Semáforo',
};
```

Al final de `src/sim/geo.js`:

```js
// Punto de la línea más cercano a p. Aproximación plana, suficiente a escala de ciudad.
export function proyectarEnLinea(coords, p) {
  let mejor = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i];
    const [bx, by] = coords[i + 1];
    const k = Math.cos(rad((ay + by) / 2));
    const dx = (bx - ax) * k;
    const dy = by - ay;
    const largo2 = dx * dx + dy * dy;
    let f = largo2 === 0 ? 0 : ((p[0] - ax) * k * dx + (p[1] - ay) * dy) / largo2;
    f = Math.min(1, Math.max(0, f));
    const punto = [ax + (bx - ax) * f, ay + (by - ay) * f];
    const distancia = distanciaMetros(p, punto);
    if (!mejor || distancia < mejor.distancia) mejor = { punto, distancia, segmento: i };
  }
  return mejor;
}

// ¿Algún tramo de a corta (no solo toca) algún tramo de b?
export function lineasSeCruzan(a, b) {
  const lado = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) {
      const [p1, p2, q1, q2] = [a[i - 1], a[i], b[j - 1], b[j]];
      if (lado(p1, p2, q1) * lado(p1, p2, q2) < 0 && lado(q1, q2, p1) * lado(q1, q2, p2) < 0) return true;
    }
  }
  return false;
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/sim/tipos.test.js tests/sim/geo.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/tipos.js src/sim/geo.js tests/sim/tipos.test.js tests/sim/geo.test.js
git commit -m "feat(sim): etiquetas de edición, proyección sobre una línea y cruce de líneas"
```

---

### Task 2: Cambios sobre vías y cruces

**Files:**
- Create: `src/escenarios/cambios.js`
- Test: `tests/escenarios/cambios.test.js`

**Interfaces:**
- Consumes: `SENTIDOS`, `ESTADOS`, `SUPERFICIES`, `CONTROLES` (`src/sim/tipos.js`); `validarRed` (`src/sim/red.js`); `datosRedLinea`, `armarDatos`, `viaEntre` (`tests/sim/redesPrueba.js`).
- Produces: `aplicarCambio(datos, cambio) → datos`, `aplicarCambios(datos, cambios[]) → datos`. Lanza `Error` con mensaje legible si el cambio no se puede aplicar. Esta tarea cubre los tipos `via`, `invertirVia`, `cruce`, `terminarObra`, `dobleCalzada`; `viaNueva` llega en la Task 3.

- [ ] **Step 1: Escribir los tests**

`tests/escenarios/cambios.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { aplicarCambio, aplicarCambios } from '../../src/escenarios/cambios.js';
import { validarRed } from '../../src/sim/red.js';
import { datosRedLinea, armarDatos, viaEntre } from '../sim/redesPrueba.js';

const viaDe = (datos, id) => datos.vias.find((v) => v.id === id);
const nodoDe = (datos, id) => datos.nodos.find((n) => n.id === id);

describe('cambio de propiedades de una vía', () => {
  it('cierra una vía sin modificar los datos originales', () => {
    const datos = datosRedLinea();
    const nuevos = aplicarCambio(datos, { tipo: 'via', viaId: 't1', propiedades: { abierta: false } });
    expect(viaDe(nuevos, 't1').abierta).toBe(false);
    expect(viaDe(datos, 't1').abierta).toBe(true);
    expect(validarRed(nuevos)).toEqual([]);
  });

  it('pasar a doble sentido convierte un sentido en doble sentido, y al revés', () => {
    const datos = datosRedLinea();
    const doble = aplicarCambio(datos, { tipo: 'via', viaId: 't0', propiedades: { sentido: 'ambos' } });
    expect(viaDe(doble, 't0')).toMatchObject({ sentido: 'ambos', tipo: 'doble_sentido' });
    const unico = aplicarCambio(doble, { tipo: 'via', viaId: 't0', propiedades: { sentido: 'adelante' } });
    expect(viaDe(unico, 't0')).toMatchObject({ sentido: 'adelante', tipo: 'un_sentido' });
  });

  it('una avenida conserva su tipo al cambiar de sentido', () => {
    const datos = datosRedLinea({ extra: { tipo: 'avenida_nacional', sentido: 'ambos' } });
    const r = aplicarCambio(datos, { tipo: 'via', viaId: 't0', propiedades: { sentido: 'adelante' } });
    expect(viaDe(r, 't0').tipo).toBe('avenida_nacional');
  });

  it('cambia estado, superficie, velocidad y carriles', () => {
    const r = aplicarCambio(datosRedLinea(), {
      tipo: 'via', viaId: 't0',
      propiedades: { estado: 'huecos', superficie: 'destapado', velocidadMax: 20, carrilesPorSentido: 2 },
    });
    expect(viaDe(r, 't0')).toMatchObject({ estado: 'huecos', superficie: 'destapado', velocidadMax: 20, carrilesPorSentido: 2 });
  });

  it('rechaza propiedades desconocidas o valores inválidos', () => {
    const datos = datosRedLinea();
    expect(() => aplicarCambio(datos, { tipo: 'via', viaId: 't0', propiedades: { desde: 'n3' } })).toThrow(/no editable/);
    expect(() => aplicarCambio(datos, { tipo: 'via', viaId: 't0', propiedades: { estado: 'roto' } })).toThrow(/inválido/);
    expect(() => aplicarCambio(datos, { tipo: 'via', viaId: 't0', propiedades: { velocidadMax: 0 } })).toThrow(/inválido/);
    expect(() => aplicarCambio(datos, { tipo: 'via', viaId: 'zzz', propiedades: { abierta: false } })).toThrow(/no existe/);
  });
});

describe('invertir el sentido', () => {
  it('intercambia los extremos e invierte la geometría', () => {
    const datos = datosRedLinea();
    const r = aplicarCambio(datos, { tipo: 'invertirVia', viaId: 't1' });
    const v = viaDe(r, 't1');
    expect([v.desde, v.hasta]).toEqual(['n2', 'n1']);
    expect(v.geometria[0]).toEqual(viaDe(datos, 't1').geometria.at(-1));
  });

  it('quita el pare de un acceso que ya no llega al cruce', () => {
    const datos = datosRedLinea();
    nodoDe(datos, 'n2').control = 'pare';
    nodoDe(datos, 'n2').accesosConPare = ['t1'];
    const r = aplicarCambio(datos, { tipo: 'invertirVia', viaId: 't1' });
    expect(nodoDe(r, 'n2').accesosConPare).toBeUndefined();
    expect(nodoDe(r, 'n2').control).toBe('pare');
    expect(validarRed(r)).toEqual([]);
  });
});

describe('cambio de un cruce', () => {
  it('pone un semáforo y quita la lista de pares', () => {
    const datos = datosRedLinea();
    nodoDe(datos, 'n1').control = 'pare';
    nodoDe(datos, 'n1').accesosConPare = ['t0'];
    const r = aplicarCambio(datos, { tipo: 'cruce', nodoId: 'n1', control: 'semaforo' });
    expect(nodoDe(r, 'n1').control).toBe('semaforo');
    expect(nodoDe(r, 'n1').accesosConPare).toBeUndefined();
  });

  it('pone pare a un acceso concreto', () => {
    const r = aplicarCambio(datosRedLinea(), { tipo: 'cruce', nodoId: 'n1', control: 'pare', accesosConPare: ['t0'] });
    expect(nodoDe(r, 'n1')).toMatchObject({ control: 'pare', accesosConPare: ['t0'] });
    expect(validarRed(r)).toEqual([]);
  });

  it('rechaza controles desconocidos y cruces inexistentes', () => {
    expect(() => aplicarCambio(datosRedLinea(), { tipo: 'cruce', nodoId: 'n1', control: 'rotonda' })).toThrow(/inválido/);
    expect(() => aplicarCambio(datosRedLinea(), { tipo: 'cruce', nodoId: 'zzz', control: 'pare' })).toThrow(/no existe/);
  });
});

describe('obras y doble calzada', () => {
  it('terminar una obra la habilita', () => {
    const datos = datosRedLinea({ extraPorTramo: (i) => (i === 1 ? { tipo: 'variante', enConstruccion: true } : {}) });
    const r = aplicarCambio(datos, { tipo: 'terminarObra', viaIds: ['t1'] });
    expect(viaDe(r, 't1').enConstruccion).toBe(false);
  });

  it('doble calzada en la Avenida: 2 carriles por sentido, y al quitarla vuelven los de antes', () => {
    const nodos = { a: [0, 0], b: [200, 0], c: [400, 0] };
    const datos = armarDatos(nodos, [
      viaEntre('av', nodos, 'a', 'b', { tipo: 'avenida_nacional', sentido: 'ambos' }),
      viaEntre('calle', nodos, 'b', 'c'),
    ]);
    const con = aplicarCambio(datos, { tipo: 'dobleCalzada', alcance: 'avenida_nacional', activa: true });
    expect(viaDe(con, 'av')).toMatchObject({ carrilesPorSentido: 2, dobleCalzada: true });
    expect(viaDe(con, 'calle').carrilesPorSentido).toBe(1);
    const sin = aplicarCambio(con, { tipo: 'dobleCalzada', alcance: 'avenida_nacional', activa: false });
    expect(viaDe(sin, 'av')).toMatchObject({ carrilesPorSentido: 1, dobleCalzada: false });
    expect(viaDe(sin, 'av').carrilesAntesDobleCalzada).toBeUndefined();
  });

  it('la doble calzada solo se permite en la Avenida y la Variante', () => {
    expect(() => aplicarCambio(datosRedLinea(), { tipo: 'dobleCalzada', alcance: 'un_sentido', activa: true })).toThrow(/Avenida/);
  });
});

describe('aplicarCambios', () => {
  it('aplica una lista en orden', () => {
    const r = aplicarCambios(datosRedLinea(), [
      { tipo: 'via', viaId: 't0', propiedades: { abierta: false } },
      { tipo: 'via', viaId: 't0', propiedades: { abierta: true, estado: 'regular' } },
    ]);
    expect(viaDe(r, 't0')).toMatchObject({ abierta: true, estado: 'regular' });
  });

  it('rechaza tipos de cambio desconocidos', () => {
    expect(() => aplicarCambio(datosRedLinea(), { tipo: 'borrarTodo' })).toThrow(/desconocido/);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/escenarios/cambios.test.js`
Expected: FAIL, no se puede resolver `src/escenarios/cambios.js`.

- [ ] **Step 3: Implementar `src/escenarios/cambios.js`**

```js
// Cambios que el usuario hace sobre la red. Cada cambio es un dato (se puede
// guardar, deshacer y volver a aplicar) y aplicarlo devuelve datos nuevos sin
// tocar los anteriores.

import { longitudLinea, proyectarEnLinea, distanciaMetros } from '../sim/geo.js';
import { SENTIDOS, ESTADOS, SUPERFICIES, CONTROLES } from '../sim/tipos.js';

const PROPIEDADES_VIA = {
  sentido: (x) => SENTIDOS.includes(x),
  abierta: (x) => typeof x === 'boolean',
  estado: (x) => ESTADOS.includes(x),
  superficie: (x) => SUPERFICIES.includes(x),
  velocidadMax: (x) => Number.isFinite(x) && x > 0 && x <= 120,
  carrilesPorSentido: (x) => Number.isInteger(x) && x >= 1 && x <= 4,
  nombre: (x) => typeof x === 'string',
};
const TIPOS_DOBLE_CALZADA = ['avenida_nacional', 'variante'];
const DISTANCIA_EXTREMO = 1; // m: partir una vía a menos de esto de un extremo usa ese cruce

const redondear = (x) => Math.round(x * 10) / 10;

function exigirVia(datos, viaId) {
  const via = datos.vias.find((v) => v.id === viaId);
  if (!via) throw new Error(`La vía ${viaId} no existe`);
  return via;
}

function conVia(datos, viaId, cambiar) {
  exigirVia(datos, viaId);
  return { ...datos, vias: datos.vias.map((v) => (v.id === viaId ? cambiar(v) : v)) };
}

const tipoSegunSentido = (tipo, sentido) => {
  if (tipo !== 'un_sentido' && tipo !== 'doble_sentido') return tipo;
  return sentido === 'ambos' ? 'doble_sentido' : 'un_sentido';
};

function cambiarVia(datos, { viaId, propiedades }) {
  for (const [clave, valor] of Object.entries(propiedades)) {
    const valida = PROPIEDADES_VIA[clave];
    if (!valida) throw new Error(`Propiedad de vía no editable: ${clave}`);
    if (!valida(valor)) throw new Error(`Valor inválido para ${clave}: ${valor}`);
  }
  return conVia(datos, viaId, (v) => {
    const nueva = { ...v, ...propiedades };
    if (propiedades.sentido) nueva.tipo = tipoSegunSentido(v.tipo, propiedades.sentido);
    return nueva;
  });
}

function invertirVia(datos, { viaId }) {
  return conVia(datos, viaId, (v) => ({
    ...v, desde: v.hasta, hasta: v.desde, geometria: [...v.geometria].reverse(),
  }));
}

function cambiarCruce(datos, { nodoId, control, accesosConPare }) {
  if (!CONTROLES.includes(control)) throw new Error(`Control inválido: ${control}`);
  if (!datos.nodos.some((n) => n.id === nodoId)) throw new Error(`El cruce ${nodoId} no existe`);
  return {
    ...datos,
    nodos: datos.nodos.map((n) => {
      if (n.id !== nodoId) return n;
      const { accesosConPare: _anterior, ...resto } = n;
      return control === 'pare' && accesosConPare?.length ? { ...resto, control, accesosConPare } : { ...resto, control };
    }),
  };
}

function terminarObra(datos, { viaIds }) {
  for (const id of viaIds) exigirVia(datos, id);
  const ids = new Set(viaIds);
  return { ...datos, vias: datos.vias.map((v) => (ids.has(v.id) ? { ...v, enConstruccion: false } : v)) };
}

function dobleCalzada(datos, { alcance, activa }) {
  if (!TIPOS_DOBLE_CALZADA.includes(alcance)) {
    throw new Error('La doble calzada solo se permite en la Avenida Nacional y la Variante');
  }
  return {
    ...datos,
    vias: datos.vias.map((v) => {
      if (v.tipo !== alcance) return v;
      if (activa) {
        if (v.dobleCalzada) return v;
        return { ...v, dobleCalzada: true, carrilesAntesDobleCalzada: v.carrilesPorSentido, carrilesPorSentido: Math.max(2, v.carrilesPorSentido) };
      }
      const { carrilesAntesDobleCalzada, ...resto } = v;
      return { ...resto, dobleCalzada: false, carrilesPorSentido: carrilesAntesDobleCalzada ?? 1 };
    }),
  };
}

// Quita de los pares por acceso las vías que ya no llegan a ese cruce.
function limpiarPares(datos) {
  const llegan = new Map();
  for (const v of datos.vias) {
    for (const n of v.sentido === 'ambos' ? [v.desde, v.hasta] : [v.hasta]) {
      if (!llegan.has(n)) llegan.set(n, new Set());
      llegan.get(n).add(v.id);
    }
  }
  return {
    ...datos,
    nodos: datos.nodos.map((n) => {
      if (!n.accesosConPare) return n;
      const quedan = n.accesosConPare.filter((id) => llegan.get(n.id)?.has(id));
      if (quedan.length === n.accesosConPare.length) return n;
      const { accesosConPare: _quitados, ...resto } = n;
      return quedan.length ? { ...resto, accesosConPare: quedan } : resto;
    }),
  };
}

// --- vías nuevas (Task 3) ---------------------------------------------------

const APLICAR = {
  via: cambiarVia,
  invertirVia,
  cruce: cambiarCruce,
  terminarObra,
  dobleCalzada,
};

export function aplicarCambio(datos, cambio) {
  const aplicar = APLICAR[cambio?.tipo];
  if (!aplicar) throw new Error(`Tipo de cambio desconocido: ${cambio?.tipo}`);
  return limpiarPares(aplicar(datos, cambio));
}

export function aplicarCambios(datos, cambios) {
  return cambios.reduce(aplicarCambio, datos);
}

export const _internos = { longitudLinea, proyectarEnLinea, distanciaMetros, redondear, exigirVia, DISTANCIA_EXTREMO };
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/escenarios/cambios.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/escenarios/cambios.js tests/escenarios/cambios.test.js
git commit -m "feat(escenarios): cambios sobre vías, cruces, obras y doble calzada"
```

---

### Task 3: Vías y puentes nuevos

**Files:**
- Modify: `src/escenarios/cambios.js`
- Test: `tests/escenarios/viaNueva.test.js`

**Interfaces:**
- Consumes: `aplicarCambio` (Task 2), `proyectarEnLinea` (Task 1), `validarRed`, `datosRedLinea`, `punto` (`tests/sim/redesPrueba.js`).
- Produces: cambio `viaNueva` en `aplicarCambio`. Ids generados: nodo nuevo `n-<id>-0` / `n-<id>-1`; mitades de una vía partida `<viaId>~<nodoNuevo>a` (desde → nodo nuevo) y `<viaId>~<nodoNuevo>b` (nodo nuevo → hasta).

- [ ] **Step 1: Escribir los tests**

`tests/escenarios/viaNueva.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { aplicarCambio } from '../../src/escenarios/cambios.js';
import { validarRed, crearRed, alcanzables } from '../../src/sim/red.js';
import { datosRedLinea, punto } from '../sim/redesPrueba.js';

// Línea de doble sentido n0–n1–n2–n3, tramos de 200 m al este.
const linea = () => datosRedLinea({ extra: { sentido: 'ambos', tipo: 'doble_sentido' } });
const coordNodo = (datos, id) => { const n = datos.nodos.find((x) => x.id === id); return [n.lon, n.lat]; };

const nueva = (extremos, puntos, atributos = {}) => ({ tipo: 'viaNueva', id: 'nueva-1', extremos, puntos, atributos });

describe('vía nueva', () => {
  it('une dos cruces existentes', () => {
    const datos = linea();
    const p0 = coordNodo(datos, 'n0');
    const p3 = coordNodo(datos, 'n3');
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'nodo', nodo: 'n0', punto: p0 }, { tipo: 'nodo', nodo: 'n3', punto: p3 }],
      [p0, punto(300, 150), p3],
      { nombre: 'Atajo', sentido: 'adelante' },
    ));
    const v = r.vias.find((x) => x.id === 'nueva-1');
    expect(v).toMatchObject({ desde: 'n0', hasta: 'n3', nombre: 'Atajo', sentido: 'adelante', tipo: 'un_sentido', osmId: null, nueva: true });
    expect(v.geometria).toHaveLength(3);
    expect(v.longitud).toBeGreaterThan(600);
    expect(validarRed(r)).toEqual([]);
  });

  it('desde un punto suelto crea un cruce nuevo', () => {
    const datos = linea();
    const suelto = punto(300, 300);
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'libre', punto: suelto }, { tipo: 'nodo', nodo: 'n2', punto: coordNodo(datos, 'n2') }],
      [suelto, coordNodo(datos, 'n2')],
    ));
    expect(r.nodos.find((n) => n.id === 'n-nueva-1-0')).toMatchObject({ lon: suelto[0], lat: suelto[1], control: 'sin_senal' });
    expect(validarRed(r)).toEqual([]);
  });

  it('a mitad de una vía la parte en dos y conecta en el punto de corte', () => {
    const datos = linea();
    const enT1 = punto(300, 0);
    const lejos = punto(300, -200);
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'via', via: 't1', punto: enT1 }, { tipo: 'libre', punto: lejos }],
      [enT1, lejos],
      { esPuente: true, nombre: 'Puente nuevo' },
    ));
    expect(r.vias.some((v) => v.id === 't1')).toBe(false);
    const a = r.vias.find((v) => v.id === 't1~n-nueva-1-0a');
    const b = r.vias.find((v) => v.id === 't1~n-nueva-1-0b');
    expect([a.desde, a.hasta, b.desde, b.hasta]).toEqual(['n1', 'n-nueva-1-0', 'n-nueva-1-0', 'n2']);
    expect(a.longitud + b.longitud).toBeCloseTo(datos.vias.find((v) => v.id === 't1').longitud, 0);
    expect(r.vias.find((v) => v.id === 'nueva-1')).toMatchObject({ desde: 'n-nueva-1-0', esPuente: true });
    expect(validarRed(r)).toEqual([]);
    expect(alcanzables(crearRed(r), 'n0').has('n-nueva-1-1')).toBe(true);
  });

  it('partir una vía casi en su extremo usa el cruce existente', () => {
    const datos = linea();
    const casiN1 = punto(200.5, 0);
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'via', via: 't1', punto: casiN1 }, { tipo: 'libre', punto: punto(200, -200) }],
      [casiN1, punto(200, -200)],
    ));
    expect(r.vias.some((v) => v.id === 't1')).toBe(true);
    expect(r.vias.find((v) => v.id === 'nueva-1').desde).toBe('n1');
  });

  it('al partir una vía, el pare de su acceso pasa a la mitad que llega al cruce', () => {
    const datos = linea();
    const n2 = datos.nodos.find((n) => n.id === 'n2');
    n2.control = 'pare';
    n2.accesosConPare = ['t1'];
    const enT1 = punto(300, 0);
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'via', via: 't1', punto: enT1 }, { tipo: 'libre', punto: punto(300, -200) }],
      [enT1, punto(300, -200)],
    ));
    expect(r.nodos.find((n) => n.id === 'n2').accesosConPare).toEqual(['t1~n-nueva-1-0b']);
    expect(validarRed(r)).toEqual([]);
  });

  it('errores claros: mismo cruce en los dos extremos, un solo punto, id repetido', () => {
    const datos = linea();
    const p1 = coordNodo(datos, 'n1');
    expect(() => aplicarCambio(datos, nueva([{ tipo: 'nodo', nodo: 'n1', punto: p1 }, { tipo: 'nodo', nodo: 'n1', punto: p1 }], [p1, punto(250, 50), p1])))
      .toThrow(/mismo cruce/);
    expect(() => aplicarCambio(datos, nueva([{ tipo: 'nodo', nodo: 'n1', punto: p1 }], [p1]))).toThrow(/dos puntos/);
    expect(() => aplicarCambio(datos, { ...nueva([{ tipo: 'nodo', nodo: 'n0', punto: p1 }, { tipo: 'nodo', nodo: 'n2', punto: p1 }], [p1, p1]), id: 't0' }))
      .toThrow(/Ya existe/);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/escenarios/viaNueva.test.js`
Expected: FAIL con "Tipo de cambio desconocido: viaNueva".

- [ ] **Step 3: Implementar en `src/escenarios/cambios.js`**

Reemplazar la línea `// --- vías nuevas (Task 3) ---------------------------------------------------` por:

```js
// --- vías nuevas -----------------------------------------------------------

function partirVia(datos, viaId, punto, nodoNuevo) {
  const via = exigirVia(datos, viaId);
  const { punto: p, segmento } = proyectarEnLinea(via.geometria, punto);
  if (distanciaMetros(p, via.geometria[0]) < DISTANCIA_EXTREMO) return { datos, nodo: via.desde };
  if (distanciaMetros(p, via.geometria.at(-1)) < DISTANCIA_EXTREMO) return { datos, nodo: via.hasta };

  const g1 = [...via.geometria.slice(0, segmento + 1), p];
  const g2 = [p, ...via.geometria.slice(segmento + 1)];
  const a = { ...via, id: `${via.id}~${nodoNuevo}a`, hasta: nodoNuevo, geometria: g1, longitud: redondear(longitudLinea(g1)) };
  const b = { ...via, id: `${via.id}~${nodoNuevo}b`, desde: nodoNuevo, geometria: g2, longitud: redondear(longitudLinea(g2)) };

  const nodos = datos.nodos.map((n) => {
    if (!n.accesosConPare?.includes(via.id)) return n;
    const mitad = n.id === via.hasta ? b.id : a.id;
    return { ...n, accesosConPare: n.accesosConPare.map((id) => (id === via.id ? mitad : id)) };
  });
  nodos.push({ id: nodoNuevo, lon: p[0], lat: p[1], control: 'sin_senal' });
  const vias = datos.vias.flatMap((v) => (v.id === via.id ? [a, b] : [v]));
  return { datos: { ...datos, nodos, vias }, nodo: nodoNuevo };
}

function resolverExtremo(datos, extremo, nodoNuevo) {
  if (extremo.tipo === 'nodo') {
    if (!datos.nodos.some((n) => n.id === extremo.nodo)) throw new Error(`El cruce ${extremo.nodo} no existe`);
    return { datos, nodo: extremo.nodo };
  }
  if (extremo.tipo === 'via') return partirVia(datos, extremo.via, extremo.punto, nodoNuevo);
  const [lon, lat] = extremo.punto;
  return { datos: { ...datos, nodos: [...datos.nodos, { id: nodoNuevo, lon, lat, control: 'sin_senal' }] }, nodo: nodoNuevo };
}

function agregarViaNueva(datos, { id, puntos, extremos, atributos = {} }) {
  if (!puntos || puntos.length < 2 || !extremos || extremos.length < 2) {
    throw new Error('Una vía nueva necesita al menos dos puntos');
  }
  if (datos.vias.some((v) => v.id === id)) throw new Error(`Ya existe una vía con id ${id}`);

  const inicio = resolverExtremo(datos, extremos[0], `n-${id}-0`);
  const fin = resolverExtremo(inicio.datos, extremos[1], `n-${id}-1`);
  if (inicio.nodo === fin.nodo) throw new Error('La vía empieza y termina en el mismo cruce');

  const coordenada = (nodoId) => {
    const n = fin.datos.nodos.find((x) => x.id === nodoId);
    return [n.lon, n.lat];
  };
  const geometria = [coordenada(inicio.nodo), ...puntos.slice(1, -1), coordenada(fin.nodo)];
  const sentido = atributos.sentido ?? 'ambos';
  const via = {
    id,
    osmId: null,
    nombre: atributos.nombre ?? 'Vía nueva',
    desde: inicio.nodo,
    hasta: fin.nodo,
    geometria,
    longitud: redondear(longitudLinea(geometria)),
    tipo: tipoSegunSentido(atributos.tipo ?? 'doble_sentido', sentido),
    sentido,
    carrilesPorSentido: atributos.carrilesPorSentido ?? 1,
    superficie: 'pavimento',
    estado: 'bueno',
    velocidadMax: atributos.velocidadMax ?? 30,
    abierta: true,
    enConstruccion: atributos.enConstruccion ?? false,
    esPuente: atributos.esPuente ?? false,
    nueva: true,
  };
  if (!(via.longitud > 0)) throw new Error('La vía nueva no tiene largo');
  return { ...fin.datos, vias: [...fin.datos.vias, via] };
}
```

En el objeto `APLICAR`, agregar la entrada `viaNueva: agregarViaNueva,` y borrar la línea `export const _internos = …` al final del archivo.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/escenarios/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/escenarios/cambios.js tests/escenarios/viaNueva.test.js
git commit -m "feat(escenarios): vías y puentes nuevos, partiendo vías existentes"
```

---

### Task 4: Impacto de un cambio e historial

**Files:**
- Create: `src/escenarios/impacto.js`, `src/escenarios/historial.js`
- Test: `tests/escenarios/impacto.test.js`, `tests/escenarios/historial.test.js`

**Interfaces:**
- Consumes: `crearRed`, `componentePrincipal` (`src/sim/red.js`); `prepararPuntos` (`src/sim/demanda.js`); `aplicarCambio` (Task 2).
- Produces:
  - `evaluarImpacto(datosAntes, datosDespues, zonas, salidas) → { aisladas: string[], perdidos: number, requiereConfirmacion: boolean }`; `UMBRAL_PERDIDOS = 20`.
  - `HISTORIAL_VACIO`, `agregar(h, entrada)`, `deshacer(h)`, `rehacer(h)`, `puedeDeshacer(h)`, `puedeRehacer(h)`, `activos(h) → cambio[]`, `serializar(h) → string`, `deserializar(texto) → historial | null`.

- [ ] **Step 1: Escribir los tests**

`tests/escenarios/impacto.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { evaluarImpacto } from '../../src/escenarios/impacto.js';
import { aplicarCambio } from '../../src/escenarios/cambios.js';
import { datosRedLinea, punto } from '../sim/redesPrueba.js';

const linea = () => datosRedLinea({ extra: { sentido: 'ambos', tipo: 'doble_sentido' } });
const [lonC, latC] = punto(0, 0);
const [lonX, latX] = punto(600, 0);
const zonas = { centro: { nombre: 'Centro', lon: lonC, lat: latC, peso: 1 } };
const salidas = { este: { nombre: 'Salida al este', nodo: 'n3', avenida: true } };

describe('evaluarImpacto', () => {
  it('un cambio que no desconecta nada no pide confirmación', () => {
    const antes = linea();
    const despues = aplicarCambio(antes, { tipo: 'via', viaId: 't1', propiedades: { estado: 'huecos' } });
    expect(evaluarImpacto(antes, despues, zonas, salidas)).toEqual({ aisladas: [], perdidos: 0, requiereConfirmacion: false });
  });

  it('cerrar la vía que une la salida avisa qué queda aislado', () => {
    const antes = linea();
    const despues = aplicarCambio(antes, { tipo: 'via', viaId: 't2', propiedades: { abierta: false } });
    const r = evaluarImpacto(antes, despues, { ...zonas, otra: { nombre: 'Zona del este', lon: lonX, lat: latX, peso: 1 } }, salidas);
    expect(r.requiereConfirmacion).toBe(true);
    expect(r.aisladas.length).toBeGreaterThan(0);
    expect(r.perdidos).toBeGreaterThan(0);
  });
});
```

`tests/escenarios/historial.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  HISTORIAL_VACIO, agregar, deshacer, rehacer, puedeDeshacer, puedeRehacer, activos, serializar, deserializar,
} from '../../src/escenarios/historial.js';

const e = (n) => ({ cambio: { tipo: 'via', viaId: `v${n}`, propiedades: { abierta: false } }, descripcion: `cambio ${n}` });

describe('historial', () => {
  it('agregar, deshacer y rehacer', () => {
    let h = agregar(agregar(HISTORIAL_VACIO, e(1)), e(2));
    expect(activos(h).map((c) => c.viaId)).toEqual(['v1', 'v2']);
    h = deshacer(h);
    expect(activos(h).map((c) => c.viaId)).toEqual(['v1']);
    expect(puedeRehacer(h)).toBe(true);
    h = rehacer(h);
    expect(activos(h)).toHaveLength(2);
  });

  it('un cambio nuevo después de deshacer descarta lo que se podía rehacer', () => {
    const h = agregar(deshacer(agregar(agregar(HISTORIAL_VACIO, e(1)), e(2))), e(3));
    expect(activos(h).map((c) => c.viaId)).toEqual(['v1', 'v3']);
    expect(puedeRehacer(h)).toBe(false);
  });

  it('no deshace ni rehace más allá de los límites', () => {
    expect(puedeDeshacer(HISTORIAL_VACIO)).toBe(false);
    expect(deshacer(HISTORIAL_VACIO)).toBe(HISTORIAL_VACIO);
    expect(rehacer(HISTORIAL_VACIO)).toBe(HISTORIAL_VACIO);
  });

  it('se serializa y se recupera; lo dañado devuelve null', () => {
    const h = deshacer(agregar(agregar(HISTORIAL_VACIO, e(1)), e(2)));
    expect(deserializar(serializar(h))).toEqual(h);
    expect(deserializar('no es json')).toBeNull();
    expect(deserializar(null)).toBeNull();
    expect(deserializar(JSON.stringify({ version: 9, entradas: [], indice: 0 }))).toBeNull();
    expect(deserializar(JSON.stringify({ version: 1, entradas: [e(1)], indice: 7 })).indice).toBe(1);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/escenarios/impacto.test.js tests/escenarios/historial.test.js`
Expected: FAIL, no se pueden resolver los módulos.

- [ ] **Step 3: Implementar**

`src/escenarios/impacto.js`:

```js
// ¿Qué deja desconectado un cambio? Se compara el grupo de cruces que se
// conectan ida y vuelta antes y después, y se revisan zonas y salidas.

import { crearRed, componentePrincipal } from '../sim/red.js';
import { prepararPuntos } from '../sim/demanda.js';

export const UMBRAL_PERDIDOS = 20; // cruces que pueden quedar sin ida y vuelta sin preguntar

export function evaluarImpacto(datosAntes, datosDespues, zonas, salidas) {
  const antes = crearRed(datosAntes);
  const despues = crearRed(datosDespues);
  const principalAntes = componentePrincipal(antes);
  const principalDespues = componentePrincipal(despues);
  const puntos = prepararPuntos(antes, zonas, salidas);
  const lugares = [...Object.values(puntos.zonas), ...Object.values(puntos.salidas)];
  const aisladas = lugares.filter((l) => !principalDespues.has(l.nodo)).map((l) => l.nombre);
  const perdidos = [...principalAntes].filter((id) => !principalDespues.has(id)).length;
  return { aisladas, perdidos, requiereConfirmacion: aisladas.length > 0 || perdidos > UMBRAL_PERDIDOS };
}
```

`src/escenarios/historial.js`:

```js
// Historial de cambios con deshacer y rehacer. Los cambios activos son los
// primeros `indice`; los demás se pueden rehacer hasta que llegue uno nuevo.

export const HISTORIAL_VACIO = { entradas: [], indice: 0 };

export function agregar(h, entrada) {
  return { entradas: [...h.entradas.slice(0, h.indice), entrada], indice: h.indice + 1 };
}

export const puedeDeshacer = (h) => h.indice > 0;
export const puedeRehacer = (h) => h.indice < h.entradas.length;
export const deshacer = (h) => (puedeDeshacer(h) ? { ...h, indice: h.indice - 1 } : h);
export const rehacer = (h) => (puedeRehacer(h) ? { ...h, indice: h.indice + 1 } : h);
export const activos = (h) => h.entradas.slice(0, h.indice).map((e) => e.cambio);

export function serializar(h) {
  return JSON.stringify({ version: 1, entradas: h.entradas, indice: h.indice });
}

export function deserializar(texto) {
  try {
    const x = JSON.parse(texto);
    if (x?.version !== 1 || !Array.isArray(x.entradas) || !Number.isInteger(x.indice)) return null;
    return { entradas: x.entradas, indice: Math.min(Math.max(x.indice, 0), x.entradas.length) };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/escenarios/impacto.test.js tests/escenarios/historial.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/escenarios/impacto.js src/escenarios/historial.js tests/escenarios/impacto.test.js tests/escenarios/historial.test.js
git commit -m "feat(escenarios): impacto de un cambio e historial con deshacer y rehacer"
```

---

### Task 5: Pegar puntos al mapa y estado del dibujo

**Files:**
- Create: `src/escenarios/ajuste.js`, `src/ui/edicion/dibujo.js`
- Test: `tests/escenarios/ajuste.test.js`, `tests/ui/dibujo.test.js`

**Interfaces:**
- Consumes: `distanciaMetros`, `proyectarEnLinea`, `lineasSeCruzan` (Task 1); `redLinea`, `datosRedLinea`, `punto` (`tests/sim/redesPrueba.js`).
- Produces:
  - `RADIO_NODO = 25`, `RADIO_VIA = 15`, `ajustarPunto(red, punto, radios?) → ajuste`.
  - `PRESETS` (`calle`, `variante`), `crearDibujo(preset) → { preset, atributos, puntos: [] }`, `agregarPunto(dibujo, red, coordenada)`, `quitarUltimo(dibujo)`, `cambiarAtributos(dibujo, parcial)`, `lineaDelDibujo(dibujo) → [lon,lat][]`, `cruzaRio(dibujo, rios) → boolean`, `cambioDeDibujo(dibujo, id, rios) → cambio viaNueva`, `siguienteIdVia(datos) → 'nueva-N'`.

- [ ] **Step 1: Escribir los tests**

`tests/escenarios/ajuste.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { ajustarPunto } from '../../src/escenarios/ajuste.js';
import { redLinea, punto } from '../sim/redesPrueba.js';

const red = redLinea();

describe('ajustarPunto', () => {
  it('cerca de un cruce se pega al cruce', () => {
    expect(ajustarPunto(red, punto(205, 8))).toMatchObject({ tipo: 'nodo', nodo: 'n1' });
  });

  it('cerca de una vía, lejos de los cruces, se pega a la vía', () => {
    const r = ajustarPunto(red, punto(300, 10));
    expect(r).toMatchObject({ tipo: 'via', via: 't1' });
    expect(r.punto[1]).toBeCloseTo(punto(300, 0)[1], 6);
  });

  it('lejos de todo queda suelto', () => {
    const p = punto(300, 100);
    expect(ajustarPunto(red, p)).toEqual({ tipo: 'libre', punto: p });
  });
});
```

`tests/ui/dibujo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  crearDibujo, agregarPunto, quitarUltimo, cambiarAtributos, lineaDelDibujo, cruzaRio, cambioDeDibujo, siguienteIdVia,
} from '../../src/ui/edicion/dibujo.js';
import { redLinea, datosRedLinea, punto } from '../sim/redesPrueba.js';

const red = redLinea();

describe('dibujo de una vía nueva', () => {
  const dibujado = () => [punto(200, 5), punto(300, 150), punto(300, 300)]
    .reduce((d, p) => agregarPunto(d, red, p), crearDibujo('calle'));

  it('pega el primer y el último punto; los del medio quedan donde se marcaron', () => {
    const d = dibujado();
    expect(d.puntos[0].ajuste).toMatchObject({ tipo: 'nodo', nodo: 'n1' });
    expect(d.puntos[2].ajuste.tipo).toBe('libre');
    const linea = lineaDelDibujo(d);
    expect(linea[0]).toEqual(d.puntos[0].ajuste.punto);
    expect(linea[1]).toEqual(punto(300, 150));
  });

  it('quitar el último punto y cambiar atributos', () => {
    const d = cambiarAtributos(quitarUltimo(dibujado()), { velocidadMax: 50 });
    expect(d.puntos).toHaveLength(2);
    expect(d.atributos.velocidadMax).toBe(50);
  });

  it('si cruza el río es un puente', () => {
    const rio = [punto(250, 100), punto(350, 100)];
    expect(cruzaRio(dibujado(), [rio])).toBe(true);
    expect(cruzaRio(dibujado(), [])).toBe(false);
    const cambio = cambioDeDibujo(dibujado(), 'nueva-1', [rio]);
    expect(cambio).toMatchObject({ tipo: 'viaNueva', id: 'nueva-1', atributos: { esPuente: true, nombre: 'Puente nuevo' } });
    expect(cambio.extremos.map((x) => x.tipo)).toEqual(['nodo', 'libre']);
  });

  it('un tramo de Variante nace en construcción y conserva su nombre aunque cruce el río', () => {
    const d = [punto(200, 5), punto(300, 300)].reduce((x, p) => agregarPunto(x, red, p), crearDibujo('variante'));
    const cambio = cambioDeDibujo(d, 'nueva-2', [[punto(150, 100), punto(350, 100)]]);
    expect(cambio.atributos).toMatchObject({ tipo: 'variante', enConstruccion: true, esPuente: true });
    expect(cambio.atributos.nombre).toMatch(/Variante/);
  });

  it('con menos de dos puntos no se puede terminar', () => {
    expect(() => cambioDeDibujo(agregarPunto(crearDibujo('calle'), red, punto(0, 0)), 'x', [])).toThrow(/dos puntos/);
  });

  it('siguienteIdVia no repite ids, ni los de mitades partidas', () => {
    const datos = datosRedLinea();
    expect(siguienteIdVia(datos)).toBe('nueva-1');
    datos.vias.push({ id: 'nueva-1' }, { id: 'nueva-2~n-xa' });
    expect(siguienteIdVia(datos)).toBe('nueva-3');
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/escenarios/ajuste.test.js tests/ui/dibujo.test.js`
Expected: FAIL, no se pueden resolver los módulos.

- [ ] **Step 3: Implementar**

`src/escenarios/ajuste.js`:

```js
// Pega un punto marcado en el mapa al cruce o a la vía más cercana, para que
// una vía nueva quede conectada a la red.

import { distanciaMetros, proyectarEnLinea } from '../sim/geo.js';

export const RADIO_NODO = 25; // m
export const RADIO_VIA = 15; // m

export function ajustarPunto(red, punto, { radioNodo = RADIO_NODO, radioVia = RADIO_VIA } = {}) {
  let nodo = null;
  let distanciaNodo = Infinity;
  for (const n of red.nodos.values()) {
    const d = distanciaMetros(punto, [n.lon, n.lat]);
    if (d < distanciaNodo) { nodo = n; distanciaNodo = d; }
  }
  if (nodo && distanciaNodo <= radioNodo) return { tipo: 'nodo', nodo: nodo.id, punto: [nodo.lon, nodo.lat] };

  let via = null;
  let proyeccion = null;
  for (const v of red.vias.values()) {
    const p = proyectarEnLinea(v.geometria, punto);
    if (!proyeccion || p.distancia < proyeccion.distancia) { via = v; proyeccion = p; }
  }
  if (via && proyeccion.distancia <= radioVia) return { tipo: 'via', via: via.id, punto: proyeccion.punto };
  return { tipo: 'libre', punto };
}
```

`src/ui/edicion/dibujo.js`:

```js
// Estado de la herramienta "vía o puente nuevo": puntos marcados, a qué se
// pegó cada extremo y los atributos de la vía.

import { ajustarPunto } from '../../escenarios/ajuste.js';
import { lineasSeCruzan } from '../../sim/geo.js';

export const PRESETS = {
  calle: {
    nombre: 'Vía nueva', tipo: 'doble_sentido', sentido: 'ambos',
    velocidadMax: 30, carrilesPorSentido: 1, enConstruccion: false,
  },
  variante: {
    nombre: 'Variante de San Gil (tramo nuevo)', tipo: 'variante', sentido: 'ambos',
    velocidadMax: 60, carrilesPorSentido: 1, enConstruccion: true,
  },
};

export const crearDibujo = (preset = 'calle') => ({ preset, atributos: { ...PRESETS[preset] }, puntos: [] });

export function agregarPunto(dibujo, red, coordenada) {
  return { ...dibujo, puntos: [...dibujo.puntos, { coordenada, ajuste: ajustarPunto(red, coordenada) }] };
}

export const quitarUltimo = (dibujo) => ({ ...dibujo, puntos: dibujo.puntos.slice(0, -1) });
export const cambiarAtributos = (dibujo, parcial) => ({ ...dibujo, atributos: { ...dibujo.atributos, ...parcial } });

// Extremos pegados a la red; puntos intermedios donde se marcaron.
export function lineaDelDibujo(dibujo) {
  const ultimo = dibujo.puntos.length - 1;
  return dibujo.puntos.map((p, i) => (i === 0 || i === ultimo ? p.ajuste.punto : p.coordenada));
}

export const cruzaRio = (dibujo, rios) => {
  const linea = lineaDelDibujo(dibujo);
  return linea.length >= 2 && rios.some((rio) => lineasSeCruzan(linea, rio));
};

export function cambioDeDibujo(dibujo, id, rios) {
  if (dibujo.puntos.length < 2) throw new Error('Marca al menos dos puntos para crear la vía');
  const esPuente = cruzaRio(dibujo, rios);
  const nombre = esPuente && dibujo.preset === 'calle' ? 'Puente nuevo' : dibujo.atributos.nombre;
  return {
    tipo: 'viaNueva',
    id,
    puntos: lineaDelDibujo(dibujo),
    extremos: [dibujo.puntos[0].ajuste, dibujo.puntos.at(-1).ajuste],
    atributos: { ...dibujo.atributos, esPuente, nombre },
  };
}

export function siguienteIdVia(datos) {
  let k = 1;
  while (datos.vias.some((v) => v.id === `nueva-${k}` || v.id.startsWith(`nueva-${k}~`))) k += 1;
  return `nueva-${k}`;
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/escenarios/ajuste.test.js tests/ui/dibujo.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/escenarios/ajuste.js src/ui/edicion/dibujo.js tests/escenarios/ajuste.test.js tests/ui/dibujo.test.js
git commit -m "feat(editor): pegar puntos a la red y estado del dibujo de vías nuevas"
```

---

### Task 6: Restricción de pesados de paso

**Files:**
- Create: `src/sim/restriccion.js`
- Modify: `src/escenarios/zonas.js`, `src/sim/motor.js`, `tests/sim/redesPrueba.js`
- Test: `tests/sim/restriccion.test.js`

**Interfaces:**
- Consumes: `posicionEnArco`, `prepararGeometria` (`src/sim/geometriaArcos.js`); `rutaMasRapida`; `arcoTransitable`.
- Produces:
  - `CASCO_URBANO = { lon, lat, radio }` (`src/escenarios/zonas.js`).
  - `FLUJOS_RESTRINGIBLES` (`pesado`, `busPaso`), `TIPOS_PERMITIDOS` (`avenida_nacional`, `variante`), `arcosEnCasco(red, geometria, casco) → Set<arcoId>`, `permitidoRestringido(red, arcosCasco, arcoId) → boolean`, `rodeaElCasco(red, arcosCasco, a, b) → boolean`.
  - Motor: opciones `casco` y `restriccionPesados`; `agregarVehiculo({ …, flujo })`; `configurarRestriccion(activa)`; getter `restriccion`. Cada vehículo guarda `origen`, `flujo`, `restringible`.
  - Redes de prueba: `datosRodeo({ varianteEnObra })`, `redRodeo(opciones)`, `CASCO_PRUEBA`.

Regla: con la restricción activa, un vehículo de flujo `pesado` o `busPaso` solo puede usar vías de tipo Avenida Nacional o Variante que estén **fuera** del casco urbano. Si con esa regla no llega a su destino (la Variante no conecta), toma la ruta normal por el centro.

- [ ] **Step 1: Agregar la red de prueba con Variante**

Al final de `tests/sim/redesPrueba.js`:

```js
// La Avenida atraviesa el casco urbano (W–a–b–E); la Variante lo rodea por el
// norte (W–v1–v2–E), más larga. El casco es un círculo de 600 m en (0, 0).
const [lonCasco, latCasco] = punto(0, 0);
export const CASCO_PRUEBA = { lon: lonCasco, lat: latCasco, radio: 600 };

export function datosRodeo({ varianteEnObra = false } = {}) {
  const nodos = { W: [-1500, 0], a: [-500, 0], b: [500, 0], E: [1500, 0], v1: [-1000, 1200], v2: [1000, 1200] };
  const avenida = { tipo: 'avenida_nacional', sentido: 'ambos', velocidadMax: 50 };
  const variante = { tipo: 'variante', sentido: 'ambos', velocidadMax: 60, enConstruccion: varianteEnObra };
  return armarDatos(nodos, [
    viaEntre('Wa', nodos, 'W', 'a', avenida),
    viaEntre('ab', nodos, 'a', 'b', avenida),
    viaEntre('bE', nodos, 'b', 'E', avenida),
    viaEntre('Wv1', nodos, 'W', 'v1', variante),
    viaEntre('v1v2', nodos, 'v1', 'v2', variante),
    viaEntre('v2E', nodos, 'v2', 'E', variante),
  ]);
}

export const redRodeo = (opciones) => crearRed(datosRodeo(opciones));
```

- [ ] **Step 2: Escribir los tests**

`tests/sim/restriccion.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { arcosEnCasco, rodeaElCasco, permitidoRestringido } from '../../src/sim/restriccion.js';
import { prepararGeometria } from '../../src/sim/geometriaArcos.js';
import { crearMotor } from '../../src/sim/motor.js';
import { CONDUCTOR_NEUTRO } from '../../src/sim/vehiculos.js';
import { redRodeo, CASCO_PRUEBA } from './redesPrueba.js';

describe('casco urbano', () => {
  it('solo el tramo de Avenida del centro queda dentro del casco', () => {
    const red = redRodeo();
    expect([...arcosEnCasco(red, prepararGeometria(red), CASCO_PRUEBA)].sort()).toEqual(['ab<', 'ab>']);
  });

  it('la Variante rodea el casco solo si está terminada', () => {
    for (const [varianteEnObra, esperado] of [[false, true], [true, false]]) {
      const red = redRodeo({ varianteEnObra });
      const casco = arcosEnCasco(red, prepararGeometria(red), CASCO_PRUEBA);
      expect(rodeaElCasco(red, casco, 'W', 'E')).toBe(esperado);
    }
  });

  it('un restringido no puede usar calles comunes aunque estén fuera del casco', () => {
    const red = redRodeo();
    red.vias.get('Wa').tipo = 'doble_sentido';
    expect(permitidoRestringido(red, new Set(), 'Wa>')).toBe(false);
    expect(permitidoRestringido(red, new Set(), 'Wv1>')).toBe(true);
  });
});

describe('motor con restricción de pesados', () => {
  const camion = { tipo: 'camion', origen: 'W', destino: 'E', flujo: 'pesado', conductor: CONDUCTOR_NEUTRO };
  const motor = (opciones = {}, red = redRodeo()) => crearMotor(red, { conDemanda: false, casco: CASCO_PRUEBA, ...opciones });

  it('sin restricción el camión de paso cruza por el centro', () => {
    expect(motor().agregarVehiculo(camion).ruta).toContain('ab>');
  });

  it('con restricción el camión de paso usa la Variante', () => {
    const ruta = motor({ restriccionPesados: true }).agregarVehiculo(camion).ruta;
    expect(ruta).toContain('v1v2>');
    expect(ruta).not.toContain('ab>');
  });

  it('un carro de paso no se restringe', () => {
    const ruta = motor({ restriccionPesados: true }).agregarVehiculo({ ...camion, tipo: 'carro', flujo: 'paso' }).ruta;
    expect(ruta).toContain('ab>');
  });

  it('si la Variante no conecta, el camión pasa por el centro y no es un viaje imposible', () => {
    const m = motor({ restriccionPesados: true }, redRodeo({ varianteEnObra: true }));
    expect(m.agregarVehiculo(camion).ruta).toContain('ab>');
    expect(m.resumen().viajesImposibles).toBe(0);
  });

  it('activar la restricción en marcha cambia la ruta de los camiones nuevos', () => {
    const m = motor();
    expect(m.restriccion).toBe(false);
    m.configurarRestriccion(true);
    expect(m.restriccion).toBe(true);
    expect(m.agregarVehiculo(camion).ruta).toContain('v1v2>');
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run tests/sim/restriccion.test.js`
Expected: FAIL, no se puede resolver `src/sim/restriccion.js`.

- [ ] **Step 4: Implementar `src/sim/restriccion.js`**

```js
// Restricción de pesados de paso: con la Variante terminada, tractomulas y
// buses que solo atraviesan San Gil no pueden entrar al casco urbano.

import { distanciaMetros } from './geo.js';
import { posicionEnArco } from './geometriaArcos.js';
import { rutaMasRapida } from './rutas.js';
import { arcoTransitable } from './red.js';

export const FLUJOS_RESTRINGIBLES = new Set(['pesado', 'busPaso']);
export const TIPOS_PERMITIDOS = new Set(['avenida_nacional', 'variante']);

export function arcosEnCasco(red, geometria, casco) {
  const dentro = new Set();
  if (!casco) return dentro;
  for (const [arcoId, geo] of geometria) {
    const medio = posicionEnArco(geo, geo.largo / 2);
    if (distanciaMetros(medio, [casco.lon, casco.lat]) <= casco.radio) dentro.add(arcoId);
  }
  return dentro;
}

export function permitidoRestringido(red, arcosCasco, arcoId) {
  if (!arcoTransitable(red, arcoId) || arcosCasco.has(arcoId)) return false;
  return TIPOS_PERMITIDOS.has(red.vias.get(red.arcos.get(arcoId).viaId).tipo);
}

// ¿Se puede ir de a a b, y volver, sin entrar al casco y solo por Avenida y Variante?
export function rodeaElCasco(red, arcosCasco, a, b) {
  const costo = (arcoId) => (permitidoRestringido(red, arcosCasco, arcoId) ? 1 : Infinity);
  return rutaMasRapida(red, a, b, costo) !== null && rutaMasRapida(red, b, a, costo) !== null;
}
```

- [ ] **Step 5: Agregar el casco urbano a `src/escenarios/zonas.js`**

Al final del archivo:

```js
// Casco urbano para la restricción de pesados de paso: círculo alrededor del
// Parque La Libertad. Supuesto razonable; la Variante y las salidas quedan fuera.
export const CASCO_URBANO = { lon: -73.1336, lat: 6.5548, radio: 1300 };
```

- [ ] **Step 6: Integrar la restricción en `src/sim/motor.js`**

1. Reemplazar la línea `import { ZONAS, SALIDAS } from '../escenarios/zonas.js';` por:

```js
import { ZONAS, SALIDAS, CASCO_URBANO } from '../escenarios/zonas.js';
import { arcosEnCasco, FLUJOS_RESTRINGIBLES, permitidoRestringido } from './restriccion.js';
```

2. Reemplazar `alCruzar = null, alTerminar = null,` (dentro de la desestructuración de `opciones`) por:

```js
    alCruzar = null, alTerminar = null, casco = CASCO_URBANO, restriccionPesados = false,
```

3. Reemplazar `const accesos = analizarAccesos(red, geometria);` por:

```js
  const accesos = analizarAccesos(red, geometria);
  let cascoArcos = arcosEnCasco(red, geometria, casco);
  let restriccion = restriccionPesados;
```

4. Reemplazar la línea `const costo = (arcoId) => (arcoTransitable(red, arcoId) ? tiempos.estimado(arcoId) : Infinity);` por:

```js
  const costo = (arcoId) => (arcoTransitable(red, arcoId) ? tiempos.estimado(arcoId) : Infinity);
  const costoRestringido = (arcoId) => (permitidoRestringido(red, cascoArcos, arcoId) ? tiempos.estimado(arcoId) : Infinity);

  // Con la restricción activa, los pesados de paso solo usan Avenida y Variante
  // por fuera del casco; si así no llegan (la Variante no conecta), pasan por
  // el centro como hoy.
  function rutaPara(veh, origen) {
    if (restriccion && veh.restringible) {
      const ruta = rutaMasRapida(red, origen, veh.destino, costoRestringido);
      if (ruta) return ruta;
    }
    return rutaMasRapida(red, origen, veh.destino, costo);
  }
```

5. En `agregarVehiculo`, reemplazar las dos primeras líneas:

```js
  function agregarVehiculo({ tipo, origen, destino, conductor }) {
    const ruta = rutaMasRapida(red, origen, destino, costo);
```

por:

```js
  function agregarVehiculo({ tipo, origen, destino, conductor, flujo = 'local' }) {
    const restringible = FLUJOS_RESTRINGIBLES.has(flujo);
    const ruta = rutaPara({ restringible, destino }, origen);
```

y en el objeto `veh`, reemplazar `ruta: ruta.arcos, i: 0, s: 0, v: 0, a: 0, carril: 0, destino,` por:

```js
      ruta: ruta.arcos, i: 0, s: 0, v: 0, a: 0, carril: 0, destino, origen, flujo, restringible,
```

6. En `reRutear`, reemplazar `const nueva = rutaMasRapida(red, desde, veh.destino, costo);` por `const nueva = rutaPara(veh, desde);`.

7. Antes de `function paso() {`, agregar:

```js
  function configurarRestriccion(activa) {
    restriccion = Boolean(activa);
    for (const veh of vivos) if (veh.restringible) veh.proximoReruteo = t;
  }
```

8. En el objeto que devuelve `crearMotor`, después de `get t() { return t; },` agregar:

```js
    get restriccion() { return restriccion; },
    configurarRestriccion,
```

`cascoArcos` se declara con `let` porque la Task 7 lo recalcula al cambiar la red.

- [ ] **Step 7: Correr y verificar que pasa**

Run: `npx vitest run tests/sim/restriccion.test.js` y luego `npm test`
Expected: PASS en ambos.

- [ ] **Step 8: Commit**

```bash
git add src/sim/restriccion.js src/sim/motor.js src/escenarios/zonas.js tests/sim/redesPrueba.js tests/sim/restriccion.test.js
git commit -m "feat(sim): restricción de pesados de paso por fuera del casco urbano"
```

---

### Task 7: Cambiar la red con la simulación corriendo

**Files:**
- Modify: `src/sim/motor.js`, `src/sim/rutas.js`, `src/sim/demanda.js`, `src/sim/metricas.js`, `tests/sim/redesPrueba.js`, `tests/sim/metricas.test.js`
- Test: `tests/sim/motorCambios.test.js`, `tests/sim/rutas.test.js`, `tests/sim/demanda.test.js`

**Interfaces:**
- Produces:
  - `crearTiempos(red, geometria, previos = new Map())` y su método `exportar() → Map<arcoId, segundos>`.
  - `crearDemanda(...)` devuelve además `actualizarPuntos(puntos)`.
  - `crearMetricas()`: `retirado()`; `resumen()` incluye `retirados`.
  - `motor.aplicarRed(nuevaRed)`.
  - Redes de prueba: `datosDosRutas()`.

Comportamiento de `aplicarRed`: un arco "sigue igual" si existe en las dos redes con los mismos `desde`, `hasta` y largo (al decímetro).

- Los vehículos en arcos que siguen igual se quedan donde iban, pierden el permiso de cruce y re-calculan su ruta en los próximos 10 s. Si el resto de su ruta usa arcos que ya no siguen igual, la re-calculan en ese momento, y si no hay ruta se retiran.
- Los vehículos en arcos que cambiaron se retiran.
- Si al reducir carriles un vehículo queda encima de otro, se retira.
- Los tiempos medidos de los arcos que siguen igual se conservan.

- [ ] **Step 1: Agregar `datosDosRutas` a las redes de prueba**

En `tests/sim/redesPrueba.js`, reemplazar la función `redDosRutas` completa por:

```js
// a → b → d directo, o a → b → m → d por la alterna. Todo de un sentido.
export function datosDosRutas() {
  const nodos = { a: [0, 0], b: [200, 0], d: [400, 0], m: [300, 150] };
  return armarDatos(nodos, [
    viaEntre('ab', nodos, 'a', 'b'),
    viaEntre('bd', nodos, 'b', 'd'),
    viaEntre('bm', nodos, 'b', 'm'),
    viaEntre('md', nodos, 'm', 'd'),
  ]);
}

export const redDosRutas = () => crearRed(datosDosRutas());
```

- [ ] **Step 2: Escribir los tests**

Al final de `tests/sim/rutas.test.js`:

```js
describe('crearTiempos · conservar lo medido', () => {
  it('arranca con tiempos previos y los exporta', () => {
    const tiempos = crearTiempos(red, geo, new Map([['bd>', 500]]));
    expect(tiempos.estimado('bd>')).toBe(500);
    tiempos.registrar('ab>', 40);
    expect([...tiempos.exportar()].sort()).toEqual([['ab>', 40], ['bd>', 500]]);
  });
});
```

Al final de `tests/sim/demanda.test.js`:

```js
describe('crearDemanda · actualizarPuntos', () => {
  it('después de actualizar, los viajes usan las salidas nuevas', () => {
    const demanda = crearDemanda(puntos, { horaInicio: 11, factor: 5 }, crearAleatorio(4));
    demanda.actualizarPuntos({
      ...puntos,
      salidas: { n1: { nombre: 'N1', nodo: 'N1', avenida: true }, n2: { nombre: 'N2', nodo: 'N2', avenida: true } },
    });
    const pesados = [];
    for (let t = 0; t < 1800; t += 0.5) pesados.push(...demanda.generar(t, 0.5).filter((v) => v.flujo === 'pesado'));
    expect(pesados.length).toBeGreaterThan(0);
    for (const v of pesados) expect(['N1', 'N2']).toContain(v.origen);
  });
});
```

En `tests/sim/metricas.test.js`, en el test "sin viajes todo es cero", agregar `retirados: 0,` al objeto esperado (después de `bloqueos: 0,`), y agregar al final del archivo:

```js
describe('crearMetricas · retirados', () => {
  it('cuenta los vehículos retirados por cambios en la red', () => {
    const m = crearMetricas();
    m.retirado();
    expect(m.resumen().retirados).toBe(1);
  });
});
```

`tests/sim/motorCambios.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearMotor } from '../../src/sim/motor.js';
import { crearRed } from '../../src/sim/red.js';
import { CONDUCTOR_NEUTRO } from '../../src/sim/vehiculos.js';
import { datosDosRutas, datosRedLinea, armarDatos, viaEntre } from './redesPrueba.js';

const carro = (origen, destino) => ({ tipo: 'carro', origen, destino, conductor: CONDUCTOR_NEUTRO });
const cambiarVia = (datos, viaId, cambios) => ({
  ...datos, vias: datos.vias.map((v) => (v.id === viaId ? { ...v, ...cambios } : v)),
});
const sinDemanda = (red) => crearMotor(red, { conDemanda: false });

describe('motor · red en caliente', () => {
  it('cerrar la vía de adelante: el vehículo toma la alterna y llega', () => {
    const datos = datosDosRutas();
    const motor = sinDemanda(crearRed(datos));
    const veh = motor.agregarVehiculo(carro('a', 'd'));
    motor.avanzar(2);
    motor.aplicarRed(crearRed(cambiarVia(datos, 'bd', { abierta: false })));
    motor.avanzar(150);
    expect(veh.ruta).toContain('bm>');
    expect(motor.resumen().viajesCompletados).toBe(1);
  });

  it('cambiar el estado de otra vía no mueve a nadie de su sitio', () => {
    const datos = datosRedLinea();
    const motor = sinDemanda(crearRed(datos));
    const veh = motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(5);
    const antes = { i: veh.i, s: veh.s, v: veh.v };
    motor.aplicarRed(crearRed(cambiarVia(datos, 't2', { estado: 'huecos' })));
    expect(motor.vehiculos()).toContain(veh);
    expect({ i: veh.i, s: veh.s, v: veh.v }).toEqual(antes);
    motor.avanzar(200);
    expect(motor.resumen().viajesCompletados).toBe(1);
  });

  it('invertir la vía en que va un vehículo lo retira y lo cuenta', () => {
    const datos = datosRedLinea();
    const motor = sinDemanda(crearRed(datos));
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(5);
    const t0 = datos.vias.find((v) => v.id === 't0');
    motor.aplicarRed(crearRed(cambiarVia(datos, 't0', { desde: t0.hasta, hasta: t0.desde, geometria: [...t0.geometria].reverse() })));
    const r = motor.resumen();
    expect(r.enRed).toBe(0);
    expect(r.retirados).toBe(1);
  });

  it('si el resto de la ruta deja de existir y no hay otra, el vehículo se retira', () => {
    const datos = datosRedLinea();
    const motor = sinDemanda(crearRed(datos));
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(5);
    const t2 = datos.vias.find((v) => v.id === 't2');
    motor.aplicarRed(crearRed(cambiarVia(datos, 't2', { desde: t2.hasta, hasta: t2.desde, geometria: [...t2.geometria].reverse() })));
    expect(motor.resumen()).toMatchObject({ enRed: 0, retirados: 1 });
    expect(() => motor.avanzar(30)).not.toThrow();
  });

  it('una vía nueva la usan los viajes nuevos', () => {
    const datos = datosDosRutas();
    const motor = sinDemanda(crearRed(datos));
    const nodos = { a: [0, 0], d: [400, 0] };
    const atajo = viaEntre('atajo', nodos, 'a', 'd', { velocidadMax: 60 });
    motor.aplicarRed(crearRed({ ...datos, vias: [...datos.vias, atajo] }));
    expect(motor.agregarVehiculo(carro('a', 'd')).ruta).toEqual(['atajo>']);
  });

  it('pasar de dos carriles a uno no deja vehículos encimados', () => {
    const datos = datosRedLinea({ tramos: 2, largo: 300, extra: { carrilesPorSentido: 2, velocidadMax: 50 } });
    const motor = sinDemanda(crearRed(datos));
    for (let k = 0; k < 12; k++) {
      motor.agregarVehiculo(carro('n0', 'n2'));
      motor.paso();
    }
    motor.avanzar(5);
    motor.aplicarRed(crearRed({ ...datos, vias: datos.vias.map((v) => ({ ...v, carrilesPorSentido: 1 })) }));
    const enT0 = motor.vehiculos().filter((v) => v.ruta[v.i] === 't0>').sort((x, y) => y.s - x.s);
    for (let k = 1; k < enT0.length; k++) {
      expect(enT0[k - 1].s - enT0[k - 1].perfil.largo - enT0[k].s).toBeGreaterThanOrEqual(0);
    }
    expect(() => motor.avanzar(200)).not.toThrow();
  });

  it('un vehículo esperando para entrar recalcula su ruta si la suya dejó de existir', () => {
    const nodos = { a: [0, 0], b: [200, 0], d: [400, 0] };
    const datos = armarDatos(nodos, [viaEntre('ab', nodos, 'a', 'b'), viaEntre('bd', nodos, 'b', 'd'), viaEntre('ad', nodos, 'a', 'd', { velocidadMax: 10 })]);
    const motor = sinDemanda(crearRed(datos));
    const veh = motor.agregarVehiculo(carro('a', 'd'));
    expect(veh.ruta).toEqual(['ab>', 'bd>']);
    const bd = datos.vias.find((v) => v.id === 'bd');
    motor.aplicarRed(crearRed(cambiarVia(datos, 'bd', { desde: 'd', hasta: 'b', geometria: [...bd.geometria].reverse() })));
    expect(veh.ruta).toEqual(['ad>']);
  });
});
```

- [ ] **Step 3: Correr y verificar que fallan**

Run: `npx vitest run tests/sim/motorCambios.test.js tests/sim/rutas.test.js tests/sim/demanda.test.js tests/sim/metricas.test.js`
Expected: FAIL: `aplicarRed`, `exportar`, `actualizarPuntos` y `retirado` no existen; `retirados` falta en el resumen.

- [ ] **Step 4: Implementar en `rutas.js`, `demanda.js` y `metricas.js`**

En `src/sim/rutas.js`:
- Reemplazar `export function crearTiempos(red, geometria) {` por `export function crearTiempos(red, geometria, previos = new Map()) {`.
- Reemplazar `const medido = new Map();` por `const medido = new Map(previos);`.
- En el objeto devuelto, después de `libre,` agregar `exportar: () => new Map(medido),`.

En `src/sim/demanda.js`, reemplazar:

```js
export function crearDemanda(puntos, configInicial, aleatorio) {
  let config = { factor: 1, temporada: 1, horaInicio: 7, ...configInicial };
  const proximo = Object.fromEntries(FLUJOS.map((f) => [f, null]));

  const salidas = Object.values(puntos.salidas);
  const salidasAvenida = salidas.filter((s) => s.avenida);
  const pesosZonas = Object.fromEntries(Object.entries(puntos.zonas).map(([k, z]) => [k, z.peso]));
```

por:

```js
export function crearDemanda(puntosIniciales, configInicial, aleatorio) {
  let config = { factor: 1, temporada: 1, horaInicio: 7, ...configInicial };
  const proximo = Object.fromEntries(FLUJOS.map((f) => [f, null]));

  let puntos;
  let salidas;
  let salidasAvenida;
  let pesosZonas;
  function usarPuntos(nuevos) {
    puntos = nuevos;
    salidas = Object.values(puntos.salidas);
    salidasAvenida = salidas.filter((s) => s.avenida);
    pesosZonas = Object.fromEntries(Object.entries(puntos.zonas).map(([k, z]) => [k, z.peso]));
  }
  usarPuntos(puntosIniciales);
```

y en el objeto devuelto, después de `config: () => ({ ...config }),` agregar `actualizarPuntos: usarPuntos,`.

En `src/sim/metricas.js`:
- Después de `let bloqueos = 0;` agregar `let retirados = 0;`.
- Después de `bloqueo() { bloqueos += 1; },` agregar `retirado() { retirados += 1; },`.
- En `resumen()`, después de `bloqueos,` agregar `retirados,`.

- [ ] **Step 5: Implementar `aplicarRed` en `src/sim/motor.js`**

1. Reemplazar `export function crearMotor(red, opciones = {}) {` por `export function crearMotor(redInicial, opciones = {}) {`.

2. Reemplazar el bloque que va desde `const aleatorio = crearAleatorio(semilla);` hasta el cierre del `for` que llena `estadoArco` (la línea `  }` antes de `const ocupadoHasta`), que tras la Task 6 es:

```js
  const aleatorio = crearAleatorio(semilla);
  const geometria = prepararGeometria(red);
  const tiempos = crearTiempos(red, geometria);
  const accesos = analizarAccesos(red, geometria);
  let cascoArcos = arcosEnCasco(red, geometria, casco);
  let restriccion = restriccionPesados;
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
```

por:

```js
  const aleatorio = crearAleatorio(semilla);
  const metricas = crearMetricas();
  let red = redInicial;
  let geometria;
  let accesos;
  let cascoArcos;
  let estadoArco;

  // Todo lo que depende de la forma de la red. Cada arco guarda sus carriles;
  // cada carril, sus vehículos del frente hacia atrás.
  function construirArcos() {
    geometria = prepararGeometria(red);
    accesos = analizarAccesos(red, geometria);
    cascoArcos = arcosEnCasco(red, geometria, casco);
    estadoArco = new Map();
    for (const [arcoId, geo] of geometria) {
      const via = red.vias.get(red.arcos.get(arcoId).viaId);
      estadoArco.set(arcoId, {
        id: arcoId, via, geo, largo: geo.largo,
        carriles: Array.from({ length: via.carrilesPorSentido }, () => []),
      });
    }
  }
  construirArcos();

  let tiempos = crearTiempos(red, geometria);
  let restriccion = restriccionPesados;
  let puntos = prepararPuntos(red, zonas, salidas);
  const demanda = conDemanda ? crearDemanda(puntos, configDemanda, aleatorio) : null;
```

3. Antes de `function configurarRestriccion(activa) {`, agregar:

```js
  const firma = (r, g, arcoId) => {
    const arco = r.arcos.get(arcoId);
    return arco ? `${arco.desde}|${arco.hasta}|${g.get(arcoId).largo.toFixed(1)}` : null;
  };

  // Aplica una red editada a la simulación en curso. Quien va por un arco que
  // no cambió sigue donde iba; quien iba por uno que cambió se retira.
  function aplicarRed(nuevaRed) {
    const antes = { red, geometria, estadoArco };
    const medidos = tiempos.exportar();
    red = nuevaRed;
    construirArcos();
    const igual = (arcoId) => {
      const f = firma(antes.red, antes.geometria, arcoId);
      return f !== null && f === firma(red, geometria, arcoId);
    };
    tiempos = crearTiempos(red, geometria, new Map([...medidos].filter(([id]) => igual(id))));
    puntos = prepararPuntos(red, zonas, salidas);
    demanda?.actualizarPuntos(puntos);
    llegandoA.clear();

    const retirar = (veh) => { vivos.delete(veh); metricas.retirado(); };
    for (const viejo of antes.estadoArco.values()) {
      for (const carril of viejo.carriles) {
        for (const veh of carril) {
          const actual = veh.ruta[veh.i];
          if (!igual(actual)) { retirar(veh); continue; }
          if (!veh.ruta.slice(veh.i + 1).every(igual)) {
            const nueva = rutaPara(veh, red.arcos.get(actual).hasta);
            if (!nueva || nueva.arcos.length === 0) { retirar(veh); continue; }
            veh.ruta = [...veh.ruta.slice(0, veh.i + 1), ...nueva.arcos];
          }
          const e = estadoArco.get(actual);
          veh.carril = Math.min(veh.carril, e.carriles.length - 1);
          veh.permiso = false;
          veh.paroEnPare = false;
          veh.proximoReruteo = t + (veh.id % 10); // repartido para no recalcular todo de una vez
          const lista = e.carriles[veh.carril];
          insertarOrdenado(lista, veh);
          const k = lista.indexOf(veh);
          const lider = lista[k - 1];
          const seguidor = lista[k + 1];
          if ((lider && lider.s - lider.perfil.largo < veh.s) || (seguidor && veh.s - veh.perfil.largo < seguidor.s)) {
            lista.splice(k, 1);
            retirar(veh);
          }
        }
      }
    }

    const siguenEsperando = [];
    for (const veh of pendientes) {
      if (veh.ruta.every(igual)) { siguenEsperando.push(veh); continue; }
      const nueva = rutaPara(veh, veh.origen);
      if (nueva && nueva.arcos.length) {
        veh.ruta = nueva.arcos;
        siguenEsperando.push(veh);
      } else {
        metricas.viajeImposible();
      }
    }
    pendientes.length = 0;
    pendientes.push(...siguenEsperando);
  }
```

4. En el objeto devuelto, después de `configurarRestriccion,` agregar `aplicarRed,`.

- [ ] **Step 6: Correr y verificar que pasan**

Run: `npx vitest run tests/sim/motorCambios.test.js tests/sim/rutas.test.js tests/sim/demanda.test.js tests/sim/metricas.test.js` y luego `npm test`
Expected: PASS en ambos.

- [ ] **Step 7: Commit**

```bash
git add src/sim tests/sim
git commit -m "feat(sim): aplicar una red editada con la simulación corriendo"
```

---

### Task 8: Ríos para detectar puentes nuevos

**Files:**
- Modify: `scripts/construir-red.js`
- Create: `src/ui/datos/cargarRios.js`, `public/data/rios.json` (generado)
- Test: `tests/ui/cargarRios.test.js`

**Interfaces:**
- Produces: `public/data/rios.json` con `{ version: 1, fuente, rios: [{ nombre, geometria: [lon,lat][] }] }`; `urlRios(base?)`, `cargarRios(fetchFn?, url?) → Promise<[lon,lat][][]>` (nunca falla: ante cualquier error devuelve `[]`).

- [ ] **Step 1: Escribir el test**

`tests/ui/cargarRios.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { cargarRios, urlRios } from '../../src/ui/datos/cargarRios.js';

const respuesta = (cuerpo, ok = true) => async () => ({ ok, status: ok ? 200 : 404, json: async () => cuerpo });

describe('cargarRios', () => {
  it('devuelve las geometrías de los ríos', async () => {
    const rios = await cargarRios(respuesta({ version: 1, rios: [{ nombre: 'Río Fonce', geometria: [[0, 0], [1, 1]] }] }));
    expect(rios).toEqual([[[0, 0], [1, 1]]]);
  });

  it('ante cualquier error devuelve una lista vacía', async () => {
    expect(await cargarRios(respuesta(null, false))).toEqual([]);
    expect(await cargarRios(async () => { throw new Error('sin red'); })).toEqual([]);
    expect(await cargarRios(respuesta({ version: 1 }))).toEqual([]);
  });

  it('la URL es relativa a la base de la app', () => {
    expect(urlRios('/MapaSanGil/')).toBe('/MapaSanGil/data/rios.json');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/ui/cargarRios.test.js`
Expected: FAIL, no se puede resolver el módulo.

- [ ] **Step 3: Implementar `src/ui/datos/cargarRios.js`**

```js
// Ríos de la zona, para marcar como puente una vía nueva que los cruce.
// Es un dato opcional: si no carga, el editor funciona igual sin esa ayuda.

export const urlRios = (base = import.meta.env?.BASE_URL ?? '/') => `${base}data/rios.json`;

export async function cargarRios(fetchFn = globalThis.fetch, url = urlRios()) {
  try {
    const respuesta = await fetchFn(url);
    if (!respuesta.ok) return [];
    const datos = await respuesta.json();
    return Array.isArray(datos?.rios) ? datos.rios.map((r) => r.geometria) : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Generar `public/data/rios.json` desde `scripts/construir-red.js`**

1. Después de la constante `SALIDA`, agregar:

```js
const CACHE_RIOS = join(RAIZ, 'scripts', 'cache', 'rio.json');
const SALIDA_RIOS = join(RAIZ, 'public', 'data', 'rios.json');
const CONSULTA_RIOS = `[out:json][timeout:60];way["waterway"="river"](${BBOX.sur},${BBOX.oeste},${BBOX.norte},${BBOX.este});out tags geom;`;
```

2. Cambiar la firma `async function descargar() {` por `async function descargar(consulta = CONSULTA) {` y, dentro, `body: \`data=${encodeURIComponent(CONSULTA)}\`,` por `body: \`data=${encodeURIComponent(consulta)}\`,`.

3. Antes de `async function main() {`, agregar:

```js
async function escribirRios(fresca) {
  let crudo;
  if (!fresca && existsSync(CACHE_RIOS)) {
    crudo = JSON.parse(await readFile(CACHE_RIOS, 'utf8'));
  } else {
    crudo = await descargar(CONSULTA_RIOS);
    await writeFile(CACHE_RIOS, JSON.stringify(crudo));
  }
  const rios = crudo.elements
    .filter((e) => e.type === 'way' && e.geometry)
    .map((e) => ({ nombre: e.tags?.name ?? '', geometria: e.geometry.map((g) => [g.lon, g.lat]) }));
  await writeFile(SALIDA_RIOS, JSON.stringify({ version: 1, fuente: '© colaboradores de OpenStreetMap (ODbL)', rios }));
  console.log(`${rios.length} tramos de río -> ${SALIDA_RIOS}`);
}
```

4. En `main()`, después de `console.log(\`\nRed -> ${SALIDA}\`);`, agregar:

```js
  try {
    await escribirRios(fresca);
  } catch (err) {
    console.warn(`No se pudieron generar los ríos (${err.message}); el editor no marcará puentes solo.`);
  }
```

- [ ] **Step 5: Generar y verificar**

Run: `npm run red`
Expected: además de la salida de siempre, una línea `N tramos de río -> …/public/data/rios.json` con N ≥ 1, y en la lista de ríos está el Fonce (`node -e "console.log(require('./public/data/rios.json').rios.map(r=>r.nombre))"`).

Run: `npx vitest run tests/ui/cargarRios.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/construir-red.js src/ui/datos/cargarRios.js tests/ui/cargarRios.test.js public/data/rios.json public/data/red-sangil.json
git commit -m "feat(red): ríos de la zona para detectar puentes nuevos"
```

---

### Task 9: Mensajes del worker para editar en vivo

**Files:**
- Modify: `src/worker/controlador.js`, `src/worker/clienteSimulacion.js`
- Test: `tests/worker/controlador.test.js`

**Interfaces:**
- Consumes: `motor.aplicarRed`, `motor.configurarRestriccion` (Tasks 6 y 7).
- Produces: el controlador atiende `{ tipo: 'red', datosRed }` (responde un cuadro y un resumen; si la red es inválida, envía un error y **sigue con la red anterior**) y `{ tipo: 'restriccion', activa }`. El cliente agrega `red(datosRed)` y `restriccion(activa)`.

- [ ] **Step 1: Escribir los tests**

Al final de `tests/worker/controlador.test.js`:

```js
describe('crearControlador · edición en vivo', () => {
  const armar = () => {
    const enviados = [];
    const controlador = crearControlador((m) => enviados.push(m), { ahora: () => 0, presupuestoMs: 35 });
    return { enviados, controlador };
  };

  it('aplica una red nueva y responde cuadro y resumen', () => {
    const { enviados, controlador } = armar();
    const datos = datosRedLinea();
    controlador.recibir({ tipo: 'iniciar', datosRed: datos, opciones: { conDemanda: false } });
    enviados.length = 0;
    const cerrada = { ...datos, vias: datos.vias.map((v) => (v.id === 't1' ? { ...v, abierta: false } : v)) };
    controlador.recibir({ tipo: 'red', datosRed: cerrada });
    expect(enviados.map((m) => m.tipo)).toEqual(['cuadro', 'resumen']);
  });

  it('una red inválida responde error y la simulación sigue con la anterior', () => {
    const { enviados, controlador } = armar();
    controlador.recibir({ tipo: 'iniciar', datosRed: datosRedLinea(), opciones: { conDemanda: false } });
    controlador.recibir({ tipo: 'red', datosRed: { version: 1 } });
    expect(enviados.at(-1)).toMatchObject({ tipo: 'error', mensaje: expect.stringMatching(/Red inválida/) });
    controlador.recibir({ tipo: 'reloj', corriendo: true, velocidad: 20 });
    controlador.tick(50);
    expect(enviados.at(-1)).toMatchObject({ tipo: 'cuadro', t: 1 });
  });

  it('red y restricción antes de iniciar no rompen nada', () => {
    const { enviados, controlador } = armar();
    controlador.recibir({ tipo: 'red', datosRed: datosRedLinea() });
    controlador.recibir({ tipo: 'restriccion', activa: true });
    expect(enviados).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/worker/controlador.test.js`
Expected: FAIL: el mensaje `red` no se atiende (no llegan cuadro ni resumen).

- [ ] **Step 3: Implementar**

En `src/worker/controlador.js`, dentro de `recibir`, después del bloque `} else if (mensaje.tipo === 'demanda') { … }` y antes de `} catch (err) {`, agregar:

```js
        } else if (mensaje.tipo === 'restriccion') {
          motor?.configurarRestriccion(mensaje.activa);
        } else if (mensaje.tipo === 'red') {
          if (!motor) return;
          let nueva;
          try {
            nueva = crearRed(mensaje.datosRed);
          } catch (err) {
            enviar({ tipo: 'error', mensaje: err.message });
            return;
          }
          motor.aplicarRed(nueva);
          enviarCuadro();
          enviarResumen();
```

En `src/worker/clienteSimulacion.js`, dentro del objeto devuelto y después de `demanda: …,` agregar:

```js
    red: (datosRed) => worker.postMessage({ tipo: 'red', datosRed }),
    restriccion: (activa) => worker.postMessage({ tipo: 'restriccion', activa }),
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/worker/controlador.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worker tests/worker
git commit -m "feat(worker): aplicar ediciones de la red y la restricción en vivo"
```

---

### Task 10: Estilos del editor

**Files:**
- Create: `src/ui/mapa/geometriaUi.js`
- Modify: `src/ui/mapa/estilosVia.js`
- Test: `tests/ui/geometriaUi.test.js`, `tests/ui/estilosVia.test.js`

**Interfaces:**
- Produces: `circulo(lon, lat, radio, n = 72) → [lon,lat][]` (cerrado); en `estilosVia.js`: `COLOR_CERRADA`, `COLOR_SEMAFORO`, `COLOR_CRUCE`, `COLOR_DIBUJO`, `COLOR_AJUSTE = { nodo, via, libre }`, `EXTRA_DOBLE_CALZADA = 4`, y `anchoVia` suma `EXTRA_DOBLE_CALZADA` si `via.dobleCalzada`.

- [ ] **Step 1: Escribir los tests**

`tests/ui/geometriaUi.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { circulo } from '../../src/ui/mapa/geometriaUi.js';
import { distanciaMetros } from '../../src/sim/geo.js';

describe('circulo', () => {
  it('todos sus puntos están al radio pedido y el anillo se cierra', () => {
    const anillo = circulo(-73.1336, 6.5548, 1300, 36);
    expect(anillo).toHaveLength(37);
    expect(anillo[0]).toEqual(anillo[36]);
    for (const p of anillo) {
      const d = distanciaMetros(p, [-73.1336, 6.5548]);
      expect(d).toBeGreaterThan(1300 * 0.99);
      expect(d).toBeLessThan(1300 * 1.01);
    }
  });
});
```

Al final de `tests/ui/estilosVia.test.js`:

```js
import { EXTRA_DOBLE_CALZADA, COLOR_AJUSTE } from '../../src/ui/mapa/estilosVia.js';

describe('estilos del editor', () => {
  it('la doble calzada se dibuja más ancha', () => {
    expect(anchoVia({ tipo: 'avenida_nacional', dobleCalzada: true })).toBe(ANCHO_TIPO.avenida_nacional + EXTRA_DOBLE_CALZADA);
  });

  it('hay un color por tipo de ajuste', () => {
    for (const tipo of ['nodo', 'via', 'libre']) expect(COLOR_AJUSTE[tipo]).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/ui/geometriaUi.test.js tests/ui/estilosVia.test.js`
Expected: FAIL: no existe `geometriaUi.js`; `EXTRA_DOBLE_CALZADA` y `COLOR_AJUSTE` no están definidos.

- [ ] **Step 3: Implementar**

`src/ui/mapa/geometriaUi.js`:

```js
const METROS_POR_GRADO_LAT = 110574;

export function circulo(lon, lat, radio, n = 72) {
  const metrosLon = 111320 * Math.cos((lat * Math.PI) / 180);
  return Array.from({ length: n + 1 }, (_, i) => {
    const angulo = (2 * Math.PI * (i % n)) / n;
    return [lon + (radio * Math.cos(angulo)) / metrosLon, lat + (radio * Math.sin(angulo)) / METROS_POR_GRADO_LAT];
  });
}
```

En `src/ui/mapa/estilosVia.js`:
- Después de `export const COLOR_SELECCION = [20, 20, 20];` agregar:

```js
export const COLOR_CERRADA = [150, 150, 150];
export const COLOR_SEMAFORO = [39, 174, 96];
export const COLOR_CRUCE = [120, 130, 140];
export const COLOR_DIBUJO = [230, 126, 34];
export const COLOR_AJUSTE = { nodo: [39, 174, 96], via: [41, 128, 185], libre: [120, 120, 120] };
export const EXTRA_DOBLE_CALZADA = 4;
```

- Reemplazar `export const anchoVia = (via) => ANCHO_TIPO[via.tipo];` por:

```js
export const anchoVia = (via) => ANCHO_TIPO[via.tipo] + (via.dobleCalzada ? EXTRA_DOBLE_CALZADA : 0);
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/ui/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/mapa tests/ui
git commit -m "feat(ui): estilos del editor y círculo del casco urbano"
```

---

### Task 11: Interfaz del editor

**Files:**
- Create: `src/ui/edicion/useEdicion.js`, `src/ui/paneles/FichaCruce.jsx`, `src/ui/paneles/PanelObras.jsx`, `src/ui/paneles/PanelDibujo.jsx`, `src/ui/paneles/Confirmacion.jsx`
- Modify (reemplazo completo): `src/ui/paneles/FichaVia.jsx`, `src/ui/paneles/Leyenda.jsx`, `src/ui/mapa/MapaSanGil.jsx`, `src/ui/App.jsx`
- Modify: `src/ui/estilos.css` (agregar al final)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `useEdicion(base) → { datos, historial, aplicar(cambio, descripcion), pendiente, confirmar(), cancelar(), deshacer(), rehacer(), puedeDeshacer, puedeRehacer, descartarTodo(), error, mostrarError(texto), limpiarError() }`.
  - `<FichaVia via onCambio onCerrar />`, `<FichaCruce nodo red onCambio onCerrar />`, `<PanelObras … />`, `<PanelDibujo … />`, `<Confirmacion titulo textoConfirmar onConfirmar onCancelar>…</Confirmacion>`.
  - `<MapaSanGil red vehiculos colorPor congestion seleccion onSeleccionar modo dibujo onClicMapa casco />` con `seleccion = { tipo: 'via' | 'cruce', id } | null`.

Esta tarea es interfaz; se verifica en el navegador.

- [ ] **Step 1: Crear `src/ui/edicion/useEdicion.js`**

```js
import { useCallback, useEffect, useMemo, useState } from 'react';
import { aplicarCambio, aplicarCambios } from '../../escenarios/cambios.js';
import { evaluarImpacto } from '../../escenarios/impacto.js';
import {
  HISTORIAL_VACIO, agregar, deshacer as deshacerH, rehacer as rehacerH,
  activos, puedeDeshacer, puedeRehacer, serializar, deserializar,
} from '../../escenarios/historial.js';
import { ZONAS, SALIDAS } from '../../escenarios/zonas.js';

const CLAVE = 'mapa-sangil:cambios';

// Recupera el historial guardado en el navegador si todavía se puede aplicar.
function leerGuardado(base) {
  try {
    const h = deserializar(localStorage.getItem(CLAVE));
    if (!h) return HISTORIAL_VACIO;
    aplicarCambios(base, activos(h));
    return h;
  } catch {
    return HISTORIAL_VACIO;
  }
}

export function useEdicion(base) {
  const [historial, setHistorial] = useState(HISTORIAL_VACIO);
  const [cargado, setCargado] = useState(false);
  const [pendiente, setPendiente] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (base && !cargado) {
      setHistorial(leerGuardado(base));
      setCargado(true);
    }
  }, [base, cargado]);

  useEffect(() => {
    if (!cargado) return;
    try { localStorage.setItem(CLAVE, serializar(historial)); } catch { /* el navegador no deja guardar */ }
  }, [historial, cargado]);

  const datos = useMemo(
    () => (base && cargado ? aplicarCambios(base, activos(historial)) : null),
    [base, cargado, historial],
  );

  const aplicar = useCallback((cambio, descripcion) => {
    setError(null);
    try {
      const despues = aplicarCambio(datos, cambio);
      const impacto = evaluarImpacto(datos, despues, ZONAS, SALIDAS);
      const entrada = { cambio, descripcion };
      if (impacto.requiereConfirmacion) setPendiente({ entrada, impacto });
      else setHistorial((h) => agregar(h, entrada));
    } catch (err) {
      setError(err.message);
    }
  }, [datos]);

  return {
    datos,
    historial,
    aplicar,
    pendiente,
    confirmar: () => {
      if (pendiente) setHistorial((h) => agregar(h, pendiente.entrada));
      setPendiente(null);
    },
    cancelar: () => setPendiente(null),
    deshacer: () => setHistorial(deshacerH),
    rehacer: () => setHistorial(rehacerH),
    puedeDeshacer: puedeDeshacer(historial),
    puedeRehacer: puedeRehacer(historial),
    descartarTodo: () => setHistorial(HISTORIAL_VACIO),
    error,
    mostrarError: setError,
    limpiarError: () => setError(null),
  };
}
```

- [ ] **Step 2: Crear los paneles**

`src/ui/paneles/Confirmacion.jsx`:

```jsx
export default function Confirmacion({ titulo, children, textoConfirmar = 'Aplicar de todas formas', onConfirmar, onCancelar }) {
  return (
    <div className="modal-fondo" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <div className="modal">
        <h2 id="modal-titulo">{titulo}</h2>
        <div className="modal-cuerpo">{children}</div>
        <div className="acciones">
          <button type="button" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="principal" onClick={onConfirmar}>{textoConfirmar}</button>
        </div>
      </div>
    </div>
  );
}
```

`src/ui/paneles/FichaVia.jsx` (reemplazo completo):

```jsx
import {
  ETIQUETA_TIPO, ESTADOS, SUPERFICIES, ETIQUETA_ESTADO, ETIQUETA_SUPERFICIE,
} from '../../sim/tipos.js';

const VELOCIDADES = [10, 20, 30, 40, 50, 60, 80];

export default function FichaVia({ via, onCambio, onCerrar }) {
  const nombre = via.nombrePuente ?? (via.nombre || '(vía sin nombre)');
  const cambiar = (propiedades, descripcion) => onCambio({ tipo: 'via', viaId: via.id, propiedades }, `${nombre}: ${descripcion}`);
  const velocidades = VELOCIDADES.includes(via.velocidadMax) ? VELOCIDADES : [...VELOCIDADES, via.velocidadMax].sort((a, b) => a - b);

  return (
    <section className="panel ficha">
      <header>
        <div>
          <h2>{nombre}</h2>
          <p className="subtitulo">
            {ETIQUETA_TIPO[via.tipo]} · {via.longitud} m{via.esPuente ? ' · puente' : ''}
            {via.dobleCalzada ? ' · doble calzada' : ''}
          </p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar ficha">×</button>
      </header>

      <div className="acciones">
        <button type="button" onClick={() => cambiar({ abierta: !via.abierta }, via.abierta ? 'cerrada' : 'abierta')}>
          {via.abierta ? 'Cerrar vía' : 'Abrir vía'}
        </button>
        {via.enConstruccion && (
          <button type="button" className="principal" onClick={() => onCambio({ tipo: 'terminarObra', viaIds: [via.id] }, `${nombre}: obra terminada`)}>
            Terminar obra
          </button>
        )}
      </div>
      {!via.abierta && <p className="aviso">Cerrada: ningún vehículo pasa por aquí.</p>}
      {via.enConstruccion && <p className="aviso">En construcción: todavía no se puede usar.</p>}

      <div className="campos">
        <label>
          <span>Sentido</span>
          <select value={via.sentido} onChange={(e) => cambiar({ sentido: e.target.value }, e.target.value === 'ambos' ? 'doble sentido' : 'un sentido')}>
            <option value="ambos">Doble sentido</option>
            <option value="adelante">Un sentido</option>
          </select>
        </label>
        {via.sentido === 'adelante' && (
          <button type="button" onClick={() => onCambio({ tipo: 'invertirVia', viaId: via.id }, `${nombre}: sentido invertido`)}>
            ⇄ Invertir sentido
          </button>
        )}
        <label>
          <span>Estado</span>
          <select value={via.estado} onChange={(e) => cambiar({ estado: e.target.value }, `estado ${ETIQUETA_ESTADO[e.target.value].toLowerCase()}`)}>
            {ESTADOS.map((x) => <option key={x} value={x}>{ETIQUETA_ESTADO[x]}</option>)}
          </select>
        </label>
        <label>
          <span>Superficie</span>
          <select value={via.superficie} onChange={(e) => cambiar({ superficie: e.target.value }, ETIQUETA_SUPERFICIE[e.target.value].toLowerCase())}>
            {SUPERFICIES.map((x) => <option key={x} value={x}>{ETIQUETA_SUPERFICIE[x]}</option>)}
          </select>
        </label>
        <label>
          <span>Velocidad máxima</span>
          <select value={via.velocidadMax} onChange={(e) => cambiar({ velocidadMax: Number(e.target.value) }, `${e.target.value} km/h`)}>
            {velocidades.map((x) => <option key={x} value={x}>{x} km/h</option>)}
          </select>
        </label>
        <label>
          <span>Carriles por sentido</span>
          <select value={via.carrilesPorSentido} onChange={(e) => cambiar({ carrilesPorSentido: Number(e.target.value) }, `${e.target.value} carril(es) por sentido`)}>
            {[1, 2, 3].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>

      {via.osmId && (
        <a href={`https://www.openstreetmap.org/way/${via.osmId}`} target="_blank" rel="noreferrer">Ver en OpenStreetMap</a>
      )}
    </section>
  );
}
```

`src/ui/paneles/FichaCruce.jsx`:

```jsx
import { CONTROLES, ETIQUETA_CONTROL } from '../../sim/tipos.js';

// Vías que llegan a este cruce, para marcar en cuáles hay pare.
function viasQueLlegan(red, nodoId) {
  const ids = new Set((red.entrantes.get(nodoId) ?? []).map((arcoId) => red.arcos.get(arcoId).viaId));
  return [...ids].map((id) => red.vias.get(id));
}

export default function FichaCruce({ nodo, red, onCambio, onCerrar }) {
  const llegan = viasQueLlegan(red, nodo.id);
  const conPare = new Set(nodo.accesosConPare ?? []);
  const fijar = (control, accesosConPare) => onCambio(
    { tipo: 'cruce', nodoId: nodo.id, control, ...(accesosConPare?.length && { accesosConPare }) },
    `Cruce: ${ETIQUETA_CONTROL[control].toLowerCase()}`,
  );
  const alternarPare = (viaId) => {
    const lista = conPare.has(viaId) ? [...conPare].filter((x) => x !== viaId) : [...conPare, viaId];
    fijar('pare', lista);
  };

  return (
    <section className="panel ficha">
      <header>
        <div>
          <h2>Cruce</h2>
          <p className="subtitulo">{llegan.length} vía(s) llegan aquí</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar ficha">×</button>
      </header>
      <fieldset className="campos">
        <legend>Control</legend>
        {CONTROLES.map((c) => (
          <label key={c} className="opcion">
            <input type="radio" name="control" checked={nodo.control === c} onChange={() => fijar(c)} />
            {ETIQUETA_CONTROL[c]}
          </label>
        ))}
      </fieldset>
      {nodo.control === 'pare' && (
        <fieldset className="campos">
          <legend>¿Quién tiene el pare?</legend>
          {llegan.map((v) => (
            <label key={v.id} className="opcion">
              <input type="checkbox" checked={conPare.has(v.id)} onChange={() => alternarPare(v.id)} />
              {v.nombrePuente ?? (v.nombre || '(vía sin nombre)')}
            </label>
          ))}
          <p className="nota">Sin ninguna marcada, el pare es para las vías de menor jerarquía.</p>
        </fieldset>
      )}
      {nodo.control === 'semaforo' && <p className="nota">Ciclo fijo: 25 s de verde por grupo y 4 s de todo rojo.</p>}
    </section>
  );
}
```

`src/ui/paneles/PanelObras.jsx`:

```jsx
export default function PanelObras({
  datos, variante, restriccion, onRestriccion, onCambio, onIniciarDibujo,
  historial, puedeDeshacer, puedeRehacer, onDeshacer, onRehacer, onDescartar,
}) {
  const todas = (tipo) => {
    const vias = datos.vias.filter((v) => v.tipo === tipo);
    return vias.length > 0 && vias.every((v) => v.dobleCalzada);
  };
  const dobleCalzada = (alcance, nombre) => (e) => onCambio(
    { tipo: 'dobleCalzada', alcance, activa: e.target.checked },
    `Doble calzada en ${nombre}: ${e.target.checked ? 'sí' : 'no'}`,
  );
  const recientes = historial.entradas.slice(0, historial.indice).slice(-6).reverse();

  return (
    <section className="panel obras">
      <h2>Obras y cambios</h2>
      <div className="acciones">
        <button type="button" onClick={() => onIniciarDibujo('calle')}>＋ Vía o puente nuevo</button>
        <button type="button" onClick={() => onIniciarDibujo('variante')}>Trazar tramo de la Variante</button>
      </div>
      <button
        type="button"
        className="principal ancho"
        disabled={variante.enObra.length === 0}
        onClick={() => {
          onCambio({ tipo: 'terminarObra', viaIds: variante.enObra }, 'Variante terminada');
          onRestriccion(true);
        }}
      >
        Terminar la Variante
      </button>
      <p className={variante.conecta ? 'nota' : 'aviso'}>{variante.mensaje}</p>

      <label className="opcion">
        <input type="checkbox" checked={restriccion} onChange={(e) => onRestriccion(e.target.checked)} />
        Restringir pesados de paso en el centro
      </label>
      <label className="opcion">
        <input type="checkbox" checked={todas('avenida_nacional')} onChange={dobleCalzada('avenida_nacional', 'la Avenida')} />
        Doble calzada en la Avenida Nacional
      </label>
      <label className="opcion">
        <input type="checkbox" checked={todas('variante')} onChange={dobleCalzada('variante', 'la Variante')} />
        Doble calzada en la Variante
      </label>

      <h3>Cambios ({historial.indice})</h3>
      <div className="acciones">
        <button type="button" disabled={!puedeDeshacer} onClick={onDeshacer} title="Ctrl+Z">↶ Deshacer</button>
        <button type="button" disabled={!puedeRehacer} onClick={onRehacer} title="Ctrl+Y">↷ Rehacer</button>
        <button type="button" disabled={historial.entradas.length === 0} onClick={onDescartar}>Descartar todo</button>
      </div>
      {recientes.length > 0 && (
        <ol className="historial">
          {recientes.map((e, i) => <li key={`${historial.indice - i}`}>{e.descripcion}</li>)}
        </ol>
      )}
      <p className="nota">Clic en una vía o en un cruce para editarlo.</p>
    </section>
  );
}
```

`src/ui/paneles/PanelDibujo.jsx`:

```jsx
import { cruzaRio } from '../edicion/dibujo.js';

const QUE_ES = { nodo: 'un cruce existente', via: 'la mitad de una vía (se parte en dos)', libre: 'un punto suelto' };

export default function PanelDibujo({ dibujo, rios, onAtributos, onQuitarUltimo, onTerminar, onCancelar }) {
  const { puntos, atributos } = dibujo;
  const esPuente = cruzaRio(dibujo, rios);
  return (
    <section className="panel dibujo">
      <h2>{dibujo.preset === 'variante' ? 'Tramo de la Variante' : 'Vía o puente nuevo'}</h2>
      <p className="nota">
        Haz clic en el mapa para marcar el trazado. El primer y el último punto se pegan al cruce o a la vía más cercana.
      </p>
      <p>
        {puntos.length} punto(s)
        {puntos.length > 0 && <> · empieza en {QUE_ES[puntos[0].ajuste.tipo]}</>}
        {puntos.length > 1 && <> · termina en {QUE_ES[puntos.at(-1).ajuste.tipo]}</>}
      </p>
      {esPuente && <p className="aviso">Cruza el río: será un puente.</p>}
      <div className="campos">
        <label>
          <span>Nombre</span>
          <input type="text" value={atributos.nombre} onChange={(e) => onAtributos({ nombre: e.target.value })} />
        </label>
        <label>
          <span>Sentido</span>
          <select value={atributos.sentido} onChange={(e) => onAtributos({ sentido: e.target.value })}>
            <option value="ambos">Doble sentido</option>
            <option value="adelante">Un sentido (del primer al último punto)</option>
          </select>
        </label>
        <label>
          <span>Velocidad máxima</span>
          <select value={atributos.velocidadMax} onChange={(e) => onAtributos({ velocidadMax: Number(e.target.value) })}>
            {[20, 30, 40, 50, 60, 80].map((x) => <option key={x} value={x}>{x} km/h</option>)}
          </select>
        </label>
        <label>
          <span>Carriles por sentido</span>
          <select value={atributos.carrilesPorSentido} onChange={(e) => onAtributos({ carrilesPorSentido: Number(e.target.value) })}>
            {[1, 2].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <div className="acciones">
        <button type="button" className="principal" disabled={puntos.length < 2} onClick={onTerminar}>Crear vía</button>
        <button type="button" disabled={puntos.length === 0} onClick={onQuitarUltimo}>Quitar último punto</button>
        <button type="button" onClick={onCancelar}>Cancelar (Esc)</button>
      </div>
    </section>
  );
}
```

`src/ui/paneles/Leyenda.jsx` (reemplazo completo):

```jsx
import { TIPOS_VIA, ETIQUETA_TIPO } from '../../sim/tipos.js';
import { TIPOS_VEHICULO, ETIQUETA_VEHICULO } from '../../sim/vehiculos.js';
import {
  COLOR_TIPO, COLOR_PUENTE, COLOR_PARE, COLOR_CERRADA, COLOR_SEMAFORO,
} from '../mapa/estilosVia.js';
import { COLOR_VEHICULO, ESCALA_CONGESTION } from '../mapa/estilosVehiculo.js';

const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

export default function Leyenda({ colorPor }) {
  return (
    <section className="panel leyenda">
      <h2>{colorPor === 'congestion' ? 'Congestión' : 'Tipos de vía'}</h2>
      <ul>
        {colorPor === 'congestion'
          ? ESCALA_CONGESTION.map(({ etiqueta, color }) => (
            <li key={etiqueta}><span className="muestra-linea" style={{ background: rgb(color) }} />{etiqueta}</li>
          ))
          : TIPOS_VIA.map((tipo) => (
            <li key={tipo}><span className="muestra-linea" style={{ background: rgb(COLOR_TIPO[tipo]) }} />{ETIQUETA_TIPO[tipo]}</li>
          ))}
        <li><span className="muestra-linea doble" />Doble calzada</li>
        <li><span className="muestra-linea" style={{ background: rgb(COLOR_PUENTE) }} />Puente</li>
        <li><span className="muestra-linea punteada" />En construcción</li>
        <li><span className="muestra-linea punteada gris" style={{ '--color': rgb(COLOR_CERRADA) }} />Cerrada</li>
        <li><span className="muestra-punto" style={{ background: rgb(COLOR_PARE) }} />Pare</li>
        <li><span className="muestra-punto" style={{ background: rgb(COLOR_SEMAFORO) }} />Semáforo</li>
        <li><span className="muestra-flecha">▶</span>Sentido de circulación</li>
      </ul>
      <h3>Vehículos</h3>
      <ul>
        {TIPOS_VEHICULO.map((tipo) => (
          <li key={tipo}><span className="muestra-punto" style={{ background: rgb(COLOR_VEHICULO[tipo]) }} />{ETIQUETA_VEHICULO[tipo]}</li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Reemplazar `src/ui/mapa/MapaSanGil.jsx`**

```jsx
import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { PathLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  colorVia, anchoVia, flechasDeVias, COLOR_PUENTE, COLOR_PARE, COLOR_SELECCION,
  COLOR_CERRADA, COLOR_SEMAFORO, COLOR_CRUCE, COLOR_DIBUJO, COLOR_AJUSTE,
} from './estilosVia.js';
import { COLOR_POR_INDICE, RADIO_POR_INDICE, colorCongestion } from './estilosVehiculo.js';
import { circulo } from './geometriaUi.js';
import { lineaDelDibujo } from '../edicion/dibujo.js';

const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron';
const VISTA_INICIAL = { longitude: -73.134, latitude: 6.555, zoom: 14.5, pitch: 0, bearing: 0 };
const PUNTEADO = new PathStyleExtension({ dash: true });

export default function MapaSanGil({
  red, vehiculos, colorPor, congestion, seleccion, onSeleccionar, modo, dibujo, onClicMapa, casco,
}) {
  const vias = useMemo(() => [...red.vias.values()], [red]);
  const puentes = useMemo(() => vias.filter((v) => v.esPuente), [vias]);
  const doblesCalzadas = useMemo(() => vias.filter((v) => v.dobleCalzada), [vias]);
  const flechas = useMemo(() => flechasDeVias(vias.filter((v) => v.abierta)), [vias]);
  const etiquetasPuentes = useMemo(
    () => puentes
      .filter((v) => v.nombrePuente || v.nueva)
      .map((v) => ({
        texto: (v.nombrePuente ?? v.nombre).replace(/\s*\(.*\)$/, ''),
        posicion: v.geometria[Math.floor(v.geometria.length / 2)],
      })),
    [puentes],
  );
  const cruces = useMemo(() => {
    const grado = new Map();
    for (const v of vias) for (const n of [v.desde, v.hasta]) grado.set(n, (grado.get(n) ?? 0) + 1);
    return [...red.nodos.values()].filter((n) => grado.get(n.id) >= 3 || n.control !== 'sin_senal');
  }, [red, vias]);
  const pares = useMemo(() => cruces.filter((n) => n.control === 'pare'), [cruces]);
  const semaforos = useMemo(() => cruces.filter((n) => n.control === 'semaforo'), [cruces]);
  const anilloCasco = useMemo(() => (casco ? [{ path: circulo(casco.lon, casco.lat, casco.radio) }] : []), [casco]);

  const seleccionada = (tipo, id) => seleccion?.tipo === tipo && seleccion.id === id;
  const colorDeVia = (v) => {
    if (seleccionada('via', v.id)) return COLOR_SELECCION;
    if (!v.abierta) return COLOR_CERRADA;
    return colorPor === 'congestion' ? colorCongestion(congestion.get(v.id)) : colorVia(v);
  };

  const { cantidad, datos } = vehiculos;
  const lineaDibujo = dibujo && dibujo.puntos.length ? lineaDelDibujo(dibujo) : [];

  const capas = [
    new PathLayer({
      id: 'casco', data: anilloCasco, getPath: (d) => d.path, getColor: [120, 120, 120, 160],
      getWidth: 2, widthUnits: 'pixels', getDashArray: [6, 4], extensions: [PUNTEADO],
    }),
    new PathLayer({
      id: 'puentes', data: puentes, getPath: (v) => v.geometria, getColor: COLOR_PUENTE,
      getWidth: (v) => anchoVia(v) + 6, widthUnits: 'pixels', capRounded: true,
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
      pickable: modo !== 'dibujar',
      getDashArray: (v) => (v.enConstruccion || !v.abierta ? [4, 3] : [0, 0]),
      dashJustified: true,
      extensions: [PUNTEADO],
      updateTriggers: { getColor: [seleccion, colorPor, congestion] },
    }),
    new PathLayer({
      id: 'doble-calzada', data: doblesCalzadas, getPath: (v) => v.geometria,
      getColor: [255, 255, 255], getWidth: 1.5, widthUnits: 'pixels',
    }),
    new TextLayer({
      id: 'flechas', data: flechas, getPosition: (f) => f.posicion, getText: () => '▶', getAngle: (f) => f.angulo,
      getSize: 16, getColor: [30, 40, 50], fontFamily: 'Arial, sans-serif', characterSet: ['▶'],
      outlineWidth: 2, outlineColor: [255, 255, 255], fontSettings: { sdf: true },
    }),
    new ScatterplotLayer({
      id: 'cruces', data: cruces, getPosition: (n) => [n.lon, n.lat],
      getRadius: (n) => (seleccionada('cruce', n.id) ? 7 : 3.5), radiusUnits: 'meters', radiusMinPixels: 0, radiusMaxPixels: 8,
      getFillColor: (n) => (seleccionada('cruce', n.id) ? COLOR_SELECCION : COLOR_CRUCE),
      pickable: modo !== 'dibujar',
      updateTriggers: { getRadius: seleccion, getFillColor: seleccion },
    }),
    new ScatterplotLayer({
      id: 'vehiculos',
      data: { length: cantidad },
      getPosition: (_, { index }) => [datos[index * 3], datos[index * 3 + 1]],
      getFillColor: (_, { index }) => COLOR_POR_INDICE[datos[index * 3 + 2]],
      getRadius: (_, { index }) => RADIO_POR_INDICE[datos[index * 3 + 2]],
      radiusUnits: 'meters', radiusMinPixels: 3, radiusMaxPixels: 9,
      stroked: true, getLineColor: [255, 255, 255], lineWidthMinPixels: 0.5,
      updateTriggers: { getPosition: datos, getFillColor: datos, getRadius: datos },
    }),
    new TextLayer({
      id: 'nombres-puentes', data: etiquetasPuentes, getPosition: (e) => e.posicion, getText: (e) => e.texto,
      getSize: 12, getColor: [60, 45, 0], getPixelOffset: [0, -16],
      fontFamily: 'system-ui, Segoe UI, Arial, sans-serif', fontWeight: 600, fontSettings: { sdf: true },
      outlineWidth: 3, outlineColor: [255, 255, 255], characterSet: 'auto',
    }),
    new ScatterplotLayer({
      id: 'pares', data: pares, getPosition: (n) => [n.lon, n.lat], getRadius: 5, radiusUnits: 'pixels',
      getFillColor: COLOR_PARE, getLineColor: [255, 255, 255], stroked: true, lineWidthMinPixels: 1.5,
    }),
    new ScatterplotLayer({
      id: 'semaforos', data: semaforos, getPosition: (n) => [n.lon, n.lat], getRadius: 6, radiusUnits: 'pixels',
      getFillColor: COLOR_SEMAFORO, getLineColor: [20, 20, 20], stroked: true, lineWidthMinPixels: 2,
    }),
    new PathLayer({
      id: 'dibujo', data: lineaDibujo.length > 1 ? [{ path: lineaDibujo }] : [], getPath: (d) => d.path,
      getColor: COLOR_DIBUJO, getWidth: 5, widthUnits: 'pixels', getDashArray: [3, 2], extensions: [PUNTEADO],
    }),
    new ScatterplotLayer({
      id: 'puntos-dibujo',
      data: dibujo ? dibujo.puntos.map((p, i, todos) => ({ posicion: lineaDibujo[i], tipo: i === 0 || i === todos.length - 1 ? p.ajuste.tipo : 'libre' })) : [],
      getPosition: (p) => p.posicion, getRadius: 6, radiusUnits: 'pixels',
      getFillColor: (p) => COLOR_AJUSTE[p.tipo], getLineColor: [255, 255, 255], stroked: true, lineWidthMinPixels: 2,
    }),
  ];

  const alHacerClic = (info) => {
    if (modo === 'dibujar') {
      if (info.coordinate) onClicMapa(info.coordinate);
      return;
    }
    if (info.layer?.id === 'vias') onSeleccionar({ tipo: 'via', id: info.object.id });
    else if (info.layer?.id === 'cruces') onSeleccionar({ tipo: 'cruce', id: info.object.id });
    else onSeleccionar(null);
  };

  return (
    <DeckGL
      initialViewState={VISTA_INICIAL}
      controller={{ doubleClickZoom: modo !== 'dibujar' }}
      layers={capas}
      onClick={alHacerClic}
      getCursor={({ isHovering }) => {
        if (modo === 'dibujar') return 'crosshair';
        return isHovering ? 'pointer' : 'grab';
      }}
    >
      <Map mapStyle={ESTILO_MAPA} />
    </DeckGL>
  );
}
```

- [ ] **Step 4: Reemplazar `src/ui/App.jsx`**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarDatosRed } from './datos/cargarRed.js';
import { cargarRios } from './datos/cargarRios.js';
import { crearRed } from '../sim/red.js';
import { prepararGeometria } from '../sim/geometriaArcos.js';
import { arcosEnCasco, rodeaElCasco } from '../sim/restriccion.js';
import { aplicarCambio } from '../escenarios/cambios.js';
import { CASCO_URBANO, SALIDAS } from '../escenarios/zonas.js';
import { crearClienteSimulacion } from '../worker/clienteSimulacion.js';
import { useEdicion } from './edicion/useEdicion.js';
import {
  crearDibujo, agregarPunto, quitarUltimo, cambiarAtributos, cambioDeDibujo, siguienteIdVia,
} from './edicion/dibujo.js';
import MapaSanGil from './mapa/MapaSanGil.jsx';
import Leyenda from './paneles/Leyenda.jsx';
import FichaVia from './paneles/FichaVia.jsx';
import FichaCruce from './paneles/FichaCruce.jsx';
import BarraTiempo from './paneles/BarraTiempo.jsx';
import PanelTrafico from './paneles/PanelTrafico.jsx';
import PanelMetricas from './paneles/PanelMetricas.jsx';
import PanelObras from './paneles/PanelObras.jsx';
import PanelDibujo from './paneles/PanelDibujo.jsx';
import Confirmacion from './paneles/Confirmacion.jsx';
import './estilos.css';

const CONFIG_INICIAL = { factor: 1, temporada: 1, horaInicio: 7 };
const SIN_VEHICULOS = { cantidad: 0, datos: new Float64Array(0), t: 0 };

function conectaAlrededor(datos) {
  const red = crearRed(datos);
  const casco = arcosEnCasco(red, prepararGeometria(red), CASCO_URBANO);
  return rodeaElCasco(red, casco, SALIDAS.socorro.nodo, SALIDAS.bucaramanga.nodo);
}

function estadoDeLaVariante(datos) {
  const enObra = datos.vias.filter((v) => v.tipo === 'variante' && v.enConstruccion).map((v) => v.id);
  if (conectaAlrededor(datos)) {
    return { enObra, conecta: true, mensaje: 'La Variante rodea el centro: con la restricción activa, los pesados de paso la usan.' };
  }
  if (enObra.length && conectaAlrededor(aplicarCambio(datos, { tipo: 'terminarObra', viaIds: enObra }))) {
    return { enObra, conecta: false, mensaje: 'La Variante ya conecta Socorro con Bucaramanga: falta terminar la obra.' };
  }
  return {
    enObra,
    conecta: false,
    mensaje: 'La Variante todavía no conecta Socorro con Bucaramanga: traza los tramos que faltan hasta la Avenida.',
  };
}

const escribiendo = () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);

export default function App() {
  const [base, setBase] = useState(null);
  const [rios, setRios] = useState([]);
  const [error, setError] = useState(null);
  const edicion = useEdicion(base);
  const { datos } = edicion;
  const [seleccion, setSeleccion] = useState(null);
  const [modo, setModo] = useState('ver');
  const [dibujo, setDibujo] = useState(null);
  const [vehiculos, setVehiculos] = useState(SIN_VEHICULOS);
  const [resumen, setResumen] = useState(null);
  const [congestion, setCongestion] = useState(() => new Map());
  const [corriendo, setCorriendo] = useState(false);
  const [velocidad, setVelocidad] = useState(5);
  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [colorPor, setColorPor] = useState('tipo');
  const [restriccion, setRestriccion] = useState(false);
  const [reinicios, setReinicios] = useState(0);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const cliente = useRef(null);
  const datosEnviados = useRef(null);

  const red = useMemo(() => (datos ? crearRed(datos) : null), [datos]);
  const variante = useMemo(() => (datos ? estadoDeLaVariante(datos) : null), [datos]);

  useEffect(() => {
    cargarDatosRed().then(setBase).catch((err) => setError(err.message));
    cargarRios().then(setRios);
  }, []);

  // Crea el worker cuando la red está lista y en cada reinicio.
  const listo = Boolean(datos);
  useEffect(() => {
    if (!listo) return undefined;
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
    c.iniciar(datos, { semilla: 1, demanda: config, restriccionPesados: restriccion });
    datosEnviados.current = datos;
    cliente.current = c;
    setCorriendo(false);
    setVehiculos(SIN_VEHICULOS);
    return () => c.terminar();
  }, [listo, reinicios]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cada edición se aplica en vivo sobre la simulación en curso.
  useEffect(() => {
    if (!datos || !cliente.current || datos === datosEnviados.current) return;
    cliente.current.red(datos);
    datosEnviados.current = datos;
  }, [datos]);

  useEffect(() => { cliente.current?.reloj(corriendo, velocidad); }, [corriendo, velocidad, reinicios]);
  useEffect(() => { cliente.current?.restriccion(restriccion); }, [restriccion]);

  const iniciarDibujo = (preset) => { setDibujo(crearDibujo(preset)); setModo('dibujar'); setSeleccion(null); };
  const cancelarDibujo = () => { setDibujo(null); setModo('ver'); };
  const terminarDibujo = () => {
    try {
      const cambio = cambioDeDibujo(dibujo, siguienteIdVia(datos), rios);
      const prefijo = cambio.atributos.esPuente ? 'Puente nuevo' : 'Vía nueva';
      edicion.aplicar(cambio, `${prefijo}: ${cambio.atributos.nombre}`);
      cancelarDibujo();
    } catch (err) {
      edicion.mostrarError(err.message);
    }
  };

  useEffect(() => {
    const alPresionar = (e) => {
      if (escribiendo()) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); edicion.deshacer(); }
      else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); edicion.rehacer(); }
      else if (e.key === 'Escape') { if (modo === 'dibujar') cancelarDibujo(); else setSeleccion(null); }
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  });

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

  const via = seleccion?.tipo === 'via' ? red.vias.get(seleccion.id) : null;
  const nodo = seleccion?.tipo === 'cruce' ? red.nodos.get(seleccion.id) : null;

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
          seleccion={seleccion}
          onSeleccionar={setSeleccion}
          modo={modo}
          dibujo={dibujo}
          onClicMapa={(coordenada) => setDibujo((d) => agregarPunto(d, red, coordenada))}
          casco={restriccion ? CASCO_URBANO : null}
        />
        <aside className="lateral lateral-izq">
          {modo === 'dibujar' ? (
            <PanelDibujo
              dibujo={dibujo}
              rios={rios}
              onAtributos={(parcial) => setDibujo((d) => cambiarAtributos(d, parcial))}
              onQuitarUltimo={() => setDibujo(quitarUltimo)}
              onTerminar={terminarDibujo}
              onCancelar={cancelarDibujo}
            />
          ) : (
            <PanelObras
              datos={datos}
              variante={variante}
              restriccion={restriccion}
              onRestriccion={setRestriccion}
              onCambio={edicion.aplicar}
              onIniciarDibujo={iniciarDibujo}
              historial={edicion.historial}
              puedeDeshacer={edicion.puedeDeshacer}
              puedeRehacer={edicion.puedeRehacer}
              onDeshacer={edicion.deshacer}
              onRehacer={edicion.rehacer}
              onDescartar={() => setConfirmarDescartar(true)}
            />
          )}
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
          {edicion.error && (
            <section className="panel aviso-error">
              <p>{edicion.error}</p>
              <button type="button" onClick={edicion.limpiarError}>Entendido</button>
            </section>
          )}
          {via && <FichaVia via={via} onCambio={edicion.aplicar} onCerrar={() => setSeleccion(null)} />}
          {nodo && <FichaCruce nodo={nodo} red={red} onCambio={edicion.aplicar} onCerrar={() => setSeleccion(null)} />}
          <PanelMetricas resumen={resumen} onSeleccionarVia={(id) => setSeleccion({ tipo: 'via', id })} />
        </aside>
        <footer className="atribucion">{red.meta.fuente}</footer>
      </div>

      {edicion.pendiente && (
        <Confirmacion titulo="Este cambio desconecta parte de la red" onConfirmar={edicion.confirmar} onCancelar={edicion.cancelar}>
          {edicion.pendiente.impacto.aisladas.length > 0 && (
            <p>Quedarían sin ida y vuelta: <strong>{edicion.pendiente.impacto.aisladas.join(', ')}</strong>.</p>
          )}
          <p>{edicion.pendiente.impacto.perdidos} cruces quedarían sin conexión de ida y vuelta con el resto.</p>
          <p className="nota">Los viajes que no tengan ruta se contarán como imposibles.</p>
        </Confirmacion>
      )}
      {confirmarDescartar && (
        <Confirmacion
          titulo="¿Descartar todos los cambios?"
          textoConfirmar="Descartar"
          onConfirmar={() => { edicion.descartarTodo(); setConfirmarDescartar(false); setSeleccion(null); }}
          onCancelar={() => setConfirmarDescartar(false)}
        >
          <p>Se vuelve a la red de OpenStreetMap con las correcciones de campo. Esto no se puede deshacer.</p>
        </Confirmacion>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Agregar estilos al final de `src/ui/estilos.css`**

```css
/* --- Etapa 3: editor --- */

.acciones { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
button:disabled { opacity: 0.45; cursor: not-allowed; }
button.ancho { width: 100%; }

.campos { display: grid; gap: 8px; margin: 8px 0; border: none; padding: 0; }
.campos label { display: grid; gap: 3px; font-size: 13px; }
.campos label > span { color: var(--tenue); }
.campos select, .campos input[type='text'] { font: inherit; font-size: 13px; padding: 4px 6px; }
.campos legend { font-size: 13px; color: var(--tenue); margin-bottom: 4px; }
.opcion { display: flex; align-items: center; gap: 6px; font-size: 13px; margin: 4px 0; }

.obras .historial { margin: 6px 0 0; padding-left: 18px; font-size: 12px; color: var(--tenue); display: grid; gap: 2px; }
.dibujo p { font-size: 13px; margin: 6px 0; }

.aviso-error { border-color: #e6a6a1; background: #fdf1f0; }
.aviso-error p { margin: 0 0 8px; font-size: 13px; color: #a93226; }

.muestra-linea.doble { background: linear-gradient(#5d6d7e 0 35%, #fff 35% 65%, #5d6d7e 65%); height: 7px; }
.muestra-linea.punteada.gris {
  background: repeating-linear-gradient(90deg, var(--color) 0 6px, transparent 6px 10px);
}

.modal-fondo {
  position: fixed; inset: 0; z-index: 10; background: rgb(0 0 0 / 0.35);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.modal {
  background: var(--panel); border-radius: 10px; padding: 18px 20px; max-width: 440px; width: 100%;
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.25);
}
.modal h2 { margin: 0 0 8px; font-size: 17px; }
.modal-cuerpo { font-size: 14px; }
.modal .acciones { justify-content: flex-end; margin-top: 14px; }
```

- [ ] **Step 6: Verificar en el navegador**

Run: `npm run dev` y abrir la dirección que muestra la terminal. Dar ▶ Simular a ×5.

- [ ] Clic en una vía abre su ficha editable; "Cerrar vía" la pinta gris punteada y los vehículos dejan de entrar; las colas se mueven a otras vías al cabo de unos segundos.
- [ ] Cerrar el Rojas Pinilla: aparece la cola en la Calle 15 y sube la demora media en el panel de métricas.
- [ ] Cambiar una calle de un sentido a doble: las flechas desaparecen. "⇄ Invertir sentido" voltea las flechas.
- [ ] Cambiar el estado a "Con huecos" y la velocidad: el cambio queda en la lista "Cambios".
- [ ] Clic en un cruce (punto gris) abre su ficha: poner "Semáforo" muestra el punto verde; poner "Pare" y marcar una vía muestra el punto rojo.
- [ ] Deshacer y Rehacer (botones y Ctrl+Z / Ctrl+Y) devuelven y reaplican los cambios en el mapa y en la simulación.
- [ ] "＋ Vía o puente nuevo": marcar un punto junto a un cruce, otro al otro lado del Fonce y otro junto a una vía. El panel avisa "Cruza el río: será un puente" y "Crear vía" agrega la vía con su nombre sobre el puente. Los vehículos la empiezan a usar.
- [ ] "Trazar tramo de la Variante": dibujar desde un extremo de la Variante hasta la Avenida; queda punteado (en obra). El mensaje del panel indica si ya conecta.
- [ ] "Terminar la Variante": los tramos dejan de ser punteados, se activa "Restringir pesados" y aparece el círculo del casco urbano. Si la Variante conecta, los camiones dejan de cruzar el centro.
- [ ] Doble calzada en la Avenida: la Avenida se ve más ancha con línea blanca central.
- [ ] Cerrar la única vía de una salida pide confirmación antes de aplicarse; "Cancelar" no cambia nada.
- [ ] Recargar la página conserva los cambios; "Descartar todo" vuelve a la red original.
- [ ] La consola del navegador no muestra errores; a 375 px de ancho no hay barra de desplazamiento horizontal.

- [ ] **Step 7: Verificar tests y build**

Run: `npm test && npm run build`
Expected: todos los tests en PASS y `✓ built in ...`.

- [ ] **Step 8: Commit**

```bash
git add src/ui
git commit -m "feat(ui): editor de vías, cruces, obras y vías nuevas con deshacer"
```

---

### Task 12: Cierre de la etapa

**Files:**
- Modify: `README.md`, `.claude/contexto/estado.md`, `.claude/contexto/bitacora.md`, `.claude/contexto/decisiones.md`

- [ ] **Step 1: Actualizar `README.md`**

Agregar al final de la sección "Usar el simulador":

```markdown
### Editar la red

- **Clic en una vía**: cerrarla o abrirla, cambiar sentido, estado, superficie, velocidad y carriles.
- **Clic en un cruce** (punto gris): pare, prioridad, sin señal o semáforo.
- **＋ Vía o puente nuevo**: marca el trazado en el mapa. Si cruza el río, queda como puente.
- **Variante**: traza los tramos que faltan hasta la Avenida y dale "Terminar la Variante".
  Con la restricción activa, los pesados de paso dejan de cruzar el centro.
- **Deshacer / Rehacer** con los botones o Ctrl+Z / Ctrl+Y. Los cambios se guardan en el navegador.
```

- [ ] **Step 2: Actualizar el contexto**

En `.claude/contexto/estado.md`: etapa actual "3 de 5 terminada — sigue la etapa 4 (escenarios, comparador, modo historia)"; plan activo "ninguno; falta escribir el de la etapa 4"; en "Hecho" agregar la etapa 3; en "Sigue": "Escribir el plan de la etapa 4"; en "Bloqueos / pendientes del usuario": "Trazar en el editor los tramos que faltan de la Variante (OSM solo trae 2 km con los extremos sueltos)".

En `.claude/contexto/decisiones.md` agregar:

```markdown
| 2026-10-08 | Las ediciones son cambios (datos) aplicados sobre la red base; historial con deshacer/rehacer autoguardado en el navegador | Se pueden reproducir, guardar como escenario (etapa 4) y deshacer |
| 2026-10-08 | Un cambio que aísla zonas o salidas, o más de 20 cruces, pide confirmación | Spec §8 |
| 2026-10-08 | Al editar en vivo, los vehículos en arcos que cambiaron se retiran y se cuentan | Evita vehículos en vías que ya no existen o van al revés |
| 2026-10-08 | La Variante de OSM no conecta: el usuario traza los tramos que faltan con la herramienta de vía nueva | OSM solo trae 2 km con extremos sueltos; no hay trazado georreferenciado confiable |
| 2026-10-08 | Restricción de pesados: flujos pesado y busPaso solo por Avenida/Variante fuera de un casco de 1,3 km; si no hay ruta, pasan por el centro | Spec §5; evita viajes imposibles mientras la Variante no conecte |
| 2026-10-08 | Doble calzada: 2 carriles por sentido en toda la Avenida o toda la Variante | Indicación del usuario |
```

En `.claude/contexto/bitacora.md` agregar una entrada con la fecha del día: "Etapa 3 completa: editor (vías, cruces, vías y puentes nuevos, Variante, restricción, doble calzada, deshacer) aplicado en vivo".

- [ ] **Step 3: Commit**

```bash
git add README.md .claude/contexto
git commit -m "docs: cierre de la etapa 3"
```
