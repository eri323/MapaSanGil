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
