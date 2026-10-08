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
