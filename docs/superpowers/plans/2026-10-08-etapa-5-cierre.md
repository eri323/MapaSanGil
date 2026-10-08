# Etapa 5 · "Cómo funciona", ajustes y publicación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el simulador listo para presentar y sustentar: una pestaña "Cómo funciona" con modelos, fórmulas, parámetros, supuestos y limitaciones tomados del propio código; los ajustes pendientes de las revisiones que afectan la demo; un build liviano; la app publicada en Vercel con un link; y una guía de la demo.

**Architecture:** El contenido de "Cómo funciona" se arma en un módulo puro (`src/ui/comoFunciona/contenido.js`) que importa las constantes reales del motor, para que lo que se explica nunca se desfase del código. Los ajustes son cambios pequeños con su prueba. La publicación usa la integración de Vercel con el repositorio de GitHub: cada push a `main` publica.

**Tech Stack:** Node 24, Vite 5, React 18, deck.gl 9.0, Recharts 2, Vitest 2, Vercel. JavaScript, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-08-simulador-trafico-sangil-design.md` (secciones 7 "Pestaña Cómo funciona", 8, 12, 13)

Etapa 5 de 5.

## Global Constraints

- JavaScript, **no TypeScript**.
- `src/sim/` y `src/escenarios/` no importan React ni APIs del navegador.
- "Cómo funciona" muestra **los valores del código**, no copias escritas a mano.
- Las limitaciones se dicen de frente: el modelo **no está calibrado** con aforos y sirve para comparar escenarios entre sí.
- Atribución visible: "© colaboradores de OpenStreetMap (ODbL)".
- Textos de la interfaz en español de Colombia.
- Publicar es una acción hacia afuera: se hace en la cuenta de Vercel del usuario, enlazada a `eri323/MapaSanGil`.

## Review Focus

1. Un escenario sin viajes completados (todo cerrado): tiempos y demoras se muestran como "—", no como "0 s", y la variación no da "−100 %" (test en Task 2).
2. Un vehículo esperando para entrar a una vía que se cerró: no queda esperando para siempre; cuenta como bloqueo (test en Task 1).
3. Invertir dos veces una vía que tenía pare: el pare vuelve a aplicar (test en Task 3).
4. Guardar o importar un escenario con el nombre de uno precargado: queda con otro nombre, sin duplicados (test en Task 3).
5. El sitio publicado carga la red, los ríos y los workers (rutas relativas a la base); se verifica abriendo el link en Task 7.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/sim/motor.js`, `src/worker/controlador.js` | Vehículos que esperan demasiado para entrar; error en un paso sin colgar el worker |
| `src/sim/metricas.js`, `src/escenarios/comparar.js` | Sin viajes completados → sin dato (`null`) |
| `src/sim/red.js`, `src/escenarios/cambios.js` | El pare se conserva mientras la vía toque el cruce |
| `src/escenarios/escenario.js` | Nombres de escenario sin choques con los precargados |
| `src/ui/comoFunciona/contenido.js`, `src/ui/comoFunciona/ComoFunciona.jsx` | Pestaña "Cómo funciona" |
| `src/ui/App.jsx`, `src/ui/paneles/PanelObras.jsx`, `src/ui/paneles/BarraHistoria.jsx`, `src/ui/edicion/useEdicion.js`, `src/ui/estilos.css` | Ajustes de interfaz |
| `vite.config.js` | Build en partes |
| `docs/guia-demo.md`, `README.md`, `.claude/contexto/*` | Guía de la demo y cierre |

---

### Task 1: Vehículos que no pueden entrar y errores del worker

**Files:**
- Modify: `src/sim/motor.js`, `src/worker/controlador.js`
- Test: `tests/sim/motorCambios.test.js`, `tests/worker/controlador.test.js`

**Interfaces:**
- Produces: `VALORES_POR_DEFECTO = { dt: 0.5, umbralBloqueo: 180, intervaloReruteo: 90 }` exportado por `motor.js` (lo usa la Task 4). Un vehículo pendiente más de `umbralBloqueo` segundos se descarta y cuenta como bloqueo. `crearControlador(enviar, { ahora, presupuestoMs, crearMotorFn = crearMotor })`; si `motor.paso()` lanza en un tick, se envía `{ tipo: 'error' }` y la simulación se pausa.

- [ ] **Step 1: Escribir los tests**

Al final de `tests/sim/motorCambios.test.js`:

```js
describe('motor · vehículos que no pueden entrar', () => {
  it('si su primera vía está cerrada, después del umbral cuenta como bloqueo y deja de esperar', () => {
    const red = crearRed(datosRedLinea());
    const motor = crearMotor(red, { conDemanda: false, umbralBloqueo: 10 });
    red.vias.get('t0').abierta = false;
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(5);
    expect(motor.resumen().pendientes).toBe(1);
    motor.avanzar(10);
    expect(motor.resumen()).toMatchObject({ pendientes: 0, bloqueos: 1 });
  });
});
```

Al final de `tests/worker/controlador.test.js`:

```js
describe('crearControlador · error dentro de un paso', () => {
  it('avisa el error y pausa en vez de repetirlo en cada tick', () => {
    const enviados = [];
    const motorQueFalla = () => ({
      dt: 0.5, t: 0,
      paso: () => { throw new Error('falla interna'); },
      posiciones: () => ({ cantidad: 0, datos: new Float64Array(0) }),
      resumen: () => ({}),
      estadoVias: () => [],
    });
    const c = crearControlador((m) => enviados.push(m), { ahora: () => 0, presupuestoMs: 35, crearMotorFn: motorQueFalla });
    c.recibir({ tipo: 'iniciar', datosRed: datosRedLinea(), opciones: {} });
    c.recibir({ tipo: 'reloj', corriendo: true, velocidad: 20 });
    c.tick(50);
    c.tick(50);
    const errores = enviados.filter((m) => m.tipo === 'error');
    expect(errores).toHaveLength(1);
    expect(errores[0].mensaje).toMatch(/falla interna/);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/sim/motorCambios.test.js tests/worker/controlador.test.js`
Expected: FAIL: el pendiente sigue esperando; el error sale de `tick` sin capturarse.

- [ ] **Step 3: Implementar**

En `src/sim/motor.js`:
- Después de `const DISTANCIA_LLEGADA = 40; …` agregar:

```js
export const VALORES_POR_DEFECTO = { dt: 0.5, umbralBloqueo: 180, intervaloReruteo: 90 };
```

- En la desestructuración de `opciones`, reemplazar `semilla = 1, dt = 0.5, umbralBloqueo = 180, intervaloReruteo = 90,` por:

```js
    semilla = 1, dt = VALORES_POR_DEFECTO.dt, umbralBloqueo = VALORES_POR_DEFECTO.umbralBloqueo,
    intervaloReruteo = VALORES_POR_DEFECTO.intervaloReruteo,
```

- En `intentarInsertar`, reemplazar `      if (carril === -1) { restantes.push(veh); continue; }` por:

```js
      if (carril === -1) {
        // Quien no logra entrar en mucho tiempo (vía cerrada o llena) cuenta como bloqueo.
        if (t - veh.tSalida > umbralBloqueo) metricas.bloqueo();
        else restantes.push(veh);
        continue;
      }
```

En `src/worker/controlador.js`:
- Reemplazar la firma `export function crearControlador(enviar, { ahora = () => performance.now(), presupuestoMs = 35 } = {}) {` por:

```js
export function crearControlador(enviar, { ahora = () => performance.now(), presupuestoMs = 35, crearMotorFn = crearMotor } = {}) {
```

- Reemplazar `motor = crearMotor(crearRed(mensaje.datosRed), mensaje.opciones);` por `motor = crearMotorFn(crearRed(mensaje.datosRed), mensaje.opciones);`.
- Reemplazar el cuerpo de `tick` por:

```js
    tick(ms) {
      if (!motor || !corriendo) return;
      const inicio = ahora();
      const n = reloj.pasos(velocidad, ms, motor.dt);
      try {
        for (let k = 0; k < n; k++) {
          motor.paso();
          if (ahora() - inicio > presupuestoMs) break;
        }
      } catch (err) {
        // Se pausa para no repetir el mismo error 20 veces por segundo.
        corriendo = false;
        enviar({ tipo: 'error', mensaje: `La simulación se detuvo: ${err.message}` });
        return;
      }
      enviarCuadro();
      if (ahora() - ultimoResumen >= 1000) enviarResumen();
    },
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/sim/motorCambios.test.js tests/worker/controlador.test.js` y luego `npm test`
Expected: PASS en ambos.

- [ ] **Step 5: Commit**

```bash
git add src/sim/motor.js src/worker/controlador.js tests/sim/motorCambios.test.js tests/worker/controlador.test.js
git commit -m "fix(sim): vehículos que no pueden entrar cuentan como bloqueo; el worker se pausa ante un error"
```

---

### Task 2: Sin viajes completados no hay dato

**Files:**
- Modify: `src/sim/metricas.js`, `src/escenarios/comparar.js`
- Test: `tests/sim/metricas.test.js`, `tests/escenarios/comparar.test.js`

**Interfaces:**
- Produces: en `metricas.resumen()`, `tiempoMedio`, `demoraMedia`, `demoraReciente` y `tiempoReciente` valen `null` cuando no hay viajes que promediar. En `resumirCorridas`, `media`, `min` y `max` de una métrica son `null` si ninguna corrida tiene valor; la serie promedia solo valores con dato.

`formatearDuracion(null)` ya muestra "—" y `variacion` ya devuelve `null` si algún lado no es un número.

- [ ] **Step 1: Escribir los tests**

En `tests/sim/metricas.test.js`, en el test "sin viajes todo es cero", cambiar el nombre a `'sin viajes no hay promedios'` y, en el objeto esperado, reemplazar `tiempoMedio: 0, demoraMedia: 0, demoraTotalVh: 0, demoraReciente: 0, tiempoReciente: 0,` por `tiempoMedio: null, demoraMedia: null, demoraTotalVh: 0, demoraReciente: null, tiempoReciente: null,`.

Al final de `tests/escenarios/comparar.test.js`:

```js
describe('resumir corridas sin viajes completados', () => {
  it('las duraciones quedan sin dato y la variación no se puede calcular', () => {
    const vacia = { resumen: { viajesCompletados: 0, tiempoMedio: null, demoraMedia: null, demoraTotalVh: 0, bloqueos: 3, viajesImposibles: 9 }, serie: [{ t: 60, demoraReciente: null, enRed: 0 }], vias: new Map() };
    const r = resumirCorridas('Todo cerrado', [vacia, vacia]);
    expect(r.metricas.demoraMedia).toEqual({ media: null, min: null, max: null });
    expect(r.metricas.bloqueos).toEqual({ media: 3, min: 3, max: 3 });
    expect(r.serie[0].demoraReciente).toBeNull();
    const ref = { metricas: { demoraMedia: { media: 40, min: 40, max: 40 } } };
    expect(variacion(ref, r, 'demoraMedia')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/sim/metricas.test.js tests/escenarios/comparar.test.js`
Expected: FAIL: hoy devuelven 0.

- [ ] **Step 3: Implementar**

En `src/sim/metricas.js`:
- Reemplazar `      const promedio = (campo) => (n ? recientes.reduce((s, x) => s + x[campo], 0) / n : 0);` por `      const promedio = (campo) => (n ? recientes.reduce((s, x) => s + x[campo], 0) / n : null);`.
- Reemplazar `        tiempoMedio: completados ? sumaDuracion / completados : 0,` por `        tiempoMedio: completados ? sumaDuracion / completados : null,`.
- Reemplazar `        demoraMedia: completados ? sumaDemora / completados : 0,` por `        demoraMedia: completados ? sumaDemora / completados : null,`.

En `src/escenarios/comparar.js`:
- Reemplazar la línea `const promedio = (valores) => (valores.length ? valores.reduce((s, x) => s + x, 0) / valores.length : 0);` por:

```js
// Promedio, mínimo y máximo de los valores con dato; null si ninguno tiene.
const conDato = (valores) => valores.filter((x) => Number.isFinite(x));
const promedio = (valores) => {
  const v = conDato(valores);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const minimo = (valores) => (conDato(valores).length ? Math.min(...conDato(valores)) : null);
const maximo = (valores) => (conDato(valores).length ? Math.max(...conDato(valores)) : null);
```

- Reemplazar `    metricas[clave] = { media: promedio(valores), min: Math.min(...valores), max: Math.max(...valores) };` por `    metricas[clave] = { media: promedio(valores), min: minimo(valores), max: maximo(valores) };`.
- Reemplazar `    demoraReciente: promedio(corridas.map((c) => c.serie[i]?.demoraReciente ?? 0)),` por `    demoraReciente: promedio(corridas.map((c) => c.serie[i]?.demoraReciente)),`.
- Reemplazar `    enRed: promedio(corridas.map((c) => c.serie[i]?.enRed ?? 0)),` por `    enRed: promedio(corridas.map((c) => c.serie[i]?.enRed)),`.

En `src/ui/paneles/ResultadosComparacion.jsx`, reemplazar `    for (const r of resultados) fila[r.nombre] = Math.round(r.serie[i]?.demoraReciente ?? 0);` por:

```js
    for (const r of resultados) {
      const v = r.serie[i]?.demoraReciente;
      fila[r.nombre] = Number.isFinite(v) ? Math.round(v) : null;
    }
```

En `src/ui/formato.js`, como primera línea de `formatearMetrica`, agregar `  if (!Number.isFinite(valor)) return '—';`.

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/sim/metricas.test.js tests/escenarios/comparar.test.js` y luego `npm test`
Expected: PASS en ambos.

- [ ] **Step 5: Commit**

```bash
git add src/sim/metricas.js src/escenarios/comparar.js src/ui/paneles/ResultadosComparacion.jsx src/ui/formato.js tests
git commit -m "fix(escenarios): sin viajes completados las duraciones quedan sin dato"
```

---

### Task 3: Pares que sobreviven a invertir una vía y nombres sin choques

**Files:**
- Modify: `src/sim/red.js`, `src/escenarios/cambios.js`, `src/escenarios/escenario.js`
- Test: `tests/escenarios/cambios.test.js`, `tests/sim/red.test.js`, `tests/escenarios/escenario.test.js`

**Interfaces:**
- Produces: `accesosConPare` puede nombrar cualquier vía que **toque** el cruce (por un extremo); el pare solo actúa si esa vía llega al cruce (eso ya lo hace `cruces.js`). `nombreDisponible(nombre, existentes) → string`; `nombreParaGuardar(nombre, nombresPrecargados, nombresGuardados) → string` en `escenario.js`.

- [ ] **Step 1: Escribir los tests**

En `tests/escenarios/cambios.test.js`, reemplazar el test `'quita el pare de un acceso que ya no llega al cruce'` completo por:

```js
  it('conserva el pare al invertir la vía, y vuelve a aplicar al invertirla otra vez', () => {
    const datos = datosRedLinea();
    nodoDe(datos, 'n2').control = 'pare';
    nodoDe(datos, 'n2').accesosConPare = ['t1'];
    const una = aplicarCambio(datos, { tipo: 'invertirVia', viaId: 't1' });
    expect(nodoDe(una, 'n2').accesosConPare).toEqual(['t1']);
    expect(validarRed(una)).toEqual([]);
    const dos = aplicarCambio(una, { tipo: 'invertirVia', viaId: 't1' });
    expect(nodoDe(dos, 'n2').accesosConPare).toEqual(['t1']);
  });

  it('quita el pare de una vía que ya no toca el cruce', () => {
    const datos = datosRedLinea();
    nodoDe(datos, 'n2').control = 'pare';
    nodoDe(datos, 'n2').accesosConPare = ['t1', 't0'];
    const r = aplicarCambio(datos, { tipo: 'via', viaId: 't1', propiedades: { estado: 'regular' } });
    expect(nodoDe(r, 'n2').accesosConPare).toEqual(['t1']);
  });
```

En `tests/sim/red.test.js`, reemplazar el test `'accesosConPare debe nombrar vías que llegan a ese nodo'` por:

```js
  it('accesosConPare debe nombrar vías que tocan ese nodo', () => {
    const d = datos();
    d.nodos[1].accesosConPare = ['ab'];
    expect(validarRed(d)).toEqual([]);
    d.nodos[0].accesosConPare = ['ab']; // a es el inicio de ab: la toca aunque no llegue
    expect(validarRed(d)).toEqual([]);
    d.nodos[1].accesosConPare = ['zzz'];
    expect(validarRed(d).join('\n')).toContain('zzz');
  });
```

Al final de `tests/escenarios/escenario.test.js`:

```js
import { nombreDisponible, nombreParaGuardar } from '../../src/escenarios/escenario.js';

describe('nombres de escenario', () => {
  it('nombreDisponible agrega un número si el nombre ya existe', () => {
    expect(nombreDisponible('A', ['B'])).toBe('A');
    expect(nombreDisponible('A', ['A', 'A (2)'])).toBe('A (3)');
  });

  it('un precargado nunca se pisa; uno propio con el mismo nombre se reemplaza', () => {
    expect(nombreParaGuardar('Temporada alta', ['Temporada alta'], [])).toBe('Temporada alta (2)');
    expect(nombreParaGuardar('Mi prueba', ['Temporada alta'], ['Mi prueba'])).toBe('Mi prueba');
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run tests/escenarios/cambios.test.js tests/sim/red.test.js tests/escenarios/escenario.test.js`
Expected: FAIL: el pare se pierde al invertir; `validarRed` rechaza una vía que solo sale del nodo; no existen las funciones de nombres.

- [ ] **Step 3: Implementar**

En `src/sim/red.js`, reemplazar el bloque que arma `llegadas`:

```js
  const llegadas = new Map(); // nodoId -> vías que pueden llegar a él
  for (const v of datos.vias) {
    for (const extremo of v.sentido === 'ambos' ? [v.desde, v.hasta] : [v.hasta]) {
      if (!llegadas.has(extremo)) llegadas.set(extremo, new Set());
      llegadas.get(extremo).add(v.id);
    }
  }
```

por:

```js
  // Un pare puede quedar anotado en una vía que hoy no llega al cruce (por ejemplo,
  // tras invertirla); solo actúa cuando llega. Basta con que la vía toque el nodo.
  const llegadas = new Map(); // nodoId -> vías que tocan el nodo
  for (const v of datos.vias) {
    for (const extremo of [v.desde, v.hasta]) {
      if (!llegadas.has(extremo)) llegadas.set(extremo, new Set());
      llegadas.get(extremo).add(v.id);
    }
  }
```

y reemplazar el mensaje `` `Nodo ${n.id}: el pare apunta a la vía ${viaId}, que no llega a ese cruce` `` por `` `Nodo ${n.id}: el pare apunta a la vía ${viaId}, que no toca ese cruce` ``.

En `src/escenarios/cambios.js`, en `limpiarPares`, reemplazar:

```js
    for (const n of v.sentido === 'ambos' ? [v.desde, v.hasta] : [v.hasta]) {
```

por:

```js
    for (const n of [v.desde, v.hasta]) {
```

y el comentario de la función `// Quita de los pares por acceso las vías que ya no llegan a ese cruce.` por `// Quita de los pares por acceso las vías que ya no tocan ese cruce.`.

Al final de `src/escenarios/escenario.js`:

```js
export function nombreDisponible(nombre, existentes) {
  if (!existentes.includes(nombre)) return nombre;
  let k = 2;
  while (existentes.includes(`${nombre} (${k})`)) k += 1;
  return `${nombre} (${k})`;
}

// Un escenario propio con el mismo nombre se reemplaza; un precargado nunca.
export function nombreParaGuardar(nombre, nombresPrecargados, nombresGuardados) {
  if (!nombresPrecargados.includes(nombre)) return nombre;
  return nombreDisponible(nombre, [...nombresPrecargados, ...nombresGuardados]);
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run tests/escenarios/cambios.test.js tests/sim/red.test.js tests/escenarios/escenario.test.js` y luego `npm test`
Expected: PASS en ambos.

- [ ] **Step 5: Commit**

```bash
git add src/sim/red.js src/escenarios/cambios.js src/escenarios/escenario.js tests
git commit -m "fix(escenarios): el pare sobrevive a invertir una vía; nombres de escenario sin choques"
```

---

### Task 4: Contenido de "Cómo funciona"

**Files:**
- Create: `src/ui/comoFunciona/contenido.js`
- Modify: `src/sim/rutas.js` (exportar `PESO_NUEVA_MEDIDA`)
- Test: `tests/ui/contenidoComoFunciona.test.js`

**Interfaces:**
- Consumes: constantes de `vehiculos.js`, `mobil.js`, `cruces.js`, `demanda.js`, `rutas.js`, `metricas.js`, `motor.js` (`VALORES_POR_DEFECTO`, Task 1), `zonas.js`, `tipos.js`.
- Produces: `construirContenido({ vias?, cruces? }) → { secciones: Seccion[] }` con `Seccion = { id, titulo, texto: string[], formula?: string, tabla?: { columnas: string[], filas: (string|number)[][] }, lista?: string[] }`.

- [ ] **Step 1: Escribir el test**

`tests/ui/contenidoComoFunciona.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { construirContenido } from '../../src/ui/comoFunciona/contenido.js';
import { TIPOS_VEHICULO, PERFILES } from '../../src/sim/vehiculos.js';
import { DEMANDA_BASE } from '../../src/sim/demanda.js';

const { secciones } = construirContenido({ vias: 2158, cruces: 1622 });
const seccion = (id) => secciones.find((s) => s.id === id);

describe('contenido de "Cómo funciona"', () => {
  it('cada sección tiene id único, título y texto', () => {
    expect(new Set(secciones.map((s) => s.id)).size).toBe(secciones.length);
    for (const s of secciones) {
      expect(s.titulo).toBeTruthy();
      expect(s.texto.length).toBeGreaterThan(0);
      for (const p of s.texto) expect(p.trim()).not.toBe('');
    }
  });

  it('la red dice cuántas vías y cruces tiene', () => {
    expect(seccion('red').texto.join(' ')).toMatch(/2\.158 vías/);
    expect(seccion('red').texto.join(' ')).toMatch(/1\.622 cruces/);
  });

  it('la tabla de vehículos sale de los perfiles del motor', () => {
    const { tabla } = seccion('vehiculos');
    expect(tabla.filas).toHaveLength(TIPOS_VEHICULO.length);
    const moto = tabla.filas.find((f) => f[0] === 'Moto');
    expect(moto).toContain(`${Math.round(PERFILES.moto.vMax * 3.6)} km/h`);
    expect(moto).toContain(`${String(PERFILES.moto.largo).replace('.', ',')} m`);
  });

  it('el efecto de los huecos y el total de la demanda coinciden con el código', () => {
    expect(seccion('estado').tabla.filas.flat().join(' ')).toMatch(/Con huecos.*×0,5/);
    const total = Object.values(DEMANDA_BASE).reduce((s, x) => s + x, 0);
    expect(seccion('demanda').texto.join(' ')).toContain(total.toLocaleString('es-CO'));
  });

  it('incluye la fórmula del IDM, supuestos, limitaciones y referencias', () => {
    expect(seccion('idm').formula).toMatch(/v\/v0/);
    expect(seccion('supuestos').lista.join(' ')).toMatch(/Carrera 1ª/);
    expect(seccion('limitaciones').lista.join(' ')).toMatch(/calibrado/);
    const refs = seccion('referencias').lista.join(' ');
    for (const autor of ['Treiber', 'Kesting', 'Dijkstra', 'OpenStreetMap']) expect(refs).toContain(autor);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run tests/ui/contenidoComoFunciona.test.js`
Expected: FAIL, no se puede resolver el módulo.

- [ ] **Step 3: Exportar `PESO_NUEVA_MEDIDA`**

En `src/sim/rutas.js`, reemplazar `const PESO_NUEVA_MEDIDA = 0.3;` por `export const PESO_NUEVA_MEDIDA = 0.3;`.

- [ ] **Step 4: Implementar `src/ui/comoFunciona/contenido.js`**

```js
// Contenido de la pestaña "Cómo funciona". Los números salen de las constantes
// del motor: si el código cambia, la explicación cambia con él.

import {
  TIPOS_VEHICULO, ETIQUETA_VEHICULO, PERFILES, FACTOR_ESTADO, FACTOR_SUPERFICIE,
} from '../../sim/vehiculos.js';
import { ETIQUETA_ESTADO, ETIQUETA_SUPERFICIE } from '../../sim/tipos.js';
import { MOBIL } from '../../sim/mobil.js';
import { CICLO_SEMAFORO, ESPERA_CORTESIA } from '../../sim/cruces.js';
import { DEMANDA_BASE, MEZCLA_LOCAL, MEZCLA_PASO, PERFIL_HORARIO } from '../../sim/demanda.js';
import { PESO_NUEVA_MEDIDA } from '../../sim/rutas.js';
import { VENTANA_RECIENTE } from '../../sim/metricas.js';
import { VALORES_POR_DEFECTO } from '../../sim/motor.js';
import { CASCO_URBANO } from '../../escenarios/zonas.js';

const decimal = (x) => String(x).replace('.', ',');
const miles = (x) => Number(x).toLocaleString('es-CO');
const kmh = (ms) => `${Math.round(ms * 3.6)} km/h`;
const pct = (x) => `${Math.round(x * 100)} %`;
const mezcla = (m) => Object.entries(m).map(([tipo, p]) => `${pct(p)} ${ETIQUETA_VEHICULO[tipo].toLowerCase()}`).join(', ');

const NOMBRE_FLUJO = {
  local: 'Local (dentro del municipio)',
  paso: 'De paso (carros y motos)',
  pesado: 'Pesados de paso (camiones)',
  busNacional: 'Buses nacionales a la Terminal',
  busPaso: 'Buses nacionales de paso',
  intermunicipal: 'Buses intermunicipales al Terminalito',
};

export function construirContenido({ vias = null, cruces = null } = {}) {
  const { dt, umbralBloqueo, intervaloReruteo } = VALORES_POR_DEFECTO;
  const totalDemanda = Object.values(DEMANDA_BASE).reduce((s, x) => s + x, 0);
  const horaPico = PERFIL_HORARIO.indexOf(Math.max(...PERFIL_HORARIO));

  const secciones = [
    {
      id: 'objetivo',
      titulo: 'Para qué sirve',
      texto: [
        'El simulador muestra cómo funcionaría mejor o peor el tráfico de San Gil con distintos cambios: cerrar un puente, terminar la Variante, arreglar vías, cambiar sentidos o poner pares.',
        'Cada vehículo se simula por separado (modelo microscópico). Los números sirven para comparar escenarios entre sí, con las mismas condiciones, no para predecir tiempos exactos.',
      ],
    },
    {
      id: 'red',
      titulo: 'La red vial',
      texto: [
        `La red sale de OpenStreetMap: ${vias ? `${miles(vias)} vías` : 'las vías'} y ${cruces ? `${miles(cruces)} cruces` : 'los cruces'} de San Gil y sus salidas. Cada vía tiene tipo, sentido, carriles, superficie, estado y velocidad máxima.`,
        'Sobre OpenStreetMap se aplican correcciones de campo (por ejemplo, la Calle 12 entre Carreras 10 y 11 habilitada y los nombres reales de los puentes). San Gil no tiene semáforos: los cruces se controlan con pare, prioridad o la regla de la derecha.',
      ],
    },
    {
      id: 'vehiculos',
      titulo: 'Los vehículos',
      texto: ['Cada tipo tiene su propio comportamiento. Además, cada conductor maneja hasta 10 % más rápido o más lento que el promedio.'],
      tabla: {
        columnas: ['Tipo', 'Largo', 'Velocidad máx.', 'Aceleración', 'Frenado cómodo', 'Tiempo de seguridad', 'Hueco para cruzar'],
        filas: TIPOS_VEHICULO.map((tipo) => {
          const p = PERFILES[tipo];
          return [ETIQUETA_VEHICULO[tipo], `${decimal(p.largo)} m`, kmh(p.vMax), `${decimal(p.a)} m/s²`, `${decimal(p.b)} m/s²`, `${decimal(p.T)} s`, `${decimal(p.hueco)} s`];
        }),
      },
    },
    {
      id: 'idm',
      titulo: 'Cómo se mueve cada vehículo: IDM',
      texto: [
        'Con el Intelligent Driver Model (IDM), cada vehículo acelera hacia la velocidad que quiere y frena según la distancia y la velocidad del de adelante. De ahí salen solas las colas y el efecto acordeón.',
        `La simulación avanza en pasos de ${decimal(dt)} s y nunca frena más de 9 m/s², el límite físico de un frenado de emergencia.`,
      ],
      formula: 'a = a_max · [ 1 − (v/v0)⁴ − (s*/s)² ]\ns* = s0 + v·T + v·Δv / (2·√(a_max·b))\n\nv: velocidad · v0: velocidad deseada · s: distancia al de adelante\nΔv: diferencia de velocidad con el de adelante · s0: distancia mínima parado',
    },
    {
      id: 'estado',
      titulo: 'El estado de la vía',
      texto: [
        'El estado y la superficie multiplican la velocidad deseada. Con huecos, además, cada conductor reacciona distinto (unos esquivan despacio, otros pasan rápido): entre 0,7 y 1,3 veces el efecto.',
        'Por eso, al arreglar una vía, su tiempo de viaje baja y los conductores empiezan a usarla.',
      ],
      tabla: {
        columnas: ['Condición', 'Multiplica la velocidad por'],
        filas: [
          ...Object.entries(FACTOR_ESTADO).map(([k, f]) => [`Estado: ${ETIQUETA_ESTADO[k]}`, `×${decimal(f)}`]),
          ...Object.entries(FACTOR_SUPERFICIE).map(([k, f]) => [`Superficie: ${ETIQUETA_SUPERFICIE[k]}`, `×${decimal(f)}`]),
        ],
      },
    },
    {
      id: 'carriles',
      titulo: 'Cambio de carril: MOBIL',
      texto: [
        `Donde hay más de un carril, un vehículo cambia si gana más de ${decimal(MOBIL.umbral)} m/s² de aceleración, teniendo en cuenta a los demás con un factor de cortesía de ${decimal(MOBIL.cortesia)}, y nunca si obliga al de atrás a frenar más de ${MOBIL.frenadoSeguro} m/s².`,
      ],
    },
    {
      id: 'cruces',
      titulo: 'Los cruces',
      texto: ['En cada cruce, cada vía que llega tiene una regla:'],
      lista: [
        'Pare: el vehículo se detiene por completo y luego espera un hueco suficiente.',
        'Prioridad: la vía de mayor jerarquía (Avenida y Variante, luego doble calzada, doble sentido y un sentido) pasa sin parar; la otra cede.',
        'Glorieta: quien circula en la glorieta tiene prioridad.',
        'Sin señal entre vías iguales: se cede al que viene por la derecha.',
        `Semáforo (solo si se agrega en el editor): ${CICLO_SEMAFORO.verde} s de verde por grupo y ${CICLO_SEMAFORO.todoRojo} s de todo rojo.`,
        `Ceder es aceptar un hueco: se cruza si el próximo vehículo con prelación tarda más que el hueco del tipo (tabla de vehículos). Tras ${ESPERA_CORTESIA} s esperando, se pasa por cortesía si el cruce está libre.`,
      ],
    },
    {
      id: 'rutas',
      titulo: 'Las rutas',
      texto: [
        'Cada viaje escoge la ruta más rápida con el algoritmo de Dijkstra, usando el tiempo de viaje que se está midiendo en cada vía, no solo el teórico.',
        `Cada vez que un vehículo sale de una vía, su tiempo actualiza la medida de esa vía (la nueva pesa ${pct(PESO_NUEVA_MEDIDA)}). Los vehículos recalculan su ruta cada ${intervaloReruteo} s, así que descubren poco a poco una vía arreglada o un puente nuevo.`,
        `Restricción de pesados de paso: con la Variante terminada, camiones y buses de paso solo pueden usar Avenida y Variante por fuera de un círculo de ${miles(CASCO_URBANO.radio)} m alrededor del Parque La Libertad. Si la Variante no conecta, pasan por el centro como hoy.`,
      ],
    },
    {
      id: 'demanda',
      titulo: 'La demanda de viajes',
      texto: [
        `En una hora de referencia se generan ${miles(totalDemanda)} viajes, repartidos así. La cantidad cambia con la hora del día (el pico es a las ${horaPico}:00) y con la temporada (alta = ×1,4).`,
        `Locales: ${mezcla(MEZCLA_LOCAL)}. De paso: ${mezcla(MEZCLA_PASO)}.`,
      ],
      tabla: {
        columnas: ['Flujo', 'Viajes por hora'],
        filas: Object.entries(DEMANDA_BASE).map(([f, v]) => [NOMBRE_FLUJO[f] ?? f, miles(v)]),
      },
    },
    {
      id: 'metricas',
      titulo: 'Las métricas',
      lista: [
        'Tiempo medio de viaje: de la salida a la llegada, de los viajes completados.',
        'Demora: cuánto tardó cada viaje por encima de lo que tardaría con las vías libres.',
        `Demora de los últimos ${VENTANA_RECIENTE / 60} min: la misma demora, solo de los viajes recientes; refleja pronto un cambio hecho en vivo.`,
        `Bloqueo: un vehículo quieto más de ${umbralBloqueo} s se retira y se cuenta. Es un síntoma de colapso (equivale al "teleport" de SUMO).`,
        'Retirados por cambios: vehículos que iban por una vía que se editó en vivo (por ejemplo, se invirtió).',
        'Viajes imposibles: no había ruta entre su origen y su destino.',
      ],
      texto: ['Estas son las métricas que muestran el panel y el comparador:'],
    },
    {
      id: 'comparador',
      titulo: 'Cómo se comparan escenarios',
      texto: [
        'Cada escenario corre sin dibujar, con la misma duración y las mismas semillas (la semilla fija la parte aleatoria). Se reporta el promedio entre semillas y su rango (mínimo–máximo).',
        'Así se responde "¿y si fue suerte?": si los rangos de dos escenarios no se tocan, la diferencia no es casualidad.',
      ],
    },
    {
      id: 'supuestos',
      titulo: 'Supuestos',
      texto: ['Lo que no viene de OpenStreetMap ni de trabajo de campo es un supuesto razonable:'],
      lista: [
        'Los volúmenes de viajes y su reparto por hora (no hay aforos).',
        'La Carrera 1ª destapada y con huecos (la base Python preguntaba si "pavimentada alcanza como vía alterna"); falta la lista real de vías en mal estado.',
        'El trazado de la Variante en los escenarios precargados: une con líneas aproximadas el tramo de OpenStreetMap con la Avenida a cada lado.',
        'La ubicación del puente propuesto: un cruce corto sobre el Fonce, lejos de los puentes existentes.',
        `El casco urbano para la restricción: un círculo de ${miles(CASCO_URBANO.radio)} m.`,
        'Los parámetros de cada tipo de vehículo y el efecto de los huecos.',
      ],
    },
    {
      id: 'limitaciones',
      titulo: 'Limitaciones',
      texto: ['Hay que decirlas antes de citar cualquier número:'],
      lista: [
        'El modelo no está calibrado con aforos reales. Estaría calibrado si los flujos simulados quedaran dentro de ±15 % de conteos reales en al menos 85 % de los puntos (criterio GEH < 5).',
        'OpenStreetMap está incompleto en San Gil: faltan sentidos, pares y el estado de casi todas las vías.',
        'Las motos no se cuelan entre carriles; solo son más cortas y ágiles.',
        'No hay tráfico inducido: si una obra mejora los tiempos, no aparecen viajes nuevos.',
        'No hay peatones, parqueo en vía ni cargue y descargue.',
      ],
    },
    {
      id: 'referencias',
      titulo: 'Referencias',
      texto: ['Modelos y datos usados:'],
      lista: [
        'Treiber, M., Hennecke, A. y Helbing, D. (2000). Congested traffic states in empirical observations and microscopic simulations. Physical Review E, 62, 1805–1824.',
        'Kesting, A., Treiber, M. y Helbing, D. (2007). General lane-changing model MOBIL for car-following models. Transportation Research Record, 1999, 86–94.',
        'Dijkstra, E. W. (1959). A note on two problems in connexion with graphs. Numerische Mathematik, 1, 269–271.',
        'Lopez, P. A. et al. (2018). Microscopic traffic simulation using SUMO. IEEE ITSC. (Base Python original del proyecto.)',
        'Datos de la red: © colaboradores de OpenStreetMap, licencia ODbL.',
      ],
    },
  ];
  return { secciones };
}
```

- [ ] **Step 5: Correr y verificar que pasa**

Run: `npx vitest run tests/ui/contenidoComoFunciona.test.js` y luego `npm test`
Expected: PASS en ambos.

- [ ] **Step 6: Commit**

```bash
git add src/ui/comoFunciona/contenido.js src/sim/rutas.js tests/ui/contenidoComoFunciona.test.js
git commit -m "feat(ui): contenido de \"Cómo funciona\" tomado de las constantes del motor"
```

---

### Task 5: Pestaña "Cómo funciona" y ajustes de interfaz

**Files:**
- Create: `src/ui/comoFunciona/ComoFunciona.jsx`
- Modify: `src/ui/App.jsx`, `src/ui/paneles/PanelObras.jsx`, `src/ui/paneles/BarraHistoria.jsx`, `src/ui/edicion/useEdicion.js`, `src/ui/estilos.css`

**Interfaces:**
- Consumes: `construirContenido` (Task 4); `nombreParaGuardar` (Task 3).
- Produces: `<ComoFunciona red onCerrar />`; `PanelObras` recibe `onTerminarVariante` en vez de llamar a `onRestriccion(true)`.

Ajustes que entran (de las revisiones de las etapas 3 y 4):
- La restricción de pesados se activa solo cuando la Variante **de verdad** quedó terminada (si el cambio se cancela o falla, no).
- Si el navegador no deja guardar escenarios o cambios, se avisa y se sugiere descargarlos.
- Guardar o importar con el nombre de un precargado no lo duplica.
- La gráfica de la historia dice a qué hora empiezan las corridas controladas.

Se verifica en el navegador.

- [ ] **Step 1: Crear `src/ui/comoFunciona/ComoFunciona.jsx`**

```jsx
import { useMemo } from 'react';
import { construirContenido } from './contenido.js';

export default function ComoFunciona({ red, onCerrar }) {
  const { secciones } = useMemo(() => construirContenido({ vias: red.vias.size, cruces: red.nodos.size }), [red]);
  return (
    <div className="como-funciona" role="dialog" aria-modal="true" aria-labelledby="como-funciona-titulo">
      <div className="como-funciona-contenido">
        <header>
          <h1 id="como-funciona-titulo">Cómo funciona el simulador</h1>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">×</button>
        </header>
        <nav className="indice" aria-label="Secciones">
          {secciones.map((s) => <a key={s.id} href={`#cf-${s.id}`}>{s.titulo}</a>)}
        </nav>
        {secciones.map((s) => (
          <section key={s.id} id={`cf-${s.id}`}>
            <h2>{s.titulo}</h2>
            {s.texto.map((p) => <p key={p}>{p}</p>)}
            {s.formula && <pre className="formula">{s.formula}</pre>}
            {s.lista && <ul>{s.lista.map((x) => <li key={x}>{x}</li>)}</ul>}
            {s.tabla && (
              <div className="tabla-scroll">
                <table>
                  <thead><tr>{s.tabla.columnas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {s.tabla.filas.map((fila) => (
                      <tr key={fila[0]}>{fila.map((celda, i) => <td key={`${fila[0]}-${i}`}>{celda}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `PanelObras` delega la terminación de la Variante**

En `src/ui/paneles/PanelObras.jsx`:
- En la lista de props de la función, reemplazar `datos, variante, restriccion, onRestriccion, onCambio, onIniciarDibujo,` por `datos, variante, restriccion, onRestriccion, onCambio, onIniciarDibujo, onTerminarVariante,`.
- Reemplazar:

```jsx
        onClick={() => {
          onCambio({ tipo: 'terminarObra', viaIds: variante.enObra }, 'Variante terminada');
          onRestriccion(true);
        }}
```

por:

```jsx
        onClick={onTerminarVariante}
```

- [ ] **Step 3: Aviso si el navegador no deja guardar los cambios del editor**

En `src/ui/edicion/useEdicion.js`, reemplazar:

```js
    try { localStorage.setItem(CLAVE, serializar(historial)); } catch { /* el navegador no deja guardar */ }
```

por:

```js
    try {
      localStorage.setItem(CLAVE, serializar(historial));
    } catch {
      setError('El navegador no dejó guardar tus cambios. Guárdalos como escenario y descárgalos (⬇) para no perderlos.');
    }
```

- [ ] **Step 4: La historia dice a qué hora empiezan las corridas**

En `src/ui/paneles/BarraHistoria.jsx`, reemplazar:

```jsx
            <span>Demora media por paso ({Math.round(controlado.duracion / 60)} min simulados, {controlado.semillas.length} semillas)</span>
```

por:

```jsx
            <span>
              Demora media por paso ({Math.round(controlado.duracion / 60)} min simulados desde las{' '}
              {String(historia.pasos[0].escenario.demanda.horaInicio).padStart(2, '0')}:00, {controlado.semillas.length} semillas)
            </span>
```

- [ ] **Step 5: Ajustes en `src/ui/App.jsx`**

1. En el import de `../escenarios/escenario.js`, agregar `nombreParaGuardar` a la lista.
2. Agregar el import `import ComoFunciona from './comoFunciona/ComoFunciona.jsx';` después del import de `Confirmacion`.
3. Después de `const pedidoHistoria = useRef(null); …` agregar:

```js
  const terminandoVariante = useRef(false); // la restricción se activa cuando la Variante de verdad quedó terminada
  const [verComoFunciona, setVerComoFunciona] = useState(false);
```

4. Reemplazar:

```js
    try { localStorage.setItem(CLAVE_ESCENARIOS, JSON.stringify(guardados)); } catch { /* sin almacenamiento */ }
```

por:

```js
    try {
      localStorage.setItem(CLAVE_ESCENARIOS, JSON.stringify(guardados));
    } catch {
      edicion.mostrarError('El navegador no dejó guardar tus escenarios. Descárgalos (⬇) para no perderlos.');
    }
```

5. Después del `useEffect` que llama a `cliente.current?.restriccion(restriccion)`, agregar:

```js
  // "Terminar la Variante" activa la restricción solo si el cambio se aplicó
  // (si quedó en confirmación y se canceló, o falló, no).
  useEffect(() => {
    if (terminandoVariante.current && variante && variante.enObra.length === 0) {
      terminandoVariante.current = false;
      setRestriccion(true);
    }
  }, [variante]);
```

6. Antes de `const iniciarDibujo = …`, agregar:

```js
  const terminarVariante = () => {
    terminandoVariante.current = true;
    edicion.aplicar({ tipo: 'terminarObra', viaIds: variante.enObra }, 'Variante terminada');
  };
```

7. En `<PanelObras … />`, agregar la prop `onTerminarVariante={terminarVariante}`.
8. En `<Confirmacion titulo="Este cambio desconecta parte de la red" …>`, reemplazar `onCancelar={edicion.cancelar}` por `onCancelar={() => { terminandoVariante.current = false; edicion.cancelar(); }}`.
9. En el botón "Entendido" del aviso de error, reemplazar `onClick={edicion.limpiarError}` por `onClick={() => { terminandoVariante.current = false; edicion.limpiarError(); }}`.
10. En `onGuardar` del `PanelEscenarios`, reemplazar `onGuardar={(nombre) => setGuardados((l) => guardarEscenario(l, escenarioActual(nombre)))}` por:

```jsx
        onGuardar={(nombre) => setGuardados((l) => guardarEscenario(l, escenarioActual(
          nombreParaGuardar(nombre, (precargados?.escenarios ?? []).map((e) => e.nombre), l.map((e) => e.nombre)),
        )))}
```

11. En `onImportar`, reemplazar `            setGuardados((l) => guardarEscenario(l, e));` por:

```jsx
            setGuardados((l) => guardarEscenario(l, {
              ...e,
              nombre: nombreParaGuardar(e.nombre, (precargados?.escenarios ?? []).map((x) => x.nombre), l.map((x) => x.nombre)),
            }));
```

12. En el `useEffect` de teclas, reemplazar `      if (escribiendo() || edicion.pendiente || confirmarDescartar) return;` por:

```js
      if (verComoFunciona) {
        if (e.key === 'Escape') setVerComoFunciona(false);
        return;
      }
      if (escribiendo() || edicion.pendiente || confirmarDescartar) return;
```

13. En el `<header className="barra">`, después de `<h1>Simulador de tráfico · San Gil</h1>`, agregar:

```jsx
        <button type="button" className="enlace-ayuda" onClick={() => setVerComoFunciona(true)}>Cómo funciona</button>
```

14. Antes del cierre `</div>` final del componente (después del bloque `{confirmarDescartar && …}`), agregar:

```jsx
      {verComoFunciona && <ComoFunciona red={red} onCerrar={() => setVerComoFunciona(false)} />}
```

- [ ] **Step 6: Estilos al final de `src/ui/estilos.css`**

```css
/* --- Etapa 5: Cómo funciona --- */

.enlace-ayuda { margin-right: auto; margin-left: 12px; }

.como-funciona {
  position: fixed; inset: 0; z-index: 20; background: rgb(0 0 0 / 0.4);
  display: flex; justify-content: center; padding: 24px 16px; overflow-y: auto;
}
.como-funciona-contenido {
  background: var(--panel); border-radius: 12px; max-width: 860px; width: 100%;
  padding: 20px 24px 32px; box-shadow: 0 12px 40px rgb(0 0 0 / 0.25); height: fit-content;
}
.como-funciona header { display: flex; justify-content: space-between; align-items: center; }
.como-funciona header h1 { margin: 0; font-size: 22px; }
.como-funciona header button { border: none; background: none; font-size: 26px; color: var(--tenue); cursor: pointer; }
.como-funciona .indice { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 12px 0 8px; font-size: 13px; }
.como-funciona section { border-top: 1px solid var(--borde); padding-top: 12px; margin-top: 16px; }
.como-funciona h2 { font-size: 17px; margin: 0 0 8px; }
.como-funciona p, .como-funciona li { font-size: 14px; line-height: 1.55; }
.como-funciona .formula {
  background: #f3f5f8; border-radius: 8px; padding: 10px 12px; font-size: 13px; overflow-x: auto; white-space: pre;
}
.como-funciona table { border-collapse: collapse; width: 100%; font-size: 13px; }
.como-funciona th, .como-funciona td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--borde); }

@media (max-width: 640px) {
  .como-funciona { padding: 0; }
  .como-funciona-contenido { border-radius: 0; padding: 16px; }
}
```

- [ ] **Step 7: Verificar en el navegador**

Run: `npm run dev` y abrir la dirección que muestra la terminal.

- [ ] "Cómo funciona" en la barra superior abre la explicación. Las tablas de vehículos, estado de la vía y demanda tienen los valores del código. Esc y × la cierran.
- [ ] En Editar, "Terminar la Variante" con el escenario actual (la Variante no conecta) termina la obra y activa la restricción. Con un cambio que pida confirmación y se cancele, la restricción no se activa.
- [ ] Guardar un escenario llamado "Temporada alta" lo guarda como "Temporada alta (2)".
- [ ] La gráfica de la historia dice "desde las 07:00".
- [ ] La consola no muestra errores; a 375 px "Cómo funciona" ocupa toda la pantalla y se puede desplazar.

- [ ] **Step 8: Verificar tests y build**

Run: `npm test && npm run build`
Expected: PASS y `✓ built in ...`.

- [ ] **Step 9: Commit**

```bash
git add src/ui
git commit -m "feat(ui): pestaña \"Cómo funciona\" y ajustes de la revisión"
```

---

### Task 6: Build en partes

**Files:**
- Modify: `vite.config.js`

- [ ] **Step 1: Verificar el aviso actual**

Run: `npm run build`
Expected: aparece "(!) Some chunks are larger than 500 kB".

- [ ] **Step 2: Separar las librerías grandes**

Reemplazar el contenido completo de `vite.config.js` por:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // El mapa (MapLibre) pesa ~800 kB solo; separado, el navegador lo guarda en caché.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          mapa: ['maplibre-gl', 'react-map-gl/maplibre'],
          deck: ['@deck.gl/core', '@deck.gl/layers', '@deck.gl/react', '@deck.gl/extensions'],
          graficas: ['recharts'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 3: Verificar el build y la app compilada**

Run: `npm run build`
Expected: `✓ built in ...` sin el aviso de tamaño, y varios archivos en `dist/assets/` (`mapa-*.js`, `deck-*.js`, `graficas-*.js`, `react-*.js`).

Run: `npx vite preview --port 4173` y abrir http://localhost:4173.
Expected: la app carga, simula y abre "Cómo funciona" igual que en desarrollo. Detener el servidor.

- [ ] **Step 4: Commit**

```bash
git add vite.config.js
git commit -m "build: separar mapa, deck.gl, gráficas y React en partes"
```

---

### Task 7: Publicar en Vercel

**Files:** ninguno (configuración en Vercel).

Publicar es una acción hacia afuera en la cuenta del usuario: si `list_teams` devuelve más de un equipo, **preguntar en cuál** antes de crear el proyecto.

- [ ] **Step 1: Subir `main` a GitHub**

Run: `git checkout main && git merge --no-ff <rama de la etapa> && npm test && git push origin main`
Expected: push sin errores.

- [ ] **Step 2: Escoger el equipo**

Cargar las herramientas con ToolSearch: `select:mcp__claude_ai_Vercel__list_teams,mcp__claude_ai_Vercel__create_git_project,mcp__claude_ai_Vercel__list_deployments,mcp__claude_ai_Vercel__get_deployment,mcp__claude_ai_Vercel__list_projects`.

Llamar `list_teams`. Con un solo equipo, usarlo; con varios, preguntar al usuario.

- [ ] **Step 3: Crear el proyecto enlazado al repositorio**

Llamar `list_projects` con `repo: "MapaSanGil"` y el `teamId` escogido. Si ya existe un proyecto enlazado, usarlo. Si no, llamar `create_git_project` con `repo: "eri323/MapaSanGil"`, `teamId` y `projectName: "mapa-sangil"`.

Vercel detecta Vite solo: comando `npm run build`, salida `dist`. No hace falta `vercel.json`.

Si `create_git_project` falla porque la cuenta de Vercel no tiene acceso al repositorio de GitHub, indicar al usuario que lo importe en https://vercel.com/new (botón "Import" junto a `eri323/MapaSanGil`, sin cambiar nada) y continuar con el Step 4 cuando confirme.

- [ ] **Step 4: Esperar el despliegue de producción**

Llamar `list_deployments` con el proyecto y `target: "production"`; si todavía no hay uno de producción (el primero puede ser de vista previa), hacer un push vacío a `main` (`git commit --allow-empty -m "chore: publicar en Vercel" && git push`) y volver a listar. Consultar con `get_deployment` hasta que el estado sea `READY` (o `ERROR`: en ese caso, leer el error del build, corregir la causa y repetir).

Expected: un despliegue `READY` con su URL de producción (`https://mapa-sangil….vercel.app`).

- [ ] **Step 5: Verificar el sitio publicado**

Abrir la URL de producción en el navegador (Playwright):
- [ ] La app carga sin pedir inicio de sesión de Vercel (si pide, la URL es de vista previa protegida: usar la de producción).
- [ ] `…/data/red-sangil.json` y `…/data/rios.json` responden 200.
- [ ] ▶ Simular mueve vehículos (el worker carga).
- [ ] "Cómo funciona", el comparador (15 min, 1 semilla) y la historia funcionan.
- [ ] La consola no muestra errores.

- [ ] **Step 6: Anotar la URL**

En `README.md`, debajo del título, agregar `**En línea:** <URL de producción>` y hacer commit:

```bash
git add README.md
git commit -m "docs: enlace del sitio publicado"
git push origin main
```

---

### Task 8: Guía de la demo y cierre del proyecto

**Files:**
- Create: `docs/guia-demo.md`
- Modify: `.claude/contexto/estado.md`, `.claude/contexto/bitacora.md`, `.claude/contexto/decisiones.md`

- [ ] **Step 1: Crear `docs/guia-demo.md`**

```markdown
# Guía de la demo y la sustentación

## Antes de la clase

1. Abre el link publicado (README) en el computador de la presentación, con internet.
2. Ve a **Historia** y dale **Empezar** a "Cómo mejora San Gil". La primera vez calcula la
   comparación controlada de los pasos (unos minutos); queda guardada en ese navegador.
   Hazlo antes de clase para que en vivo salga al instante. Luego dale **Salir**.
3. Si vas a usar tus propios cambios (por ejemplo, tu trazado de la Variante), guárdalos como
   escenario y descárgalos (⬇) como respaldo.

## Guion (unos 10 minutos)

1. **El mapa** (1 min). San Gil real desde OpenStreetMap: tipos de vía, sentidos, los cinco
   puentes. "No hay semáforos: pares, prioridad y la regla de la derecha."
2. **El tráfico** (1 min). ▶ Simular a ×5. Colorear por congestión. Señalar los cuellos de
   botella en el panel.
3. **Un cambio en vivo** (1 min). Clic en el Puente Rojas Pinilla → Cerrar vía. La Calle 15 se
   vuelve el cuello de botella. Ctrl+Z para deshacer.
4. **La historia** (4 min). Historia → "Cómo mejora San Gil". Avanza con →:
   - Temporada alta: la demora sube.
   - Puente nuevo: baja un poco; el tráfico se reparte entre orillas.
   - Variante con restricción: baja fuerte; los camiones salen del centro.
   - Vías arregladas: casi no cambia → es un hallazgo (ver preguntas).
   La gráfica de barras es una comparación controlada, no la corrida en vivo.
5. **Cómo se llegó a los números** (2 min). Comparar → escoge dos escenarios: mismas semillas,
   promedio y rango. Mapa de diferencias en verde y rojo.
6. **Cómo funciona** (1 min). Abre la pestaña: IDM, MOBIL, Dijkstra, supuestos y limitaciones.

## Preguntas que pueden hacer

- **¿Estos tiempos son reales?** No: el modelo no está calibrado con aforos. Sirve para comparar
  escenarios entre sí con las mismas condiciones. Para calibrarlo harían falta conteos en los
  puentes (criterio GEH < 5).
- **¿Y si la diferencia fue suerte?** Cada escenario corre con varias semillas; si los rangos no
  se tocan, la diferencia no es casualidad.
- **¿Por qué arreglar vías casi no ayudó?** Con el supuesto actual (Carrera 1ª), arreglarla no
  atrae tráfico suficiente porque no está en las rutas más usadas. Con la lista real de vías en mal
  estado el resultado podría cambiar; también puede ser un hallazgo: no toda obra ayuda.
- **¿Cómo deciden la ruta los carros?** La más rápida según el tiempo que se está midiendo en cada
  vía; la recalculan cada 90 s, por eso "descubren" una vía arreglada poco a poco.
- **¿La Variante es la real?** El tramo en construcción sale de OpenStreetMap; los tramos que
  faltan son un trazado aproximado. Se puede redibujar en el editor.
- **¿Qué hizo la IA?** Ayudó a diseñar y escribir el código por etapas; las decisiones, los datos
  de campo y la validación de cada etapa quedaron documentados en `.claude/contexto/` y
  `docs/superpowers/`.
```

- [ ] **Step 2: Cerrar el contexto**

En `.claude/contexto/estado.md`: etapa actual "5 de 5 terminada — proyecto listo para la demo"; plan activo "ninguno"; en "Hecho" agregar la etapa 5 con la URL publicada; en "Sigue": "Ensayar la demo con `docs/guia-demo.md`; cargar la lista real de vías con huecos cuando esté".

En `.claude/contexto/decisiones.md` agregar:

```markdown
| 2026-10-08 | "Cómo funciona" se arma desde las constantes del motor | La explicación no se desfasa del código |
| 2026-10-08 | Sin viajes completados, tiempos y demoras quedan sin dato (—) | Un 0 o un −100 % engañarían en la comparación |
| 2026-10-08 | El pare anotado en una vía se conserva mientras la vía toque el cruce | Invertir dos veces no debe perder el pare |
| 2026-10-08 | Publicación en Vercel enlazada a GitHub: cada push a main publica | Spec §12 |
```

En `.claude/contexto/bitacora.md` agregar una entrada con la fecha del día: "Etapa 5 completa: Cómo funciona, ajustes, build en partes, publicado en Vercel (<URL>), guía de la demo".

- [ ] **Step 3: Commit y push**

```bash
git add docs/guia-demo.md .claude/contexto
git commit -m "docs: guía de la demo y cierre del proyecto"
git push origin main
```
