# Etapa 4 · Escenarios, comparador y modo historia — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar, cargar, exportar e importar escenarios con nombre; compararlos con números defendibles (varias semillas, misma duración, promedio y rango, gráficas y mapa de diferencias); y presentar la demo en clase con un modo historia que aplica los cambios paso a paso sobre la simulación en curso.

**Architecture:** Un **escenario** es un dato: lista de cambios (las mismas entradas del historial del editor), configuración de demanda y restricción de pesados. Los escenarios precargados se construyen desde la red base (incluye un trazado aproximado de la Variante y un puente propuesto). El comparador corre los escenarios en **modo rápido** (el motor sin dibujar) dentro de un **segundo Web Worker**, para que la simulación en vivo no se detenga. El modo historia carga cada paso como un escenario en caliente, sin reiniciar la simulación.

**Tech Stack:** Node 24, Vite 5, React 18, deck.gl 9.0, Recharts 2, Vitest 2. JavaScript, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-08-simulador-trafico-sangil-design.md` (sección 7; también 5 "Métricas" y 13)

Etapa 4 de 5. Fuera de esta etapa: pestaña "Cómo funciona" y publicación en Vercel (etapa 5).

## Global Constraints

- JavaScript, **no TypeScript**.
- `src/sim/` y `src/escenarios/` no importan React ni APIs del navegador.
- El comparador usa **la misma duración y las mismas semillas** para todos los escenarios, y reporta **promedio y rango**.
- La simulación en vivo nunca se bloquea mientras el comparador trabaja (worker aparte).
- Sin costos en pesos.
- Textos de la interfaz en español de Colombia.
- Los datos que no vienen de OSM ni del usuario se marcan como **supuestos** en el código y en el contexto.

## Review Focus

1. Importar un archivo que no es un escenario, o un escenario de una red distinta (vías que no existen): mensaje claro y nada cambia (test en Task 3).
2. Comparar con un escenario cuyo resultado tiene 0 viajes completados (todo cerrado): el porcentaje de variación no da `NaN` ni `Infinity` (test en Task 5).
3. Los escenarios precargados se construyen aunque falte el archivo de ríos: sin puente propuesto, pero sin romper (test en Task 4).
4. Cancelar una comparación en curso y lanzar otra: el resultado viejo no llega tarde a pisar el nuevo (test en Task 6).
5. Cargar un escenario o avanzar en la historia con una hora de inicio distinta: la simulación no se reinicia en mitad de la historia (verificación manual en Task 8, lógica en `aplicarEscenarioEnVivo`).

---

## Contratos de esta etapa

**Escenario:**

```js
{
  version: 1,
  nombre: 'Temporada alta',
  descripcion: 'Demanda ×1,4 por turismo',
  entradas: [{ cambio, descripcion }],      // mismas entradas que el historial del editor
  demanda: { factor: 1, temporada: 1.4, horaInicio: 7 },
  restriccionPesados: false,
  precargado?: true,
}
```

**Archivo exportado:** el escenario en JSON con `tipo: 'escenario-mapa-sangil'`.

**Historia:** `{ nombre, pasos: [{ titulo, nota, escenario }] }`. Cada paso es un escenario completo (acumula los cambios de los pasos anteriores).

**Resultado del comparador:**

```js
{
  duracion, semillas,
  resultados: [{
    nombre,
    metricas: { [clave]: { media, min, max } },   // clave ∈ METRICAS_COMPARADAS
    serie: [{ t, demoraReciente, enRed }],         // promedio entre semillas, cada 60 s
    vias: { [viaId]: { ratio, uso } },             // promedio entre semillas
  }],
}
```

**Mensajes del worker comparador:** entrada `{ tipo: 'comparar', id, base, escenarios, opciones }`; salida `{ tipo: 'progreso', id, hechos, total }`, `{ tipo: 'resultado', id, resultado }`, `{ tipo: 'error', id, mensaje }`.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `scripts/datos/correccionesCampo.js`, `scripts/lib/correcciones.js` | Estado de vías según trabajo de campo |
| `src/sim/metricas.js`, `src/sim/motor.js` | Demora de los últimos 10 minutos |
| `src/escenarios/historial.js` | + `historialDesdeEntradas` |
| `src/escenarios/escenario.js` | Modelo, validación, exportar/importar, almacén |
| `src/escenarios/precargados.js` | Variante aproximada, puente propuesto, vías arregladas, escenarios e historias |
| `src/escenarios/comparar.js` | Correr y resumir escenarios en modo rápido |
| `src/worker/comparador.js`, `comparador.worker.js`, `clienteComparador.js` | Comparador en worker aparte |
| `src/ui/formato.js`, `src/ui/mapa/estilosVia.js`, `src/ui/descargar.js` | Formatos, colores de diferencia, descarga de archivos |
| `src/ui/edicion/useEdicion.js` | + `cargar(entradas)` |
| `src/ui/paneles/PanelEscenarios.jsx`, `PanelComparador.jsx`, `ResultadosComparacion.jsx`, `PanelHistoria.jsx`, `BarraHistoria.jsx`, `PanelMetricas.jsx`, `Leyenda.jsx` | Interfaz |
| `src/ui/mapa/MapaSanGil.jsx`, `src/ui/App.jsx` | Conexión |

---

### Task 1: Estado de las vías según trabajo de campo

**Files:**
- Modify: `scripts/lib/correcciones.js`, `scripts/datos/correccionesCampo.js`, `scripts/construir-red.js`
- Regenerate: `public/data/red-sangil.json`
- Test: `tests/scripts/correcciones.test.js`

**Interfaces:**
- Produces: `aplicarEstadosCampo(vias, reglas) → vias` (`scripts/lib/correcciones.js`); `ESTADOS_CAMPO: { nombres: string[], estado?, superficie?, nota }[]` (`scripts/datos/correccionesCampo.js`).

OSM casi no trae el estado de las vías (1 vía con huecos y 6 en estado regular en toda la red). Para que la historia "arreglamos vías con huecos" tenga efecto, el estado real va como dato de campo. Mientras llega la lista del usuario, la Carrera 1ª se marca destapada y con huecos: es un **supuesto** tomado de la base Python, cuyo README preguntaba si "la carrera 1ª pavimentada alcanza como vía alterna".

- [ ] **Step 1: Escribir el test**

Al final de `tests/scripts/correcciones.test.js`:

```js
import { aplicarEstadosCampo } from '../../scripts/lib/correcciones.js';

describe('aplicarEstadosCampo', () => {
  const vias = [
    { id: 'a', nombre: 'Carrera 1', estado: 'bueno', superficie: 'pavimento' },
    { id: 'b', nombre: 'Calle 12', estado: 'bueno', superficie: 'pavimento' },
  ];

  it('cambia estado y superficie de las vías nombradas, sin tocar las demás ni los datos originales', () => {
    const r = aplicarEstadosCampo(vias, [{ nombres: ['Carrera 1'], estado: 'huecos', superficie: 'destapado', nota: 'x' }]);
    expect(r[0]).toMatchObject({ estado: 'huecos', superficie: 'destapado' });
    expect(r[1]).toBe(vias[1]);
    expect(vias[0].estado).toBe('bueno');
  });

  it('una regla puede cambiar solo el estado', () => {
    const r = aplicarEstadosCampo(vias, [{ nombres: ['Calle 12'], estado: 'regular', nota: 'x' }]);
    expect(r[1]).toMatchObject({ estado: 'regular', superficie: 'pavimento' });
  });

  it('sin reglas devuelve las mismas vías', () => {
    expect(aplicarEstadosCampo(vias)).toEqual(vias);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/scripts/correcciones.test.js`
Expected: FAIL, `aplicarEstadosCampo` no existe.

- [ ] **Step 3: Implementar**

Al final de `scripts/lib/correcciones.js`:

```js
// Estado y superficie de las vías según trabajo de campo (OSM casi nunca los trae).
export function aplicarEstadosCampo(vias, reglas = []) {
  return vias.map((v) => {
    const regla = reglas.find((r) => r.nombres.includes(v.nombre));
    if (!regla) return v;
    return {
      ...v,
      ...(regla.estado && { estado: regla.estado }),
      ...(regla.superficie && { superficie: regla.superficie }),
    };
  });
}
```

Al final de `scripts/datos/correccionesCampo.js`:

```js
// Estado de las vías por nombre. Lo marcado "SUPUESTO" está por confirmar con el usuario.
export const ESTADOS_CAMPO = [
  {
    nombres: ['Carrera 1', 'Carrera 1A'],
    estado: 'huecos',
    superficie: 'destapado',
    nota: 'SUPUESTO: la base Python preguntaba si "la carrera 1ª pavimentada alcanza como vía alterna".',
  },
];
```

En `scripts/construir-red.js`:
- Reemplazar `import { VIAS_AGREGADAS } from './datos/correccionesCampo.js';` por `import { VIAS_AGREGADAS, ESTADOS_CAMPO } from './datos/correccionesCampo.js';`.
- Reemplazar `import { aplicarCorrecciones } from './lib/correcciones.js';` por `import { aplicarCorrecciones, aplicarEstadosCampo } from './lib/correcciones.js';`.
- Después de la línea `const resultado = osmARed(overpass, { nombresPuentes: NOMBRES_PUENTES });` agregar:

```js
  resultado.vias = aplicarEstadosCampo(resultado.vias, ESTADOS_CAMPO);
```

- [ ] **Step 4: Correr el test y regenerar la red**

Run: `npx vitest run tests/scripts/correcciones.test.js`
Expected: PASS.

Run: `npm run red` y luego `node -e "const r=require('./public/data/red-sangil.json');console.log(r.vias.filter(v=>v.estado==='huecos').length)"`
Expected: más de 10 vías con huecos.

Run: `npm test`
Expected: PASS (la prueba "cerrar el Rojas Pinilla empeora la demora" sigue en verde).

- [ ] **Step 5: Commit**

```bash
git add scripts tests/scripts public/data/red-sangil.json
git commit -m "feat(red): estado de vías por trabajo de campo (Carrera 1ª con huecos, supuesto)"
```

---

### Task 2: Demora de los últimos 10 minutos

**Files:**
- Modify: `src/sim/metricas.js`, `src/sim/motor.js`, `src/ui/paneles/PanelMetricas.jsx`
- Test: `tests/sim/metricas.test.js`, `tests/sim/motorCambios.test.js`

**Interfaces:**
- Produces: `metricas.viajeCompletado({ …, t })`; `metricas.resumen(tActual?)` incluye `demoraReciente` y `tiempoReciente` (promedio de los viajes terminados en los últimos `VENTANA_RECIENTE = 600` s; sin `tActual`, de todos). `motor.resumen()` los incluye. `PanelMetricas` muestra "Demora (últimos 10 min)" y "Retirados por cambios".

La demora media acumulada tarda en reflejar un cambio hecho en vivo; la de los últimos 10 minutos lo muestra pronto. Es la que usan el modo historia y las series del comparador.

- [ ] **Step 1: Escribir los tests**

En `tests/sim/metricas.test.js`, en el objeto esperado de "sin viajes todo es cero", agregar `demoraReciente: 0, tiempoReciente: 0,` después de `demoraTotalVh: 0,`. Al final del archivo:

```js
describe('crearMetricas · últimos 10 minutos', () => {
  it('solo cuenta los viajes terminados en la ventana', () => {
    const m = crearMetricas();
    m.viajeCompletado({ tipo: 'carro', duracion: 200, tiempoLibre: 100, t: 0 });
    m.viajeCompletado({ tipo: 'carro', duracion: 70, tiempoLibre: 60, t: 700 });
    const r = m.resumen(800);
    expect(r.demoraReciente).toBe(10);
    expect(r.tiempoReciente).toBe(70);
    expect(r.demoraMedia).toBe(55);
  });

  it('sin tiempo actual promedia todos los viajes', () => {
    const m = crearMetricas();
    m.viajeCompletado({ tipo: 'carro', duracion: 200, tiempoLibre: 100, t: 0 });
    m.viajeCompletado({ tipo: 'carro', duracion: 70, tiempoLibre: 60, t: 700 });
    expect(m.resumen().demoraReciente).toBe(55);
  });
});
```

Al final de `tests/sim/motorCambios.test.js`:

```js
describe('motor · demora reciente', () => {
  it('el resumen trae la demora de los últimos 10 minutos', () => {
    const motor = sinDemanda(crearRed(datosRedLinea()));
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(200);
    const r = motor.resumen();
    expect(r.viajesCompletados).toBe(1);
    expect(r.demoraReciente).toBeCloseTo(r.demoraMedia, 6);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/sim/metricas.test.js tests/sim/motorCambios.test.js`
Expected: FAIL: `demoraReciente` no existe en el resumen.

- [ ] **Step 3: Implementar**

En `src/sim/metricas.js`:
- Después de `const MAXIMO_MUESTRAS = 7200; …` agregar `export const VENTANA_RECIENTE = 600; // s`.
- Después de `const serie = [];` agregar `const recientes = []; // { t, duracion, demora }`.
- Reemplazar el método `viajeCompletado` completo por:

```js
    viajeCompletado({ tipo, duracion, tiempoLibre, t = 0 }) {
      const demora = Math.max(0, duracion - tiempoLibre);
      completados += 1;
      sumaDuracion += duracion;
      sumaDemora += demora;
      porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
      recientes.push({ t, duracion, demora });
    },
```

- Reemplazar `resumen() {` por `resumen(tActual) {` y, como primeras líneas del método:

```js
      if (Number.isFinite(tActual)) {
        while (recientes.length && recientes[0].t < tActual - VENTANA_RECIENTE) recientes.shift();
      }
      const n = recientes.length;
      const promedio = (campo) => (n ? recientes.reduce((s, x) => s + x[campo], 0) / n : 0);
```

- En el objeto que devuelve `resumen`, después de `demoraTotalVh: sumaDemora / 3600,` agregar:

```js
        demoraReciente: promedio('demora'),
        tiempoReciente: promedio('duracion'),
```

En `src/sim/motor.js`:
- Reemplazar `metricas.viajeCompletado({ tipo: veh.tipo, duracion: instante - veh.tSalida, tiempoLibre: veh.tiempoLibre });` por `metricas.viajeCompletado({ tipo: veh.tipo, duracion: instante - veh.tSalida, tiempoLibre: veh.tiempoLibre, t: instante });`.
- En `resumen()`, reemplazar `...metricas.resumen(),` por `...metricas.resumen(t),`.

En `src/ui/paneles/PanelMetricas.jsx`, reemplazar el arreglo `filas` por:

```jsx
  const filas = [
    ['Vehículos en la vía', resumen.enRed],
    ['Detenidos o en cola', resumen.enCola],
    ['Esperando para entrar', resumen.pendientes],
    ['Viajes completados', resumen.viajesCompletados],
    ['Tiempo medio de viaje', formatearDuracion(resumen.tiempoMedio)],
    ['Demora media', formatearDuracion(resumen.demoraMedia)],
    ['Demora (últimos 10 min)', formatearDuracion(resumen.demoraReciente)],
    ['Bloqueos', resumen.bloqueos],
    ['Viajes imposibles', resumen.viajesImposibles],
    ['Retirados por cambios', resumen.retirados],
  ];
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/sim/metricas.test.js tests/sim/motorCambios.test.js` y luego `npm test`
Expected: PASS en ambos.

- [ ] **Step 5: Commit**

```bash
git add src/sim/metricas.js src/sim/motor.js src/ui/paneles/PanelMetricas.jsx tests/sim
git commit -m "feat(sim): demora de los últimos 10 minutos y retirados en el panel"
```

---

### Task 3: Modelo de escenario, exportar, importar y almacén

**Files:**
- Create: `src/escenarios/escenario.js`
- Modify: `src/escenarios/historial.js`
- Test: `tests/escenarios/escenario.test.js`, `tests/escenarios/historial.test.js`

**Interfaces:**
- Consumes: `aplicarCambios` (`cambios.js`), `crearRed`.
- Produces:
  - `historialDesdeEntradas(base, entradas) → historial` (lanza si no aplica) en `historial.js`.
  - En `escenario.js`: `DEMANDA_POR_DEFECTO`, `TIPO_ARCHIVO = 'escenario-mapa-sangil'`, `crearEscenario(campos) → escenario`, `validarEscenario(e) → string[]`, `aplicarEscenario(base, e) → datos` (lanza si no aplica), `exportarEscenario(e) → string`, `importarEscenario(texto, base) → escenario` (lanza con mensaje claro), `nombreArchivo(e) → string`, `leerEscenarios(texto) → escenario[]`, `guardarEscenario(lista, e) → lista`, `borrarEscenario(lista, nombre) → lista`.

- [ ] **Step 1: Escribir los tests**

`tests/escenarios/escenario.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  crearEscenario, validarEscenario, aplicarEscenario, exportarEscenario, importarEscenario,
  nombreArchivo, leerEscenarios, guardarEscenario, borrarEscenario, DEMANDA_POR_DEFECTO,
} from '../../src/escenarios/escenario.js';
import { datosRedLinea } from '../sim/redesPrueba.js';

const cerrar = (via) => ({ cambio: { tipo: 'via', viaId: via, propiedades: { abierta: false } }, descripcion: `cerrar ${via}` });
const base = datosRedLinea();

describe('escenario', () => {
  it('se crea con demanda por defecto y se valida', () => {
    const e = crearEscenario({ nombre: 'Prueba', entradas: [cerrar('t1')], demanda: { temporada: 1.4 } });
    expect(e).toMatchObject({ version: 1, nombre: 'Prueba', descripcion: '', restriccionPesados: false });
    expect(e.demanda).toEqual({ ...DEMANDA_POR_DEFECTO, temporada: 1.4 });
    expect(validarEscenario(e)).toEqual([]);
  });

  it('valida nombre, demanda y entradas', () => {
    const e = crearEscenario({ nombre: '', demanda: { factor: -1, horaInicio: 30 } });
    const errores = validarEscenario({ ...e, entradas: [{ descripcion: 'sin cambio' }] }).join(' ');
    expect(errores).toMatch(/nombre/);
    expect(errores).toMatch(/factor/);
    expect(errores).toMatch(/hora/);
    expect(errores).toMatch(/cambio/);
  });

  it('se aplica sobre la red base', () => {
    const datos = aplicarEscenario(base, crearEscenario({ nombre: 'x', entradas: [cerrar('t1')] }));
    expect(datos.vias.find((v) => v.id === 't1').abierta).toBe(false);
  });

  it('exportar e importar devuelve el mismo escenario', () => {
    const e = crearEscenario({ nombre: 'Obra en la Calle 15', entradas: [cerrar('t1')], restriccionPesados: true });
    expect(importarEscenario(exportarEscenario(e), base)).toEqual(e);
  });

  it('importar rechaza lo que no es un escenario o no aplica a esta red, con mensajes claros', () => {
    expect(() => importarEscenario('no es json', base)).toThrow(/no es JSON/);
    expect(() => importarEscenario(JSON.stringify({ nombre: 'x' }), base)).toThrow(/no es un escenario/);
    const ajeno = exportarEscenario(crearEscenario({ nombre: 'Otra ciudad', entradas: [cerrar('zzz')] }));
    expect(() => importarEscenario(ajeno, base)).toThrow(/no se puede aplicar/);
  });

  it('nombre de archivo sin tildes ni espacios', () => {
    expect(nombreArchivo(crearEscenario({ nombre: 'Variante + Restricción' }))).toBe('variante-restriccion.json');
  });
});

describe('almacén de escenarios', () => {
  it('guardar reemplaza el del mismo nombre y borrar lo quita', () => {
    const a = crearEscenario({ nombre: 'A' });
    const b = crearEscenario({ nombre: 'B' });
    let lista = guardarEscenario(guardarEscenario([], a), b);
    lista = guardarEscenario(lista, { ...a, descripcion: 'nueva' });
    expect(lista.map((e) => e.nombre)).toEqual(['B', 'A']);
    expect(lista[1].descripcion).toBe('nueva');
    expect(borrarEscenario(lista, 'B').map((e) => e.nombre)).toEqual(['A']);
  });

  it('leer descarta lo ilegible o inválido', () => {
    expect(leerEscenarios('basura')).toEqual([]);
    expect(leerEscenarios(null)).toEqual([]);
    const valido = crearEscenario({ nombre: 'Bueno' });
    expect(leerEscenarios(JSON.stringify([valido, { nombre: '' }]))).toEqual([valido]);
  });
});
```

Al final de `tests/escenarios/historial.test.js`:

```js
import { historialDesdeEntradas } from '../../src/escenarios/historial.js';

describe('historialDesdeEntradas', () => {
  const cerrar = (via) => ({ cambio: { tipo: 'via', viaId: via, propiedades: { abierta: false } }, descripcion: via });

  it('arma un historial con todas las entradas activas', () => {
    const h = historialDesdeEntradas(datosRedLinea(), [cerrar('t0'), cerrar('t1')]);
    expect(h.indice).toBe(2);
    expect(activos(h)).toHaveLength(2);
  });

  it('lanza si alguna entrada no aplica', () => {
    expect(() => historialDesdeEntradas(datosRedLinea(), [cerrar('zzz')])).toThrow(/no existe/);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/escenarios/escenario.test.js tests/escenarios/historial.test.js`
Expected: FAIL: no existe `escenario.js` ni `historialDesdeEntradas`.

- [ ] **Step 3: Implementar**

Al final de `src/escenarios/historial.js`:

```js
// Historial con todas las entradas activas (para cargar un escenario en el editor).
export function historialDesdeEntradas(base, entradas) {
  crearRed(aplicarCambios(base, entradas.map((e) => e.cambio)));
  return { entradas: [...entradas], indice: entradas.length };
}
```

`src/escenarios/escenario.js`:

```js
// Escenario: los cambios sobre la red base más la demanda y la restricción de
// pesados. Se guarda en el navegador, se exporta como archivo y se compara.

import { aplicarCambios } from './cambios.js';
import { crearRed } from '../sim/red.js';

export const DEMANDA_POR_DEFECTO = { factor: 1, temporada: 1, horaInicio: 7 };
export const TIPO_ARCHIVO = 'escenario-mapa-sangil';

export function crearEscenario({
  nombre, descripcion = '', entradas = [], demanda = {}, restriccionPesados = false, precargado,
}) {
  return {
    version: 1,
    nombre,
    descripcion,
    entradas,
    demanda: { ...DEMANDA_POR_DEFECTO, ...demanda },
    restriccionPesados,
    ...(precargado && { precargado: true }),
  };
}

export function validarEscenario(e) {
  const errores = [];
  if (!e || typeof e !== 'object') return ['no es un objeto'];
  if (typeof e.nombre !== 'string' || !e.nombre.trim()) errores.push('falta el nombre');
  const d = e.demanda ?? {};
  if (!(Number.isFinite(d.factor) && d.factor >= 0 && d.factor <= 5)) errores.push('factor de demanda inválido');
  if (!(Number.isFinite(d.temporada) && d.temporada > 0 && d.temporada <= 5)) errores.push('temporada inválida');
  if (!(Number.isInteger(d.horaInicio) && d.horaInicio >= 0 && d.horaInicio <= 23)) errores.push('hora de inicio inválida');
  if (typeof e.restriccionPesados !== 'boolean') errores.push('restricción de pesados inválida');
  if (!Array.isArray(e.entradas)) errores.push('faltan los cambios');
  else if (e.entradas.some((x) => !x?.cambio || typeof x.cambio.tipo !== 'string')) errores.push('hay un cambio mal formado');
  return errores;
}

export function aplicarEscenario(base, e) {
  const datos = aplicarCambios(base, e.entradas.map((x) => x.cambio));
  crearRed(datos);
  return datos;
}

export function exportarEscenario(e) {
  return JSON.stringify({ tipo: TIPO_ARCHIVO, ...e }, null, 2);
}

export function importarEscenario(texto, base) {
  let objeto;
  try {
    objeto = JSON.parse(texto);
  } catch {
    throw new Error('El archivo no es un escenario válido (no es JSON).');
  }
  if (objeto?.tipo !== TIPO_ARCHIVO) throw new Error('El archivo no es un escenario del simulador de San Gil.');
  const { tipo: _tipo, ...resto } = objeto;
  const e = crearEscenario(resto);
  const errores = validarEscenario(e);
  if (errores.length) throw new Error(`Escenario inválido: ${errores.join('; ')}.`);
  try {
    aplicarEscenario(base, e);
  } catch (err) {
    throw new Error(`El escenario no se puede aplicar a esta red: ${err.message}`);
  }
  return e;
}

export function nombreArchivo(e) {
  const limpio = e.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${limpio || 'escenario'}.json`;
}

// --- almacén en el navegador (el texto lo lee y escribe la interfaz) ---------

export const CLAVE_ESCENARIOS = 'mapa-sangil:escenarios';

export function leerEscenarios(texto) {
  try {
    const lista = JSON.parse(texto);
    return Array.isArray(lista) ? lista.filter((e) => validarEscenario(e).length === 0) : [];
  } catch {
    return [];
  }
}

export const guardarEscenario = (lista, e) => [...lista.filter((x) => x.nombre !== e.nombre), e];
export const borrarEscenario = (lista, nombre) => lista.filter((x) => x.nombre !== nombre);
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/escenarios/escenario.test.js tests/escenarios/historial.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/escenarios tests/escenarios
git commit -m "feat(escenarios): escenarios con nombre, exportar, importar y almacén"
```

---

### Task 4: Escenarios e historias precargados

**Files:**
- Create: `src/escenarios/precargados.js`
- Test: `tests/escenarios/precargados.test.js`

**Interfaces:**
- Consumes: `crearEscenario`, `aplicarEscenario` (Task 3); `aplicarCambio` (`cambios.js`); `crearRed`, `componentePrincipal`; `prepararGeometria`; `arcosEnCasco`, `rodeaElCasco`; `distanciaMetros`, `proyectarEnLinea`, `lineasSeCruzan`; `ZONAS`, `SALIDAS`, `CASCO_URBANO`.
- Produces:
  - `trazadoAproximadoVariante(datos, casco?) → entrada[]`: une cada extremo suelto de la Variante con el punto de la Avenida más cercano **fuera** del casco (radio + 200 m), en línea recta, y termina la obra.
  - `puentePropuesto(datos, rios) → entrada | null`: puente recto de ≤ 160 m entre dos cruces de orillas opuestas, a ≥ 300 m de los puentes existentes, el más cercano al centro.
  - `arreglarVias(datos, radio = 2000) → entrada[]`: deja en buen estado y pavimentadas las vías con huecos, regulares o destapadas a menos de `radio` del centro.
  - `construirPrecargados(base, rios) → { escenarios: escenario[], historias: historia[] }`.

Escenarios precargados: "San Gil actual", "Temporada alta", "Obra en el Rojas Pinilla", "Variante terminada (sin restricción)", "Variante terminada con restricción" y, si hay ríos, "Puente nuevo propuesto". Historias: "Cómo mejora San Gil" (actual → temporada alta → + puente nuevo → + Variante con restricción → + vías arregladas) y "Cómo empeora" (actual → obra en el Rojas Pinilla → + temporada alta).

- [ ] **Step 1: Escribir los tests**

`tests/escenarios/precargados.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  trazadoAproximadoVariante, puentePropuesto, arreglarVias, construirPrecargados,
} from '../../src/escenarios/precargados.js';
import { aplicarEscenario } from '../../src/escenarios/escenario.js';
import { aplicarCambios } from '../../src/escenarios/cambios.js';
import { crearRed } from '../../src/sim/red.js';
import { prepararGeometria } from '../../src/sim/geometriaArcos.js';
import { arcosEnCasco, rodeaElCasco } from '../../src/sim/restriccion.js';
import { distanciaMetros, lineasSeCruzan } from '../../src/sim/geo.js';
import { CASCO_URBANO, SALIDAS } from '../../src/escenarios/zonas.js';

const leer = (archivo) => JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', archivo), 'utf8'));
const base = leer('red-sangil.json');
const rios = leer('rios.json').rios.map((r) => r.geometria);
const aplicar = (entradas) => aplicarCambios(base, entradas.map((e) => e.cambio));

describe('Variante con trazado aproximado', () => {
  it('conecta Socorro con Bucaramanga por fuera del casco urbano', () => {
    const datos = aplicar(trazadoAproximadoVariante(base));
    const red = crearRed(datos);
    const casco = arcosEnCasco(red, prepararGeometria(red), CASCO_URBANO);
    expect(rodeaElCasco(red, casco, SALIDAS.socorro.nodo, SALIDAS.bucaramanga.nodo)).toBe(true);
    expect(datos.vias.filter((v) => v.tipo === 'variante').every((v) => !v.enConstruccion)).toBe(true);
  }, 30000);
});

describe('puente propuesto', () => {
  it('cruza el río, mide máximo 160 m y queda lejos de los puentes existentes', () => {
    const entrada = puentePropuesto(base, rios);
    expect(entrada).not.toBeNull();
    const datos = aplicar([entrada]);
    const puente = datos.vias.find((v) => v.id === entrada.cambio.id);
    expect(puente.esPuente).toBe(true);
    expect(puente.longitud).toBeLessThanOrEqual(160);
    expect(rios.some((r) => lineasSeCruzan(puente.geometria, r))).toBe(true);
    const medio = (g) => g[Math.floor(g.length / 2)];
    for (const v of base.vias.filter((x) => x.esPuente)) {
      expect(distanciaMetros(medio(puente.geometria), medio(v.geometria))).toBeGreaterThanOrEqual(250);
    }
  }, 30000);

  it('sin ríos no hay puente propuesto', () => {
    expect(puentePropuesto(base, [])).toBeNull();
  });
});

describe('vías arregladas', () => {
  it('deja en buen estado y pavimentadas las vías en mal estado cerca del centro', () => {
    const entradas = arreglarVias(base);
    expect(entradas.length).toBeGreaterThan(0);
    const datos = aplicar(entradas);
    for (const e of entradas) {
      expect(datos.vias.find((v) => v.id === e.cambio.viaId)).toMatchObject({ estado: 'bueno', superficie: 'pavimento' });
    }
  });
});

describe('construirPrecargados', () => {
  it('todos los escenarios y pasos de historia se aplican a la red', () => {
    const { escenarios, historias } = construirPrecargados(base, rios);
    expect(escenarios.map((e) => e.nombre)).toEqual(expect.arrayContaining([
      'San Gil actual', 'Temporada alta', 'Obra en el Rojas Pinilla', 'Variante terminada con restricción', 'Puente nuevo propuesto',
    ]));
    for (const e of escenarios) expect(() => aplicarEscenario(base, e)).not.toThrow();
    const mejora = historias.find((h) => h.nombre === 'Cómo mejora San Gil');
    expect(mejora.pasos.map((p) => p.titulo)).toHaveLength(5);
    for (const p of mejora.pasos) expect(() => aplicarEscenario(base, p.escenario)).not.toThrow();
    // cada paso acumula los cambios del anterior
    for (let i = 1; i < mejora.pasos.length; i++) {
      expect(mejora.pasos[i].escenario.entradas.length).toBeGreaterThanOrEqual(mejora.pasos[i - 1].escenario.entradas.length);
    }
    expect(historias.find((h) => h.nombre === 'Cómo empeora San Gil').pasos).toHaveLength(3);
  }, 60000);

  it('sin ríos se construye igual, sin el puente propuesto', () => {
    const { escenarios, historias } = construirPrecargados(base, []);
    expect(escenarios.some((e) => e.nombre === 'Puente nuevo propuesto')).toBe(false);
    expect(historias.find((h) => h.nombre === 'Cómo mejora San Gil').pasos).toHaveLength(4);
  }, 60000);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/escenarios/precargados.test.js`
Expected: FAIL, no se puede resolver `src/escenarios/precargados.js`.

- [ ] **Step 3: Implementar `src/escenarios/precargados.js`**

```js
// Escenarios e historias que vienen listos para la demo. Lo que no sale de OSM
// ni del usuario es un SUPUESTO: el trazado de la Variante y el puente
// propuesto son aproximaciones que el usuario puede reemplazar en el editor.

import { crearEscenario } from './escenario.js';
import { aplicarCambio } from './cambios.js';
import { crearRed, componentePrincipal } from '../sim/red.js';
import { distanciaMetros, proyectarEnLinea, lineasSeCruzan } from '../sim/geo.js';
import { ZONAS, CASCO_URBANO } from './zonas.js';

const CENTRO = [ZONAS.centro.lon, ZONAS.centro.lat];
const MARGEN_CASCO = 200; // m por fuera del casco donde la Variante se une a la Avenida
const ATRIBUTOS_VARIANTE = {
  nombre: 'Variante de San Gil (trazado aproximado)', tipo: 'variante', sentido: 'ambos',
  velocidadMax: 60, carrilesPorSentido: 1, enConstruccion: true,
};

const entrada = (cambio, descripcion) => ({ cambio, descripcion });
const medio = (g) => g[Math.floor(g.length / 2)];

function gradoDeNodos(datos) {
  const grado = new Map();
  for (const v of datos.vias) for (const n of [v.desde, v.hasta]) grado.set(n, (grado.get(n) ?? 0) + 1);
  return grado;
}

export function trazadoAproximadoVariante(datos, casco = CASCO_URBANO) {
  const grado = gradoDeNodos(datos);
  const nodos = new Map(datos.nodos.map((n) => [n.id, n]));
  const extremosSueltos = [...new Set(datos.vias
    .filter((v) => v.tipo === 'variante')
    .flatMap((v) => [v.desde, v.hasta])
    .filter((n) => grado.get(n) === 1))];
  const avenida = datos.vias.filter((v) => v.tipo === 'avenida_nacional');
  const fueraDelCasco = (p) => distanciaMetros(p, [casco.lon, casco.lat]) > casco.radio + MARGEN_CASCO;

  const entradas = [];
  extremosSueltos.forEach((nodoId, k) => {
    const n = nodos.get(nodoId);
    const p = [n.lon, n.lat];
    let mejor = null;
    for (const v of avenida) {
      const proy = proyectarEnLinea(v.geometria, p);
      if (!fueraDelCasco(proy.punto)) continue;
      if (!mejor || proy.distancia < mejor.distancia) mejor = { ...proy, via: v.id };
    }
    if (!mejor) return;
    const id = `variante-aprox-${k + 1}`;
    entradas.push(entrada({
      tipo: 'viaNueva', id, puntos: [p, mejor.punto],
      extremos: [{ tipo: 'nodo', nodo: nodoId, punto: p }, { tipo: 'via', via: mejor.via, punto: mejor.punto }],
      atributos: ATRIBUTOS_VARIANTE,
    }, `Tramo aproximado de la Variante ${k + 1}`));
  });

  // Se calculan los ids después de agregar los tramos, para terminarlos todos.
  let conTramos = datos;
  for (const e of entradas) conTramos = aplicarCambio(conTramos, e.cambio);
  const enObra = conTramos.vias.filter((v) => v.tipo === 'variante' && v.enConstruccion).map((v) => v.id);
  if (enObra.length) entradas.push(entrada({ tipo: 'terminarObra', viaIds: enObra }, 'Variante terminada'));
  return entradas;
}

export function puentePropuesto(datos, rios, { largoMax = 160, separacion = 300, cercaDelRio = 120 } = {}) {
  if (!rios.length) return null;
  const red = crearRed(datos);
  const principal = componentePrincipal(red);
  const puentes = datos.vias.filter((v) => v.esPuente).map((v) => medio(v.geometria));
  const candidatos = [...principal]
    .map((id) => red.nodos.get(id))
    .filter((n) => rios.some((r) => proyectarEnLinea(r, [n.lon, n.lat]).distancia < cercaDelRio));

  let mejor = null;
  for (let i = 0; i < candidatos.length; i++) {
    for (let j = i + 1; j < candidatos.length; j++) {
      const a = [candidatos[i].lon, candidatos[i].lat];
      const b = [candidatos[j].lon, candidatos[j].lat];
      const largo = distanciaMetros(a, b);
      if (largo > largoMax || largo < 30) continue;
      if (!rios.some((r) => lineasSeCruzan([a, b], r))) continue;
      const centro = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (puentes.some((p) => distanciaMetros(p, centro) < separacion)) continue;
      const puntaje = distanciaMetros(centro, CENTRO);
      if (!mejor || puntaje < mejor.puntaje) mejor = { a: candidatos[i], b: candidatos[j], puntaje };
    }
  }
  if (!mejor) return null;
  const pa = [mejor.a.lon, mejor.a.lat];
  const pb = [mejor.b.lon, mejor.b.lat];
  return entrada({
    tipo: 'viaNueva', id: 'puente-propuesto', puntos: [pa, pb],
    extremos: [{ tipo: 'nodo', nodo: mejor.a.id, punto: pa }, { tipo: 'nodo', nodo: mejor.b.id, punto: pb }],
    atributos: {
      nombre: 'Puente nuevo (propuesto)', tipo: 'doble_sentido', sentido: 'ambos',
      velocidadMax: 30, carrilesPorSentido: 1, enConstruccion: false, esPuente: true,
    },
  }, 'Puente nuevo propuesto');
}

export function arreglarVias(datos, radio = 2000) {
  return datos.vias
    .filter((v) => v.estado !== 'bueno' || v.superficie === 'destapado')
    .filter((v) => distanciaMetros(v.geometria[0], CENTRO) <= radio)
    .map((v) => entrada(
      { tipo: 'via', viaId: v.id, propiedades: { estado: 'bueno', superficie: 'pavimento' } },
      `${v.nombre || 'Vía sin nombre'}: arreglada`,
    ));
}

export function construirPrecargados(base, rios) {
  const ALTA = { temporada: 1.4 };
  const varianteSin = trazadoAproximadoVariante(base);
  const puente = puentePropuesto(base, rios);
  const rojas = base.vias.filter((v) => v.osmId === 24670013).map((v) => entrada(
    { tipo: 'via', viaId: v.id, propiedades: { abierta: false } }, 'Puente Rojas Pinilla: cerrado por obra',
  ));

  const actual = crearEscenario({ nombre: 'San Gil actual', descripcion: 'La red de hoy, día normal', precargado: true });
  const alta = crearEscenario({ nombre: 'Temporada alta', descripcion: 'Festivos y turismo: demanda ×1,4', demanda: ALTA, precargado: true });
  const obra = crearEscenario({ nombre: 'Obra en el Rojas Pinilla', descripcion: 'El puente principal cerrado', entradas: rojas, precargado: true });
  const varianteSinRestriccion = crearEscenario({
    nombre: 'Variante terminada (sin restricción)', descripcion: 'Trazado aproximado; los pesados escogen libremente',
    entradas: varianteSin, precargado: true,
  });
  const varianteConRestriccion = crearEscenario({
    nombre: 'Variante terminada con restricción', descripcion: 'Trazado aproximado; pesados de paso por la Variante',
    entradas: varianteSin, restriccionPesados: true, precargado: true,
  });
  const escenarios = [actual, alta, obra, varianteSinRestriccion, varianteConRestriccion];
  if (puente) {
    escenarios.push(crearEscenario({ nombre: 'Puente nuevo propuesto', descripcion: 'Un cruce más sobre el Fonce', entradas: [puente], precargado: true }));
  }

  // Historia "Cómo mejora": cada paso acumula los cambios del anterior.
  const pasosMejora = [];
  let acumuladas = [];
  const agregarPaso = (titulo, nota, nuevas, extra = {}) => {
    acumuladas = [...acumuladas, ...nuevas];
    pasosMejora.push({ titulo, nota, escenario: crearEscenario({ nombre: titulo, entradas: acumuladas, demanda: ALTA, ...extra }) });
  };
  pasosMejora.push({ titulo: 'San Gil hoy', nota: 'Un día normal, con la red actual.', escenario: actual });
  agregarPaso('Temporada alta', 'Festivos y turismo: 40 % más viajes. El centro y los puentes se llenan.', []);
  if (puente) agregarPaso('+ Puente nuevo', 'Un cruce más sobre el Fonce reparte el tráfico entre las dos orillas.', [puente]);
  agregarPaso('+ Variante terminada', 'Con restricción: tractomulas y buses de paso ya no cruzan el centro.', varianteSin, { restriccionPesados: true });
  agregarPaso('+ Vías arregladas', 'Las vías alternas en mal estado quedan pavimentadas y los carros empiezan a usarlas.', arreglarVias(base), { restriccionPesados: true });

  const historias = [
    { nombre: 'Cómo mejora San Gil', pasos: pasosMejora },
    {
      nombre: 'Cómo empeora San Gil',
      pasos: [
        { titulo: 'San Gil hoy', nota: 'Un día normal, con la red actual.', escenario: actual },
        { titulo: 'Obra en el Rojas Pinilla', nota: 'El puente principal se cierra: todo se va a la Calle 15.', escenario: obra },
        {
          titulo: '+ Temporada alta', nota: 'La obra coincide con festivos: el sistema colapsa.',
          escenario: crearEscenario({ nombre: 'Obra + temporada alta', entradas: rojas, demanda: ALTA }),
        },
      ],
    },
  ];
  return { escenarios, historias };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/escenarios/precargados.test.js`
Expected: PASS. Si "conecta Socorro con Bucaramanga" falla, aplicar superpowers:systematic-debugging: revisar qué extremos sueltos encontró y a qué punto de la Avenida se unieron (imprimirlos); un resultado que no conecta es un hallazgo sobre los datos y se registra antes de cambiar el algoritmo.

- [ ] **Step 5: Commit**

```bash
git add src/escenarios/precargados.js tests/escenarios/precargados.test.js
git commit -m "feat(escenarios): escenarios e historias precargados para la demo"
```

---

### Task 5: Comparar escenarios en modo rápido

**Files:**
- Create: `src/escenarios/comparar.js`
- Test: `tests/escenarios/comparar.test.js`

**Interfaces:**
- Consumes: `crearMotor`, `crearRed`, `aplicarEscenario`.
- Produces: `METRICAS_COMPARADAS`, `correrEscenario(base, escenario, { semilla, duracion, datos? }) → { resumen, serie, vias: Map }`, `compararEscenarios(base, escenarios, { semillas, duracion, alProgreso }) → resultado` (ver Contratos), `resumirCorridas(nombre, corridas)`, `variacion(referencia, otro, clave) → número | null`, `diferenciasPorVia(referencia, otro, { usoMinimo }) → Map<viaId, delta>`.

- [ ] **Step 1: Escribir los tests**

`tests/escenarios/comparar.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  correrEscenario, compararEscenarios, variacion, diferenciasPorVia, METRICAS_COMPARADAS,
} from '../../src/escenarios/comparar.js';
import { crearEscenario } from '../../src/escenarios/escenario.js';
import { datosRedLinea } from '../sim/redesPrueba.js';

const linea = datosRedLinea({ tramos: 3, extra: { sentido: 'ambos', tipo: 'doble_sentido' } });
const cerrar = (via) => ({ cambio: { tipo: 'via', viaId: via, propiedades: { abierta: false } }, descripcion: via });
const base = crearEscenario({ nombre: 'Base', demanda: { horaInicio: 11, factor: 0.3 } });
const cerrado = crearEscenario({ nombre: 'Cerrado', entradas: [cerrar('t1')], demanda: { horaInicio: 11, factor: 0.3 } });

describe('correrEscenario', () => {
  it('devuelve resumen, serie por minuto y estado por vía', () => {
    const r = correrEscenario(linea, base, { semilla: 1, duracion: 300 });
    expect(r.serie).toHaveLength(5);
    expect(r.serie[0]).toMatchObject({ t: 60 });
    expect(r.resumen.viajesCompletados).toBeGreaterThan(0);
    expect(r.vias.size).toBeGreaterThan(0);
  });

  it('es determinista con la misma semilla', () => {
    const a = correrEscenario(linea, base, { semilla: 4, duracion: 300 });
    const b = correrEscenario(linea, base, { semilla: 4, duracion: 300 });
    expect(a.resumen).toEqual(b.resumen);
  });
});

describe('compararEscenarios', () => {
  it('corre cada escenario con cada semilla, informa el progreso y resume con promedio y rango', () => {
    const progreso = [];
    const r = compararEscenarios(linea, [base, cerrado], { semillas: [1, 2], duracion: 300, alProgreso: (h, t) => progreso.push([h, t]) });
    expect(progreso).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]]);
    expect(r.resultados.map((x) => x.nombre)).toEqual(['Base', 'Cerrado']);
    for (const res of r.resultados) {
      for (const clave of METRICAS_COMPARADAS) {
        const { media, min, max } = res.metricas[clave];
        expect(min).toBeLessThanOrEqual(media);
        expect(media).toBeLessThanOrEqual(max);
      }
      expect(res.serie).toHaveLength(5);
    }
    // con la vía del medio cerrada hay viajes que no se pueden hacer
    expect(r.resultados[1].metricas.viajesImposibles.media).toBeGreaterThan(r.resultados[0].metricas.viajesImposibles.media);
  });
});

describe('variacion y diferencias', () => {
  const res = (media) => ({ metricas: { demoraMedia: { media, min: media, max: media } } });

  it('variación porcentual frente a la referencia; null si la referencia es 0', () => {
    expect(variacion(res(100), res(150), 'demoraMedia')).toBeCloseTo(0.5, 6);
    expect(variacion(res(0), res(150), 'demoraMedia')).toBeNull();
  });

  it('diferencias por vía: solo las que tienen uso suficiente', () => {
    const a = { vias: { x: { ratio: 0.5, uso: 10 }, y: { ratio: 0.9, uso: 1 } } };
    const b = { vias: { x: { ratio: 0.8, uso: 12 }, y: { ratio: 0.2, uso: 2 }, z: { ratio: 0.7, uso: 9 } } };
    const d = diferenciasPorVia(a, b, { usoMinimo: 5 });
    expect(d.get('x')).toBeCloseTo(0.3, 6);
    expect(d.has('y')).toBe(false);
    expect(d.get('z')).toBeCloseTo(-0.3, 6);
  });
});

describe('comparar en San Gil', () => {
  it('cerrar el Rojas Pinilla da más demora en promedio de dos semillas', () => {
    const datos = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'red-sangil.json'), 'utf8'));
    const rojas = datos.vias.filter((v) => v.osmId === 24670013).map((v) => cerrar(v.id));
    const r = compararEscenarios(datos, [
      crearEscenario({ nombre: 'Base' }),
      crearEscenario({ nombre: 'Obra', entradas: rojas }),
    ], { semillas: [1, 2], duracion: 900 });
    expect(variacion(r.resultados[0], r.resultados[1], 'demoraMedia')).toBeGreaterThan(0);
  }, 300000);
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/escenarios/comparar.test.js`
Expected: FAIL, no se puede resolver `src/escenarios/comparar.js`.

- [ ] **Step 3: Implementar `src/escenarios/comparar.js`**

```js
// Comparación de escenarios en "modo rápido": el motor corre sin dibujar, con
// la misma duración y las mismas semillas para todos, y se reporta promedio y
// rango. Así se responde "¿y si fue suerte?".

import { crearRed } from '../sim/red.js';
import { crearMotor } from '../sim/motor.js';
import { aplicarEscenario } from './escenario.js';

export const METRICAS_COMPARADAS = [
  'viajesCompletados', 'tiempoMedio', 'demoraMedia', 'demoraTotalVh', 'bloqueos', 'viajesImposibles',
];
const MUESTREO = 60; // s

const promedio = (valores) => (valores.length ? valores.reduce((s, x) => s + x, 0) / valores.length : 0);

export function correrEscenario(base, escenario, { semilla = 1, duracion = 1800, datos } = {}) {
  const red = crearRed(datos ?? aplicarEscenario(base, escenario));
  const motor = crearMotor(red, {
    semilla, demanda: escenario.demanda, restriccionPesados: escenario.restriccionPesados,
  });
  const pasosMuestreo = Math.round(MUESTREO / motor.dt);
  const total = Math.round(duracion / motor.dt);
  const serie = [];
  const acumulado = new Map();
  for (let k = 1; k <= total; k++) {
    motor.paso();
    if (k % pasosMuestreo !== 0) continue;
    const r = motor.resumen();
    serie.push({ t: motor.t, demoraReciente: r.demoraReciente, enRed: r.enRed });
    for (const { viaId, ratio } of motor.estadoVias()) {
      const x = acumulado.get(viaId) ?? { suma: 0, n: 0 };
      x.suma += ratio;
      x.n += 1;
      acumulado.set(viaId, x);
    }
  }
  const uso = motor.usoVias();
  const vias = new Map();
  for (const [viaId, { suma, n }] of acumulado) vias.set(viaId, { ratio: suma / n, uso: uso.get(viaId) ?? 0 });
  for (const [viaId, u] of uso) if (!vias.has(viaId)) vias.set(viaId, { ratio: 1, uso: u });
  return { resumen: motor.resumen(), serie, vias };
}

export function resumirCorridas(nombre, corridas) {
  const metricas = {};
  for (const clave of METRICAS_COMPARADAS) {
    const valores = corridas.map((c) => c.resumen[clave]);
    metricas[clave] = { media: promedio(valores), min: Math.min(...valores), max: Math.max(...valores) };
  }
  const serie = corridas[0].serie.map((punto, i) => ({
    t: punto.t,
    demoraReciente: promedio(corridas.map((c) => c.serie[i]?.demoraReciente ?? 0)),
    enRed: promedio(corridas.map((c) => c.serie[i]?.enRed ?? 0)),
  }));
  const sumas = new Map();
  for (const c of corridas) {
    for (const [viaId, { ratio, uso }] of c.vias) {
      const x = sumas.get(viaId) ?? { ratio: 0, uso: 0 };
      x.ratio += ratio;
      x.uso += uso;
      sumas.set(viaId, x);
    }
  }
  const vias = {};
  for (const [viaId, { ratio, uso }] of sumas) vias[viaId] = { ratio: ratio / corridas.length, uso: uso / corridas.length };
  return { nombre, metricas, serie, vias };
}

export function compararEscenarios(base, escenarios, { semillas = [1, 2, 3], duracion = 1800, alProgreso = () => {} } = {}) {
  const total = escenarios.length * semillas.length;
  let hechos = 0;
  const resultados = escenarios.map((escenario) => {
    const datos = aplicarEscenario(base, escenario);
    const corridas = semillas.map((semilla) => {
      const corrida = correrEscenario(base, escenario, { semilla, duracion, datos });
      hechos += 1;
      alProgreso(hechos, total);
      return corrida;
    });
    return resumirCorridas(escenario.nombre, corridas);
  });
  return { duracion, semillas, resultados };
}

// Variación relativa de una métrica frente a la referencia (0,25 = 25 % más).
export function variacion(referencia, otro, clave) {
  const a = referencia.metricas[clave].media;
  const b = otro.metricas[clave].media;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return (b - a) / a;
}

// Cuánto cambió la fluidez de cada vía (positivo = más fluida que en la referencia).
export function diferenciasPorVia(referencia, otro, { usoMinimo = 5 } = {}) {
  const ids = new Set([...Object.keys(referencia.vias), ...Object.keys(otro.vias)]);
  const diferencias = new Map();
  for (const id of ids) {
    const a = referencia.vias[id] ?? { ratio: 1, uso: 0 };
    const b = otro.vias[id] ?? { ratio: 1, uso: 0 };
    if (Math.max(a.uso, b.uso) < usoMinimo) continue;
    diferencias.set(id, b.ratio - a.ratio);
  }
  return diferencias;
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/escenarios/comparar.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/escenarios/comparar.js tests/escenarios/comparar.test.js
git commit -m "feat(escenarios): comparar escenarios en modo rápido con varias semillas"
```

---

### Task 6: Comparador en un worker aparte

**Files:**
- Create: `src/worker/comparador.js`, `src/worker/comparador.worker.js`, `src/worker/clienteComparador.js`
- Test: `tests/worker/comparador.test.js`

**Interfaces:**
- Consumes: `compararEscenarios` (Task 5).
- Produces:
  - `crearControladorComparador(enviar) → { recibir(mensaje) }`: cada mensaje lleva un `id`; las respuestas repiten ese `id`.
  - `crearClienteComparador(alRecibir) → { comparar(base, escenarios, opciones) → id, cancelar() }`: `cancelar` termina el worker y crea uno nuevo; el cliente ignora mensajes de un `id` que no es el último pedido.

- [ ] **Step 1: Escribir los tests**

`tests/worker/comparador.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearControladorComparador, filtrarPorId } from '../../src/worker/comparador.js';
import { crearEscenario } from '../../src/escenarios/escenario.js';
import { datosRedLinea } from '../sim/redesPrueba.js';

const base = datosRedLinea({ extra: { sentido: 'ambos', tipo: 'doble_sentido' } });

describe('controlador del comparador', () => {
  it('informa el progreso y entrega el resultado con el mismo id', () => {
    const enviados = [];
    const c = crearControladorComparador((m) => enviados.push(m));
    c.recibir({
      tipo: 'comparar', id: 7, base,
      escenarios: [crearEscenario({ nombre: 'A', demanda: { horaInicio: 11, factor: 0.3 } })],
      opciones: { semillas: [1, 2], duracion: 120 },
    });
    expect(enviados.map((m) => m.tipo)).toEqual(['progreso', 'progreso', 'resultado']);
    expect(enviados.every((m) => m.id === 7)).toBe(true);
    expect(enviados[2].resultado.resultados[0].nombre).toBe('A');
  });

  it('un escenario que no aplica responde error', () => {
    const enviados = [];
    const c = crearControladorComparador((m) => enviados.push(m));
    const malo = crearEscenario({ nombre: 'Malo', entradas: [{ cambio: { tipo: 'via', viaId: 'zzz', propiedades: { abierta: false } }, descripcion: '' }] });
    c.recibir({ tipo: 'comparar', id: 1, base, escenarios: [malo], opciones: { semillas: [1], duracion: 60 } });
    expect(enviados).toEqual([expect.objectContaining({ tipo: 'error', id: 1, mensaje: expect.stringMatching(/no existe/) })]);
  });
});

describe('filtrarPorId', () => {
  it('deja pasar solo los mensajes del pedido vigente', () => {
    const recibidos = [];
    let vigente = 2;
    const filtro = filtrarPorId(() => vigente, (m) => recibidos.push(m));
    filtro({ tipo: 'resultado', id: 1 });
    filtro({ tipo: 'progreso', id: 2 });
    vigente = 3;
    filtro({ tipo: 'resultado', id: 2 });
    expect(recibidos).toEqual([{ tipo: 'progreso', id: 2 }]);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/worker/comparador.test.js`
Expected: FAIL, no se puede resolver `src/worker/comparador.js`.

- [ ] **Step 3: Implementar**

`src/worker/comparador.js`:

```js
// Lógica del worker del comparador, separada de `self` para poder probarla.

import { compararEscenarios } from '../escenarios/comparar.js';

export function crearControladorComparador(enviar) {
  return {
    recibir(mensaje) {
      if (mensaje.tipo !== 'comparar') return;
      const { id } = mensaje;
      try {
        const resultado = compararEscenarios(mensaje.base, mensaje.escenarios, {
          ...mensaje.opciones,
          alProgreso: (hechos, total) => enviar({ tipo: 'progreso', id, hechos, total }),
        });
        enviar({ tipo: 'resultado', id, resultado });
      } catch (err) {
        enviar({ tipo: 'error', id, mensaje: err.message });
      }
    },
  };
}

// Descarta mensajes de pedidos viejos (por ejemplo, de una comparación cancelada).
export function filtrarPorId(idVigente, alRecibir) {
  return (mensaje) => {
    if (mensaje.id === idVigente()) alRecibir(mensaje);
  };
}
```

`src/worker/comparador.worker.js`:

```js
import { crearControladorComparador } from './comparador.js';

const controlador = crearControladorComparador((mensaje) => self.postMessage(mensaje));
self.onmessage = ({ data }) => controlador.recibir(data);
```

`src/worker/clienteComparador.js`:

```js
import { filtrarPorId } from './comparador.js';

// Lado de la interfaz del comparador. Cancelar termina el worker (la
// comparación es un cálculo largo y síncrono) y deja uno nuevo listo.
export function crearClienteComparador(alRecibir) {
  let idVigente = 0;
  const recibir = filtrarPorId(() => idVigente, alRecibir);
  const nuevo = () => {
    const w = new Worker(new URL('./comparador.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }) => recibir(data);
    w.onerror = (e) => alRecibir({ tipo: 'error', id: idVigente, mensaje: e.message || 'Falló el comparador' });
    return w;
  };
  let worker = nuevo();

  return {
    comparar(base, escenarios, opciones) {
      idVigente += 1;
      worker.postMessage({ tipo: 'comparar', id: idVigente, base, escenarios, opciones });
      return idVigente;
    },
    cancelar() {
      idVigente += 1;
      worker.terminate();
      worker = nuevo();
    },
    terminar: () => worker.terminate(),
  };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run tests/worker/comparador.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/worker tests/worker/comparador.test.js
git commit -m "feat(worker): comparador de escenarios en un worker aparte"
```

---

### Task 7: Formatos, colores de diferencia y descarga de archivos

**Files:**
- Modify: `src/ui/formato.js`, `src/ui/mapa/estilosVia.js`
- Create: `src/ui/descargar.js`
- Test: `tests/ui/formato.test.js`, `tests/ui/estilosVia.test.js`

**Interfaces:**
- Produces: `ETIQUETA_METRICA`, `formatearMetrica(clave, valor) → texto`, `formatearVariacion(v) → texto` (`formato.js`); `colorDiferencia(delta?) → [r,g,b]`, `ESCALA_DIFERENCIA` (`estilosVia.js`); `descargarTexto(nombre, texto)` (`descargar.js`, solo navegador).

- [ ] **Step 1: Escribir los tests**

Al final de `tests/ui/formato.test.js`:

```js
import { formatearMetrica, formatearVariacion, ETIQUETA_METRICA } from '../../src/ui/formato.js';
import { METRICAS_COMPARADAS } from '../../src/escenarios/comparar.js';

describe('formato de métricas', () => {
  it('toda métrica comparada tiene etiqueta', () => {
    for (const clave of METRICAS_COMPARADAS) expect(ETIQUETA_METRICA[clave]).toBeTruthy();
  });

  it('tiempos como duración, conteos redondeados, vehículo-hora con un decimal', () => {
    expect(formatearMetrica('demoraMedia', 125)).toBe('2 min 5 s');
    expect(formatearMetrica('viajesCompletados', 412.6)).toBe('413');
    expect(formatearMetrica('demoraTotalVh', 12.345)).toBe('12,3 veh·h');
  });

  it('variación con signo, o guion si no se puede calcular', () => {
    expect(formatearVariacion(0.254)).toBe('+25 %');
    expect(formatearVariacion(-0.1)).toBe('−10 %');
    expect(formatearVariacion(null)).toBe('—');
  });
});
```

Al final de `tests/ui/estilosVia.test.js`:

```js
import { colorDiferencia } from '../../src/ui/mapa/estilosVia.js';

describe('colorDiferencia', () => {
  it('verde si mejoró, rojo si empeoró, gris si casi igual o sin datos', () => {
    expect(colorDiferencia(0.3)).toEqual([46, 160, 67]);
    expect(colorDiferencia(-0.3)).toEqual([214, 69, 65]);
    expect(colorDiferencia(0.02)).toEqual([190, 196, 204]);
    expect(colorDiferencia(undefined)).toEqual([215, 219, 224]);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/ui/formato.test.js tests/ui/estilosVia.test.js`
Expected: FAIL: las funciones no existen.

- [ ] **Step 3: Implementar**

Al final de `src/ui/formato.js`:

```js
export const ETIQUETA_METRICA = {
  viajesCompletados: 'Viajes completados',
  tiempoMedio: 'Tiempo medio de viaje',
  demoraMedia: 'Demora media',
  demoraTotalVh: 'Demora total',
  bloqueos: 'Bloqueos',
  viajesImposibles: 'Viajes imposibles',
};

const DURACIONES = new Set(['tiempoMedio', 'demoraMedia']);

export function formatearMetrica(clave, valor) {
  if (DURACIONES.has(clave)) return formatearDuracion(valor);
  if (clave === 'demoraTotalVh') return `${valor.toFixed(1).replace('.', ',')} veh·h`;
  return String(Math.round(valor));
}

export function formatearVariacion(v) {
  if (v === null || !Number.isFinite(v)) return '—';
  const pct = Math.round(v * 100);
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct)} %`;
}
```

Al final de `src/ui/mapa/estilosVia.js`:

```js
export function colorDiferencia(delta) {
  if (delta === undefined || delta === null) return [215, 219, 224];
  if (delta > 0.05) return [46, 160, 67];
  if (delta < -0.05) return [214, 69, 65];
  return [190, 196, 204];
}

export const ESCALA_DIFERENCIA = [
  { etiqueta: 'Más fluida que en la referencia', color: [46, 160, 67] },
  { etiqueta: 'Igual', color: [190, 196, 204] },
  { etiqueta: 'Más lenta que en la referencia', color: [214, 69, 65] },
  { etiqueta: 'Sin tráfico en ninguno', color: [215, 219, 224] },
];
```

`src/ui/descargar.js`:

```js
// Descarga un texto como archivo desde el navegador.
export function descargarTexto(nombre, texto, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/ui/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/formato.js src/ui/mapa/estilosVia.js src/ui/descargar.js tests/ui
git commit -m "feat(ui): formatos de métricas, colores de diferencia y descarga de archivos"
```

---

### Task 8: Interfaz de escenarios, comparador e historia

**Files:**
- Create: `src/ui/paneles/PanelEscenarios.jsx`, `PanelComparador.jsx`, `ResultadosComparacion.jsx`, `PanelHistoria.jsx`, `BarraHistoria.jsx`
- Modify: `src/ui/edicion/useEdicion.js`, `src/ui/paneles/Leyenda.jsx`, `src/ui/mapa/MapaSanGil.jsx`, `src/ui/App.jsx` (reemplazo completo), `src/ui/estilos.css` (agregar al final), `package.json` (Recharts)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `useEdicion(base)` agrega `cargar(entradas)` (valida con `historialDesdeEntradas`; si falla, muestra el error y no cambia nada).
  - Componentes: `<PanelEscenarios guardados precargados onGuardar onCargar onBorrar onExportar onImportar />`, `<PanelComparador escenarios progreso corriendo onComparar onCancelar />`, `<ResultadosComparacion comparacion red onCerrar onVerDiferencias diferenciasDe />`, `<PanelHistoria historias onEmpezar />`, `<BarraHistoria historia indice valores onAnterior onSiguiente onSalir />`.
  - `MapaSanGil` acepta `colorPor: 'diferencia'` con la prop `diferencias: Map<viaId, delta>`.

Se verifica en el navegador.

- [ ] **Step 1: Instalar Recharts**

Run: `npm install recharts@2`
Expected: se agrega `recharts` a `dependencies` sin errores.

- [ ] **Step 2: Agregar `cargar` a `src/ui/edicion/useEdicion.js`**

- En el import de `../../escenarios/historial.js`, agregar `historialDesdeEntradas` a la lista.
- En el objeto devuelto, después de `descartarTodo: …,` agregar:

```js
    cargar: (entradas) => {
      try {
        setHistorial(historialDesdeEntradas(base, entradas));
        setError(null);
        return true;
      } catch (err) {
        setError(`No se pudo cargar el escenario: ${err.message}`);
        return false;
      }
    },
```

- [ ] **Step 3: Crear los paneles**

`src/ui/paneles/PanelEscenarios.jsx`:

```jsx
import { useRef, useState } from 'react';

export default function PanelEscenarios({ guardados, precargados, onGuardar, onCargar, onBorrar, onExportar, onImportar }) {
  const [nombre, setNombre] = useState('');
  const archivo = useRef(null);

  const fila = (e, borrable) => (
    <li key={e.nombre}>
      <div>
        <strong>{e.nombre}</strong>
        {e.descripcion && <span>{e.descripcion}</span>}
        <span>{e.entradas.length} cambio(s){e.demanda.temporada !== 1 ? ` · temporada ×${String(e.demanda.temporada).replace('.', ',')}` : ''}{e.restriccionPesados ? ' · restricción' : ''}</span>
      </div>
      <div className="acciones">
        <button type="button" onClick={() => onCargar(e)}>Cargar</button>
        <button type="button" onClick={() => onExportar(e)} title="Descargar como archivo">⬇</button>
        {borrable && <button type="button" onClick={() => onBorrar(e.nombre)} aria-label={`Borrar ${e.nombre}`}>✕</button>}
      </div>
    </li>
  );

  return (
    <section className="panel escenarios">
      <h2>Escenarios</h2>
      <form
        className="campos"
        onSubmit={(ev) => { ev.preventDefault(); if (nombre.trim()) { onGuardar(nombre.trim()); setNombre(''); } }}
      >
        <label>
          <span>Guardar el estado actual como…</span>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Variante + puente nuevo" />
        </label>
        <button type="submit" className="principal" disabled={!nombre.trim()}>Guardar escenario</button>
      </form>

      <h3>Mis escenarios</h3>
      {guardados.length ? <ul className="lista-escenarios">{guardados.map((e) => fila(e, true))}</ul> : <p className="nota">Todavía no has guardado ninguno.</p>}
      <button type="button" onClick={() => archivo.current?.click()}>Importar archivo…</button>
      <input
        ref={archivo}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onImportar(await f.text());
        }}
      />

      <h3>Precargados</h3>
      <ul className="lista-escenarios">{precargados.map((e) => fila(e, false))}</ul>
      <p className="nota">La Variante y el puente propuesto usan trazados aproximados: puedes cambiarlos en el editor y guardar tu versión.</p>
    </section>
  );
}
```

`src/ui/paneles/PanelComparador.jsx`:

```jsx
import { useState } from 'react';

const DURACIONES = [[900, '15 min'], [1800, '30 min'], [3600, '1 hora']];
const SEMILLAS = [[1, '1 (rápido)'], [3, '3 (recomendado)'], [5, '5 (más confiable)']];

export default function PanelComparador({ escenarios, progreso, corriendo, onComparar, onCancelar }) {
  const [elegidos, setElegidos] = useState(() => escenarios.slice(0, 2).map((e) => e.nombre));
  const [duracion, setDuracion] = useState(1800);
  const [semillas, setSemillas] = useState(3);
  const alternar = (nombre) => setElegidos((l) => (l.includes(nombre) ? l.filter((x) => x !== nombre) : [...l, nombre]));

  return (
    <section className="panel comparador">
      <h2>Comparar escenarios</h2>
      <p className="nota">El primero que marques es la referencia. Todos corren con la misma duración y las mismas semillas, sin dibujar.</p>
      <fieldset className="campos">
        <legend>Escenarios</legend>
        {escenarios.map((e) => (
          <label key={e.nombre} className="opcion">
            <input type="checkbox" checked={elegidos.includes(e.nombre)} onChange={() => alternar(e.nombre)} />
            {e.nombre}
            {elegidos[0] === e.nombre && <em className="referencia"> (referencia)</em>}
          </label>
        ))}
      </fieldset>
      <div className="campos">
        <label>
          <span>Duración simulada</span>
          <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
            {DURACIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label>
          <span>Repeticiones con semillas distintas</span>
          <select value={semillas} onChange={(e) => setSemillas(Number(e.target.value))}>
            {SEMILLAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      </div>
      {corriendo ? (
        <div className="progreso">
          <progress max={progreso.total || 1} value={progreso.hechos} />
          <span>{progreso.hechos} de {progreso.total} corridas</span>
          <button type="button" onClick={onCancelar}>Cancelar</button>
        </div>
      ) : (
        <button
          type="button"
          className="principal ancho"
          disabled={elegidos.length < 2}
          onClick={() => onComparar(
            elegidos.map((n) => escenarios.find((e) => e.nombre === n)),
            { duracion, semillas: Array.from({ length: semillas }, (_, i) => i + 1) },
          )}
        >
          Comparar ({elegidos.length})
        </button>
      )}
    </section>
  );
}
```

`src/ui/paneles/ResultadosComparacion.jsx`:

```jsx
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { METRICAS_COMPARADAS, variacion } from '../../escenarios/comparar.js';
import { ETIQUETA_METRICA, formatearMetrica, formatearVariacion } from '../formato.js';

const COLORES = ['#1f6feb', '#d6453f', '#2ea043', '#8e44ad', '#e67e22', '#16a085'];

export default function ResultadosComparacion({ comparacion, red, onCerrar, onVerDiferencias, diferenciasDe }) {
  const { resultados, duracion, semillas } = comparacion;
  const [referencia] = resultados;
  const datosGrafica = referencia.serie.map((p, i) => {
    const fila = { minuto: Math.round(p.t / 60) };
    for (const r of resultados) fila[r.nombre] = Math.round(r.serie[i]?.demoraReciente ?? 0);
    return fila;
  });
  const clave = [...red.vias.values()].filter((v) => v.nombrePuente || v.tipo === 'variante');
  const usoClave = (r, filtro) => Math.round(clave.filter(filtro).reduce((s, v) => s + (r.vias[v.id]?.uso ?? 0), 0));

  return (
    <section className="panel resultados">
      <header>
        <div>
          <h2>Comparación</h2>
          <p className="subtitulo">{Math.round(duracion / 60)} min simulados · {semillas.length} semilla(s) · promedio (mínimo–máximo)</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar resultados">×</button>
      </header>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th />
              {resultados.map((r, i) => <th key={r.nombre}>{r.nombre}{i === 0 && <em> (ref.)</em>}</th>)}
            </tr>
          </thead>
          <tbody>
            {METRICAS_COMPARADAS.map((m) => (
              <tr key={m}>
                <th>{ETIQUETA_METRICA[m]}</th>
                {resultados.map((r, i) => (
                  <td key={r.nombre}>
                    {formatearMetrica(m, r.metricas[m].media)}
                    <small> ({formatearMetrica(m, r.metricas[m].min)}–{formatearMetrica(m, r.metricas[m].max)})</small>
                    {i > 0 && <span className="variacion">{formatearVariacion(variacion(referencia, r, m))}</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th>Pasos por puentes</th>
              {resultados.map((r) => <td key={r.nombre}>{usoClave(r, (v) => v.esPuente)}</td>)}
            </tr>
            <tr>
              <th>Pasos por la Variante</th>
              {resultados.map((r) => <td key={r.nombre}>{usoClave(r, (v) => v.tipo === 'variante')}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Demora de los últimos 10 min a lo largo de la corrida</h3>
      <div className="grafica">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={datosGrafica} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="minuto" unit=" min" fontSize={11} />
            <YAxis unit=" s" fontSize={11} width={52} />
            <Tooltip formatter={(v) => `${v} s`} labelFormatter={(m) => `Minuto ${m}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {resultados.map((r, i) => (
              <Line key={r.nombre} type="monotone" dataKey={r.nombre} stroke={COLORES[i % COLORES.length]} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="acciones">
        {resultados.slice(1).map((r) => (
          <button key={r.nombre} type="button" className={diferenciasDe === r.nombre ? 'activa' : ''} onClick={() => onVerDiferencias(r.nombre)}>
            Mapa: {r.nombre} vs. {referencia.nombre}
          </button>
        ))}
        {diferenciasDe && <button type="button" onClick={() => onVerDiferencias(null)}>Quitar mapa de diferencias</button>}
      </div>
      <p className="nota">Sin aforos reales, estos números sirven para comparar escenarios entre sí, no como pronóstico.</p>
    </section>
  );
}
```

`src/ui/paneles/PanelHistoria.jsx`:

```jsx
export default function PanelHistoria({ historias, onEmpezar }) {
  return (
    <section className="panel historia">
      <h2>Modo historia</h2>
      <p className="nota">
        Cada paso aplica sus cambios sobre la simulación en curso. Avanza con ▶ o con las flechas del teclado.
      </p>
      <ul className="lista-escenarios">
        {historias.map((h) => (
          <li key={h.nombre}>
            <div>
              <strong>{h.nombre}</strong>
              <span>{h.pasos.map((p) => p.titulo).join(' → ')}</span>
            </div>
            <div className="acciones">
              <button type="button" className="principal" onClick={() => onEmpezar(h)}>Empezar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

`src/ui/paneles/BarraHistoria.jsx`:

```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatearDuracion } from '../formato.js';

export default function BarraHistoria({ historia, indice, valores, onAnterior, onSiguiente, onSalir }) {
  const paso = historia.pasos[indice];
  const datos = historia.pasos.map((p, i) => ({ paso: i + 1, titulo: p.titulo, demora: Math.round(valores[i] ?? 0) }));

  return (
    <section className="barra-historia" aria-live="polite">
      <div className="historia-texto">
        <span className="historia-paso">Paso {indice + 1} de {historia.pasos.length}</span>
        <h2>{paso.titulo}</h2>
        <p>{paso.nota}</p>
        <div className="acciones">
          <button type="button" onClick={onAnterior} disabled={indice === 0}>◀ Anterior</button>
          <button type="button" className="principal" onClick={onSiguiente} disabled={indice === historia.pasos.length - 1}>Siguiente ▶</button>
          <button type="button" onClick={onSalir}>Salir</button>
        </div>
      </div>
      <div className="historia-grafica">
        <span>Demora (últimos 10 min) por paso</span>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={datos} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="paso" fontSize={11} />
            <YAxis unit=" s" fontSize={11} width={44} />
            <Tooltip formatter={(v) => formatearDuracion(v)} labelFormatter={(p) => datos[p - 1]?.titulo} />
            <Bar dataKey="demora">
              {datos.map((d, i) => <Cell key={d.paso} fill={i === indice ? '#1f6feb' : '#9aa5b1'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Mapa y leyenda con diferencias**

En `src/ui/mapa/MapaSanGil.jsx`:
- En el import de `./estilosVia.js`, agregar `colorDiferencia`.
- En la firma del componente, agregar `diferencias` a la lista de props.
- Reemplazar la línea `    return colorPor === 'congestion' ? colorCongestion(congestion.get(v.id)) : colorVia(v);` por:

```js
    if (colorPor === 'diferencia') return colorDiferencia(diferencias?.get(v.id));
    return colorPor === 'congestion' ? colorCongestion(congestion.get(v.id)) : colorVia(v);
```

- En `updateTriggers` de la capa `vias`, reemplazar `getColor: [seleccion, colorPor, congestion]` por `getColor: [seleccion, colorPor, congestion, diferencias]`.

En `src/ui/paneles/Leyenda.jsx`:
- En el import de `../mapa/estilosVia.js`, agregar `ESCALA_DIFERENCIA`.
- Reemplazar `<h2>{colorPor === 'congestion' ? 'Congestión' : 'Tipos de vía'}</h2>` por:

```jsx
      <h2>{{ congestion: 'Congestión', diferencia: 'Diferencia con la referencia' }[colorPor] ?? 'Tipos de vía'}</h2>
```

- Reemplazar la expresión `{colorPor === 'congestion' ? ESCALA_CONGESTION.map(…) : TIPOS_VIA.map(…)}` (el primer bloque dentro de `<ul>`) por:

```jsx
        {(colorPor === 'congestion' ? ESCALA_CONGESTION : colorPor === 'diferencia' ? ESCALA_DIFERENCIA : null)?.map(({ etiqueta, color }) => (
          <li key={etiqueta}><span className="muestra-linea" style={{ background: rgb(color) }} />{etiqueta}</li>
        )) ?? TIPOS_VIA.map((tipo) => (
          <li key={tipo}><span className="muestra-linea" style={{ background: rgb(COLOR_TIPO[tipo]) }} />{ETIQUETA_TIPO[tipo]}</li>
        ))}
```

- [ ] **Step 5: Reemplazar `src/ui/App.jsx`**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarDatosRed } from './datos/cargarRed.js';
import { cargarRios } from './datos/cargarRios.js';
import { crearRed } from '../sim/red.js';
import { prepararGeometria } from '../sim/geometriaArcos.js';
import { arcosEnCasco, rodeaElCasco } from '../sim/restriccion.js';
import { aplicarCambio } from '../escenarios/cambios.js';
import { activos } from '../escenarios/historial.js';
import {
  crearEscenario, exportarEscenario, importarEscenario, nombreArchivo,
  leerEscenarios, guardarEscenario, borrarEscenario, CLAVE_ESCENARIOS,
} from '../escenarios/escenario.js';
import { construirPrecargados } from '../escenarios/precargados.js';
import { diferenciasPorVia } from '../escenarios/comparar.js';
import { CASCO_URBANO, SALIDAS } from '../escenarios/zonas.js';
import { crearClienteSimulacion } from '../worker/clienteSimulacion.js';
import { crearClienteComparador } from '../worker/clienteComparador.js';
import { useEdicion } from './edicion/useEdicion.js';
import {
  crearDibujo, agregarPunto, quitarUltimo, cambiarAtributos, cambioDeDibujo, siguienteIdVia,
} from './edicion/dibujo.js';
import { descargarTexto } from './descargar.js';
import MapaSanGil from './mapa/MapaSanGil.jsx';
import Leyenda from './paneles/Leyenda.jsx';
import FichaVia from './paneles/FichaVia.jsx';
import FichaCruce from './paneles/FichaCruce.jsx';
import BarraTiempo from './paneles/BarraTiempo.jsx';
import PanelTrafico from './paneles/PanelTrafico.jsx';
import PanelMetricas from './paneles/PanelMetricas.jsx';
import PanelObras from './paneles/PanelObras.jsx';
import PanelDibujo from './paneles/PanelDibujo.jsx';
import PanelEscenarios from './paneles/PanelEscenarios.jsx';
import PanelComparador from './paneles/PanelComparador.jsx';
import ResultadosComparacion from './paneles/ResultadosComparacion.jsx';
import PanelHistoria from './paneles/PanelHistoria.jsx';
import BarraHistoria from './paneles/BarraHistoria.jsx';
import Confirmacion from './paneles/Confirmacion.jsx';
import './estilos.css';

const CONFIG_INICIAL = { factor: 1, temporada: 1, horaInicio: 7 };
const SIN_VEHICULOS = { cantidad: 0, datos: new Float64Array(0), t: 0 };
const PESTANAS = [['editar', 'Editar'], ['escenarios', 'Escenarios'], ['comparar', 'Comparar'], ['historia', 'Historia']];

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
    mensaje: 'La Variante todavía no conecta Socorro con Bucaramanga: traza los tramos que faltan hasta la Avenida, o carga el escenario precargado.',
  };
}

// Solo los campos de texto se quedan con los atajos; casillas y botones de opción no.
const escribiendo = () => {
  const el = document.activeElement;
  return el?.tagName === 'TEXTAREA' || (el?.tagName === 'INPUT' && ['text', 'number', 'search'].includes(el.type));
};

function leerGuardados() {
  try { return leerEscenarios(localStorage.getItem(CLAVE_ESCENARIOS)); } catch { return []; }
}

export default function App() {
  const [base, setBase] = useState(null);
  const [rios, setRios] = useState(null);
  const [error, setError] = useState(null);
  const edicion = useEdicion(base);
  const { datos } = edicion;
  const [seleccion, setSeleccion] = useState(null);
  const [modo, setModo] = useState('ver');
  const [dibujo, setDibujo] = useState(null);
  const [pestana, setPestana] = useState('editar');
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
  const [guardados, setGuardados] = useState(leerGuardados);
  const [comparacion, setComparacion] = useState(null);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 });
  const [comparando, setComparando] = useState(false);
  const [diferenciasDe, setDiferenciasDe] = useState(null);
  const [historia, setHistoria] = useState(null); // { historia, indice, valores }
  const cliente = useRef(null);
  const comparador = useRef(null);
  const datosEnviados = useRef(null);

  const red = useMemo(() => (datos ? crearRed(datos) : null), [datos]);
  const variante = useMemo(() => (datos ? estadoDeLaVariante(datos) : null), [datos]);
  const precargados = useMemo(() => (base && rios ? construirPrecargados(base, rios) : null), [base, rios]);
  const todosLosEscenarios = useMemo(() => [...(precargados?.escenarios ?? []), ...guardados], [precargados, guardados]);
  const diferencias = useMemo(() => {
    if (!comparacion || !diferenciasDe) return null;
    const otro = comparacion.resultados.find((r) => r.nombre === diferenciasDe);
    return otro ? diferenciasPorVia(comparacion.resultados[0], otro) : null;
  }, [comparacion, diferenciasDe]);

  useEffect(() => {
    cargarDatosRed().then(setBase).catch((err) => setError(err.message));
    cargarRios().then(setRios);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CLAVE_ESCENARIOS, JSON.stringify(guardados)); } catch { /* sin almacenamiento */ }
  }, [guardados]);

  // Worker del comparador: uno para toda la sesión.
  useEffect(() => {
    const c = crearClienteComparador((mensaje) => {
      if (mensaje.tipo === 'progreso') setProgreso({ hechos: mensaje.hechos, total: mensaje.total });
      else if (mensaje.tipo === 'resultado') { setComparacion(mensaje.resultado); setComparando(false); setDiferenciasDe(null); }
      else if (mensaje.tipo === 'error') { edicion.mostrarError(`El comparador falló: ${mensaje.mensaje}`); setComparando(false); }
    });
    comparador.current = c;
    return () => c.terminar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Worker de la simulación: se crea cuando la red está lista y en cada reinicio.
  const listo = Boolean(datos);
  useEffect(() => {
    if (!listo) return undefined;
    const c = crearClienteSimulacion((mensaje) => {
      if (mensaje.tipo === 'cuadro') {
        setVehiculos({ cantidad: mensaje.cantidad, datos: mensaje.datos, t: mensaje.t });
      } else if (mensaje.tipo === 'resumen') {
        setResumen(mensaje.resumen);
        setCongestion(new Map(mensaje.vias.map((x) => [x.viaId, x.ratio])));
        setHistoria((h) => {
          if (!h) return h;
          const valores = [...h.valores];
          valores[h.indice] = mensaje.resumen.demoraReciente;
          return { ...h, valores };
        });
      } else if (mensaje.tipo === 'error') {
        edicion.mostrarError(`La simulación reportó un error: ${mensaje.mensaje}`);
      }
    });
    c.iniciar(datos, { semilla: 1, demanda: config, restriccionPesados: restriccion });
    datosEnviados.current = datos;
    cliente.current = c;
    setCorriendo(false);
    setVehiculos(SIN_VEHICULOS);
    return () => c.terminar();
  }, [listo, reinicios]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!datos || !cliente.current || datos === datosEnviados.current) return;
    cliente.current.red(datos);
    datosEnviados.current = datos;
  }, [datos]);

  useEffect(() => { cliente.current?.reloj(corriendo, velocidad); }, [corriendo, velocidad, reinicios]);
  useEffect(() => { cliente.current?.restriccion(restriccion); }, [restriccion]);

  // Carga un escenario sobre la simulación en curso. La hora de inicio solo
  // cambia (y reinicia) si se pide, para no reiniciar en mitad de una historia.
  const aplicarEscenarioEnVivo = (escenario, { permitirReinicio = true } = {}) => {
    if (!edicion.cargar(escenario.entradas)) return false;
    const reiniciar = permitirReinicio && escenario.demanda.horaInicio !== config.horaInicio;
    const demanda = permitirReinicio ? escenario.demanda : { ...escenario.demanda, horaInicio: config.horaInicio };
    setConfig(demanda);
    setRestriccion(escenario.restriccionPesados);
    if (reiniciar) setReinicios((n) => n + 1);
    else cliente.current?.demanda({ factor: demanda.factor, temporada: demanda.temporada });
    setSeleccion(null);
    return true;
  };

  const escenarioActual = (nombre) => crearEscenario({
    nombre, entradas: edicion.historial.entradas.slice(0, edicion.historial.indice), demanda: config, restriccionPesados: restriccion,
  });

  const irAPaso = (indice) => {
    if (!historia) return;
    const i = Math.min(Math.max(indice, 0), historia.historia.pasos.length - 1);
    if (i === historia.indice) return;
    aplicarEscenarioEnVivo(historia.historia.pasos[i].escenario, { permitirReinicio: false });
    setHistoria((h) => (h ? { ...h, indice: i } : h));
  };

  const empezarHistoria = (h) => {
    setHistoria({ historia: h, indice: 0, valores: [] });
    aplicarEscenarioEnVivo(h.pasos[0].escenario, { permitirReinicio: false });
    setColorPor('congestion');
    setCorriendo(true);
  };

  const iniciarDibujo = (preset) => { setDibujo(crearDibujo(preset)); setModo('dibujar'); setSeleccion(null); };
  const cancelarDibujo = () => { setDibujo(null); setModo('ver'); };
  const terminarDibujo = () => {
    try {
      const cambio = cambioDeDibujo(dibujo, siguienteIdVia(datos), rios ?? []);
      let prefijo = cambio.atributos.esPuente ? 'Puente nuevo' : 'Vía nueva';
      if (dibujo.preset === 'variante') prefijo = cambio.atributos.esPuente ? 'Tramo de la Variante (con puente)' : 'Tramo de la Variante';
      const { nombre } = cambio.atributos;
      edicion.aplicar(cambio, nombre === prefijo ? prefijo : `${prefijo}: ${nombre}`);
      cancelarDibujo();
    } catch (err) {
      edicion.mostrarError(err.message);
    }
  };

  useEffect(() => {
    const alPresionar = (e) => {
      if (escribiendo() || edicion.pendiente || confirmarDescartar) return;
      if (historia && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        irAPaso(historia.indice + (e.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); edicion.deshacer(); }
      else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); edicion.rehacer(); }
      else if (e.key === 'Escape') {
        if (modo === 'dibujar') cancelarDibujo();
        else if (historia) setHistoria(null);
        else setSeleccion(null);
      }
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
  const colorEfectivo = diferencias ? 'diferencia' : colorPor;

  let panelPrincipal;
  if (modo === 'dibujar') {
    panelPrincipal = (
      <PanelDibujo
        dibujo={dibujo}
        rios={rios ?? []}
        onAtributos={(parcial) => setDibujo((d) => cambiarAtributos(d, parcial))}
        onQuitarUltimo={() => setDibujo(quitarUltimo)}
        onTerminar={terminarDibujo}
        onCancelar={cancelarDibujo}
      />
    );
  } else if (pestana === 'escenarios') {
    panelPrincipal = (
      <PanelEscenarios
        guardados={guardados}
        precargados={precargados?.escenarios ?? []}
        onGuardar={(nombre) => setGuardados((l) => guardarEscenario(l, escenarioActual(nombre)))}
        onCargar={(e) => aplicarEscenarioEnVivo(e)}
        onBorrar={(nombre) => setGuardados((l) => borrarEscenario(l, nombre))}
        onExportar={(e) => descargarTexto(nombreArchivo(e), exportarEscenario(e))}
        onImportar={(texto) => {
          try {
            const e = importarEscenario(texto, base);
            setGuardados((l) => guardarEscenario(l, e));
          } catch (err) {
            edicion.mostrarError(err.message);
          }
        }}
      />
    );
  } else if (pestana === 'comparar') {
    panelPrincipal = (
      <PanelComparador
        escenarios={todosLosEscenarios}
        progreso={progreso}
        corriendo={comparando}
        onComparar={(escenarios, opciones) => {
          setComparando(true);
          setProgreso({ hechos: 0, total: escenarios.length * opciones.semillas.length });
          comparador.current.comparar(base, escenarios, opciones);
        }}
        onCancelar={() => { comparador.current.cancelar(); setComparando(false); }}
      />
    );
  } else if (pestana === 'historia') {
    panelPrincipal = <PanelHistoria historias={precargados?.historias ?? []} onEmpezar={empezarHistoria} />;
  } else {
    panelPrincipal = (
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
    );
  }

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
          colorPor={colorEfectivo}
          congestion={congestion}
          diferencias={diferencias}
          seleccion={seleccion}
          onSeleccionar={setSeleccion}
          modo={modo}
          dibujo={dibujo}
          onClicMapa={(coordenada) => setDibujo((d) => agregarPunto(d, red, coordenada))}
          casco={restriccion ? CASCO_URBANO : null}
        />
        {historia && (
          <BarraHistoria
            historia={historia.historia}
            indice={historia.indice}
            valores={historia.valores}
            onAnterior={() => irAPaso(historia.indice - 1)}
            onSiguiente={() => irAPaso(historia.indice + 1)}
            onSalir={() => setHistoria(null)}
          />
        )}
        <aside className="lateral lateral-izq">
          {modo !== 'dibujar' && (
            <nav className="pestanas" aria-label="Secciones">
              {PESTANAS.map(([id, texto]) => (
                <button key={id} type="button" className={pestana === id ? 'activa' : ''} onClick={() => setPestana(id)}>{texto}</button>
              ))}
            </nav>
          )}
          {panelPrincipal}
          <PanelTrafico
            config={config}
            onCambiar={cambiarDemanda}
            colorPor={colorPor}
            onColorPor={(c) => { setColorPor(c); setDiferenciasDe(null); }}
            onReiniciar={() => setReinicios((n) => n + 1)}
          />
          <Leyenda colorPor={colorEfectivo} />
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
        {comparacion && (
          <ResultadosComparacion
            comparacion={comparacion}
            red={red}
            diferenciasDe={diferenciasDe}
            onVerDiferencias={setDiferenciasDe}
            onCerrar={() => { setComparacion(null); setDiferenciasDe(null); }}
          />
        )}
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

- [ ] **Step 6: Agregar estilos al final de `src/ui/estilos.css`**

```css
/* --- Etapa 4: escenarios, comparador e historia --- */

.pestanas {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 2px;
  background: var(--panel); border: 1px solid var(--borde); border-radius: 8px; padding: 3px;
}
.pestanas button { border: none; font-size: 12px; padding: 6px 4px; }

.lista-escenarios { list-style: none; margin: 6px 0; padding: 0; display: grid; gap: 6px; }
.lista-escenarios li {
  display: flex; justify-content: space-between; gap: 8px; align-items: center;
  border: 1px solid var(--borde); border-radius: 6px; padding: 6px 8px;
}
.lista-escenarios li > div:first-child { display: grid; gap: 2px; font-size: 13px; min-width: 0; }
.lista-escenarios li span { color: var(--tenue); font-size: 12px; }
.lista-escenarios .acciones { margin: 0; flex-shrink: 0; }
.lista-escenarios .acciones button { padding: 4px 8px; }

.comparador .referencia { color: var(--tenue); font-size: 12px; }
.progreso { display: grid; gap: 6px; font-size: 13px; }
.progreso progress { width: 100%; }

.resultados {
  position: absolute; left: 304px; right: 304px; bottom: 32px; z-index: 2;
  max-height: 55%; overflow-y: auto;
}
.resultados header { display: flex; justify-content: space-between; align-items: start; }
.resultados header button { border: none; background: none; font-size: 20px; color: var(--tenue); cursor: pointer; }
.tabla-scroll { overflow-x: auto; }
.resultados table { border-collapse: collapse; width: 100%; font-size: 12px; }
.resultados th, .resultados td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--borde); vertical-align: top; }
.resultados td small { color: var(--tenue); }
.resultados .variacion { display: block; font-weight: 600; }
.grafica { width: 100%; }

.barra-historia {
  position: absolute; left: 50%; transform: translateX(-50%); top: 12px; z-index: 3;
  width: min(720px, calc(100% - 24px)); display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px;
  background: var(--panel); border: 1px solid var(--borde); border-radius: 10px;
  padding: 12px 14px; box-shadow: 0 6px 20px rgb(0 0 0 / 0.15);
}
.historia-paso { font-size: 12px; color: var(--tenue); }
.barra-historia h2 { margin: 2px 0 4px; font-size: 18px; }
.barra-historia p { margin: 0 0 6px; font-size: 13px; }
.historia-grafica span { font-size: 12px; color: var(--tenue); }

@media (max-width: 900px) {
  .resultados { left: 12px; right: 12px; }
  .barra-historia { grid-template-columns: 1fr; }
  .historia-grafica { display: none; }
}
```

- [ ] **Step 7: Verificar en el navegador**

Run: `npm run dev` y abrir la dirección que muestra la terminal.

- [ ] Las pestañas Editar · Escenarios · Comparar · Historia cambian el panel izquierdo.
- [ ] Escenarios: "Cargar" en "Obra en el Rojas Pinilla" cierra el puente en el mapa y en la simulación. "Variante terminada con restricción" dibuja los tramos aproximados, activa la restricción y el panel de Obras dice que la Variante rodea el centro.
- [ ] Guardar el estado actual con un nombre lo agrega a "Mis escenarios". ⬇ descarga un `.json`; "Importar archivo…" con ese mismo archivo lo vuelve a agregar. Un archivo cualquiera muestra un error claro.
- [ ] Comparar: marcar "San Gil actual" y "Obra en el Rojas Pinilla", 15 min, 1 semilla. Mientras corre, la simulación en vivo sigue moviéndose. Aparece la tabla con promedio, rango y porcentaje; la gráfica de demora; y "Mapa: … vs. …" pinta las vías de verde y rojo. "Cancelar" durante una comparación la detiene y permite lanzar otra.
- [ ] Historia "Cómo mejora San Gil": "Empezar" arranca la simulación coloreada por congestión. ▶ y las flechas del teclado avanzan; cada paso cambia el mapa sin reiniciar el reloj; la gráfica de barras va mostrando la demora de cada paso. "Salir" o Esc la cierran.
- [ ] El panel de métricas muestra "Demora (últimos 10 min)" y "Retirados por cambios".
- [ ] La consola del navegador no muestra errores; a 375 px de ancho no hay barra de desplazamiento horizontal.

- [ ] **Step 8: Verificar tests y build**

Run: `npm test && npm run build`
Expected: PASS y `✓ built in ...`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/ui
git commit -m "feat(ui): escenarios, comparador con mapa de diferencias y modo historia"
```

---

### Task 9: Cierre de la etapa

**Files:**
- Modify: `README.md`, `.claude/contexto/estado.md`, `.claude/contexto/bitacora.md`, `.claude/contexto/decisiones.md`

- [ ] **Step 1: Actualizar `README.md`**

Agregar al final de la sección "Usar el simulador":

```markdown
### Escenarios, comparador e historia

- **Escenarios**: guarda el estado actual con un nombre, cárgalo después, descárgalo como
  archivo o importa uno. Hay escenarios precargados (temporada alta, obra en el Rojas
  Pinilla, Variante terminada, puente nuevo propuesto).
- **Comparar**: escoge dos o más escenarios; corren sin dibujar con la misma duración y
  varias semillas. Ves promedio y rango de cada métrica, la gráfica de demora y un mapa de
  dónde mejoró o empeoró el tráfico.
- **Historia**: la demo de clase paso a paso. Avanza con ▶ o las flechas del teclado; cada
  paso aplica sus cambios sobre la simulación en curso.

La Variante y el puente propuesto de los precargados usan trazados aproximados.
```

- [ ] **Step 2: Actualizar el contexto**

En `.claude/contexto/estado.md`: etapa actual "4 de 5 terminada — sigue la etapa 5 (Cómo funciona, ajustes, Vercel)"; plan activo "ninguno; falta escribir el de la etapa 5"; en "Hecho" agregar la etapa 4; en "Sigue": "Escribir el plan de la etapa 5"; en "Bloqueos / pendientes del usuario": "Lista real de vías con huecos/destapadas (hoy la Carrera 1ª es un SUPUESTO en `scripts/datos/correccionesCampo.js`)" y "Confirmar o redibujar el trazado de la Variante y la ubicación del puente propuesto".

En `.claude/contexto/decisiones.md` agregar:

```markdown
| 2026-10-08 | Escenario = cambios + demanda + restricción; precargados construidos desde la red base | Reproducibles y comparables |
| 2026-10-08 | Carrera 1ª destapada y con huecos como SUPUESTO de campo | La base Python preguntaba si "pavimentada alcanza como vía alterna"; OSM casi no trae estado |
| 2026-10-08 | Variante precargada: línea recta desde cada extremo suelto hasta la Avenida, 200 m por fuera del casco | Trazado aproximado; el usuario puede redibujarlo |
| 2026-10-08 | Puente propuesto: ≤160 m entre orillas, ≥300 m de los puentes existentes, el más cercano al centro | Ubicación aproximada para la historia; el usuario puede cambiarla |
| 2026-10-08 | Comparador en un worker aparte, misma duración y semillas 1..N, promedio y rango | Spec §7: "¿y si fue suerte?" sin congelar la simulación en vivo |
| 2026-10-08 | Historia y series usan la demora de los últimos 10 min | La demora acumulada tarda en reflejar un cambio en vivo |
```

En `.claude/contexto/bitacora.md` agregar una entrada con la fecha del día: "Etapa 4 completa: escenarios, comparador (worker aparte, mapa de diferencias) y modo historia".

- [ ] **Step 3: Commit**

```bash
git add README.md .claude/contexto
git commit -m "docs: cierre de la etapa 4"
```
