// La red vial como grafo dirigido. Cada vía produce un arco por sentido
// permitido: '<viaId>>' de desde a hasta, y '<viaId><' de hasta a desde.

import { TIPOS_VIA, SENTIDOS, CONTROLES } from './tipos.js';

export function validarRed(datos) {
  if (!datos || typeof datos !== 'object') return ['La red no es un objeto'];
  const errores = [];
  if (datos.version !== 1) errores.push(`Versión de red no soportada: ${datos.version}`);
  if (!Array.isArray(datos.nodos)) errores.push('Falta la lista de nodos');
  if (!Array.isArray(datos.vias)) errores.push('Falta la lista de vías');
  if (errores.length) return errores;

  const ids = new Set(datos.nodos.map((n) => n.id));
  for (const n of datos.nodos) {
    if (!CONTROLES.includes(n.control)) errores.push(`Nodo ${n.id}: control desconocido "${n.control}"`);
  }
  for (const v of datos.vias) {
    if (!ids.has(v.desde)) errores.push(`Vía ${v.id}: el nodo de inicio ${v.desde} no existe`);
    if (!ids.has(v.hasta)) errores.push(`Vía ${v.id}: el nodo final ${v.hasta} no existe`);
    if (!Array.isArray(v.geometria) || v.geometria.length < 2) {
      errores.push(`Vía ${v.id}: geometría con menos de 2 puntos`);
    }
    if (!TIPOS_VIA.includes(v.tipo)) errores.push(`Vía ${v.id}: tipo desconocido "${v.tipo}"`);
    if (!SENTIDOS.includes(v.sentido)) errores.push(`Vía ${v.id}: sentido desconocido "${v.sentido}"`);
  }
  return errores;
}

export function crearRed(datos) {
  const errores = validarRed(datos);
  if (errores.length) {
    throw new Error(`Red inválida:\n- ${errores.slice(0, 10).join('\n- ')}`);
  }

  const nodos = new Map(datos.nodos.map((n) => [n.id, n]));
  const vias = new Map(datos.vias.map((v) => [v.id, v]));
  const arcos = new Map();
  const salientes = new Map(datos.nodos.map((n) => [n.id, []]));

  const agregar = (arco) => {
    arcos.set(arco.id, arco);
    salientes.get(arco.desde).push(arco.id);
  };
  for (const v of datos.vias) {
    agregar({ id: `${v.id}>`, viaId: v.id, desde: v.desde, hasta: v.hasta, adelante: true });
    if (v.sentido === 'ambos') {
      agregar({ id: `${v.id}<`, viaId: v.id, desde: v.hasta, hasta: v.desde, adelante: false });
    }
  }

  const { version, generado, fuente, bbox } = datos;
  return { meta: { version, generado, fuente, bbox }, nodos, vias, arcos, salientes };
}

export function arcoTransitable(red, arcoId) {
  const via = red.vias.get(red.arcos.get(arcoId).viaId);
  return via.abierta && !via.enConstruccion;
}

export function alcanzables(red, origenId) {
  const vistos = new Set([origenId]);
  const pendientes = [origenId];
  while (pendientes.length) {
    const actual = pendientes.pop();
    for (const arcoId of red.salientes.get(actual) ?? []) {
      if (!arcoTransitable(red, arcoId)) continue;
      const siguiente = red.arcos.get(arcoId).hasta;
      if (!vistos.has(siguiente)) {
        vistos.add(siguiente);
        pendientes.push(siguiente);
      }
    }
  }
  return vistos;
}
