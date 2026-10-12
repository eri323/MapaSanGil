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

// Quita de los pares por acceso las vías que ya no tocan ese cruce.
function limpiarPares(datos) {
  const llegan = new Map();
  for (const v of datos.vias) {
    for (const n of [v.desde, v.hasta]) {
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
  // Si los dos extremos caen sobre la misma vía, el primero ya la partió:
  // el segundo se ubica en la mitad que le queda más cerca.
  let extremoFin = extremos[1];
  if (extremoFin.tipo === 'via' && extremoFin.via === extremos[0].via && inicio.nodo === `n-${id}-0`) {
    const mitades = ['a', 'b'].map((lado) => inicio.datos.vias.find((v) => v.id === `${extremoFin.via}~${inicio.nodo}${lado}`));
    const distancia = (v) => proyectarEnLinea(v.geometria, extremoFin.punto).distancia;
    const cercana = distancia(mitades[0]) <= distancia(mitades[1]) ? mitades[0] : mitades[1];
    extremoFin = { ...extremoFin, via: cercana.id };
  }
  const fin = resolverExtremo(inicio.datos, extremoFin, `n-${id}-1`);
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

const APLICAR = {
  via: cambiarVia,
  invertirVia,
  cruce: cambiarCruce,
  terminarObra,
  dobleCalzada,
  viaNueva: agregarViaNueva,
};

export function aplicarCambio(datos, cambio) {
  const aplicar = APLICAR[cambio?.tipo];
  if (!aplicar) throw new Error(`Tipo de cambio desconocido: ${cambio?.tipo}`);
  return limpiarPares(aplicar(datos, cambio));
}

export function aplicarCambios(datos, cambios) {
  return cambios.reduce(aplicarCambio, datos);
}

