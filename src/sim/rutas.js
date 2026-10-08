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
