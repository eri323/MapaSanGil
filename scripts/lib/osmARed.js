// Convierte la respuesta de Overpass en la red del modelo: los nodos son los
// cruces y extremos; las vías son los tramos entre dos nodos.

import { clasificarVia, esViaVehicular } from './clasificarVia.js';
import { distanciaMetros, longitudLinea } from '../../src/sim/geo.js';
import { JERARQUIA } from '../../src/sim/tipos.js';

const LONGITUD_MINIMA = 0.5; // metros; tramos más cortos son el mismo punto mapeado dos veces
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

// Un tramo que vuelve a su nodo de inicio se parte en un punto intermedio,
// para no perder calles en lazo ni el ojo de una "piruleta".
function partirLazo(tramo) {
  if (tramo[0] !== tramo[tramo.length - 1]) return [tramo];
  if (tramo.length < 3) return [];
  const medio = Math.floor(tramo.length / 2);
  return [tramo.slice(0, medio + 1), tramo.slice(medio)];
}

function cortarEnTramos(preparados) {
  const usos = new Map();
  for (const { ids } of preparados) {
    for (const id of ids) usos.set(id, (usos.get(id) ?? 0) + 1);
  }

  const tramos = [];
  for (const { way, atributos, ids } of preparados) {
    let inicio = 0;
    for (let i = 1; i < ids.length; i++) {
      const esCruce = i === ids.length - 1 || usos.get(ids[i]) >= 2;
      if (!esCruce) continue;
      for (const tramo of partirLazo(ids.slice(inicio, i + 1))) tramos.push({ way, atributos, ids: tramo });
      inicio = i;
    }
  }
  return tramos;
}

function crearUnion() {
  const padre = new Map();
  const raiz = (x) => {
    if (!padre.has(x)) padre.set(x, x);
    while (padre.get(x) !== x) {
      padre.set(x, padre.get(padre.get(x)));
      x = padre.get(x);
    }
    return x;
  };
  const unir = (a, b) => padre.set(raiz(a), raiz(b));
  return { raiz, unir };
}

function construirVias(tramos, nodosOsm, nombresPuentes) {
  const conGeometria = tramos.map((t) => {
    const geometria = t.ids.map((id) => [nodosOsm.get(id).lon, nodosOsm.get(id).lat]);
    return { ...t, geometria, longitud: longitudLinea(geometria) };
  });

  // Los tramos diminutos no se descartan: sus dos extremos pasan a ser el mismo cruce.
  const union = crearUnion();
  for (const t of conGeometria) {
    if (t.longitud < LONGITUD_MINIMA) union.unir(t.ids[0], t.ids[t.ids.length - 1]);
  }

  const vias = [];
  const tramoDeVia = new Map(); // viaId -> ids OSM del tramo, para ubicar los pares
  const contador = new Map();
  for (const t of conGeometria) {
    if (t.longitud < LONGITUD_MINIMA) continue;
    const desde = union.raiz(t.ids[0]);
    const hasta = union.raiz(t.ids[t.ids.length - 1]);
    if (desde === hasta) continue;
    const k = contador.get(t.way.id) ?? 0;
    contador.set(t.way.id, k + 1);
    const id = `v${t.way.id}_${k}`;
    const via = {
      id,
      osmId: t.way.id,
      ...t.atributos,
      desde: `n${desde}`,
      hasta: `n${hasta}`,
      geometria: t.geometria,
      longitud: Math.round(t.longitud * 10) / 10,
      abierta: true,
    };
    if (nombresPuentes[t.way.id]) via.nombrePuente = nombresPuentes[t.way.id];
    vias.push(via);
    tramoDeVia.set(id, t.ids);
  }
  return { vias, tramoDeVia };
}

function componenteMayor(vias) {
  const union = crearUnion();
  for (const v of vias) union.unir(v.desde, v.hasta);
  const conteo = new Map();
  for (const v of vias) {
    const r = union.raiz(v.desde);
    conteo.set(r, (conteo.get(r) ?? 0) + 1);
  }
  let mejor = null;
  for (const [r, n] of conteo) if (mejor === null || n > conteo.get(mejor)) mejor = r;
  return vias.filter((v) => union.raiz(v.desde) === mejor);
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

// Cruce que controla una señal de pare puesta sobre la vía: el extremo hacia
// el que circula el tráfico afectado, nunca el cruce de salida.
function extremosQueControla(via, direccion) {
  if (via.sentido === 'adelante') return [via.hasta];
  if (direccion === 'forward') return [via.hasta];
  if (direccion === 'backward') return [via.desde];
  return [via.desde, via.hasta];
}

function aplicarPares(nodos, vias, tramoDeVia, nodosOsm) {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  const viasPorNodoOsm = new Map();
  for (const v of vias) {
    for (const idOsm of tramoDeVia.get(v.id)) {
      if (!viasPorNodoOsm.has(idOsm)) viasPorNodoOsm.set(idOsm, []);
      viasPorNodoOsm.get(idOsm).push(v);
    }
  }

  const marcados = new Set();
  for (const [idOsm, el] of nodosOsm) {
    if (el.tags?.highway !== 'stop') continue;
    const punto = [el.lon, el.lat];
    let mejor = null;
    for (const via of viasPorNodoOsm.get(idOsm) ?? []) {
      for (const idNodo of extremosQueControla(via, el.tags.direction)) {
        const nodo = porId.get(idNodo);
        const distancia = distanciaMetros(punto, [nodo.lon, nodo.lat]);
        if (!mejor || distancia < mejor.distancia) mejor = { nodo, via, distancia };
      }
    }
    if (!mejor || mejor.distancia > RADIO_PARE) continue;
    const { nodo, via } = mejor;
    nodo.control = 'pare';
    nodo.accesosConPare ??= [];
    if (!nodo.accesosConPare.includes(via.id)) nodo.accesosConPare.push(via.id);
    marcados.add(nodo.id);
  }
  return marcados.size;
}

export function osmARed(overpass, { nombresPuentes = {} } = {}) {
  const { nodosOsm, ways } = leerElementos(overpass);
  const tramos = cortarEnTramos(prepararWays(ways, nodosOsm));
  const { vias: todas, tramoDeVia } = construirVias(tramos, nodosOsm, nombresPuentes);
  const vias = componenteMayor(todas);
  const nodos = construirNodos(vias, nodosOsm);
  const pares = aplicarPares(nodos, vias, tramoDeVia, nodosOsm);
  return { nodos, vias, descartadas: todas.length - vias.length, pares };
}
