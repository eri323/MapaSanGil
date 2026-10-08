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
