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
