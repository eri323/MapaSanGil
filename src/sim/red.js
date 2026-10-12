// La red vial como grafo dirigido. Cada vía produce un arco por sentido
// permitido: '<viaId>>' de desde a hasta, y '<viaId><' de hasta a desde.

import { TIPOS_VIA, SENTIDOS, CONTROLES } from './tipos.js';

function repetidos(lista) {
  const vistos = new Set();
  const dobles = new Set();
  for (const x of lista) {
    if (vistos.has(x.id)) dobles.add(x.id);
    vistos.add(x.id);
  }
  return dobles;
}

const positivo = (n) => typeof n === 'number' && Number.isFinite(n) && n > 0;

export function validarRed(datos) {
  if (!datos || typeof datos !== 'object') return ['La red no es un objeto'];
  const errores = [];
  if (datos.version !== 1) errores.push(`Versión de red no soportada: ${datos.version}`);
  if (!Array.isArray(datos.nodos)) errores.push('Falta la lista de nodos');
  if (!Array.isArray(datos.vias)) errores.push('Falta la lista de vías');
  if (errores.length) return errores;

  // Un id repetido haría que dos vías o cruces compartan identidad: editar
  // uno cambiaría el otro y los arcos quedarían duplicados.
  for (const id of repetidos(datos.nodos)) errores.push(`Nodo ${id}: id repetido`);
  for (const id of repetidos(datos.vias)) errores.push(`Vía ${id}: id repetido`);

  const ids = new Set(datos.nodos.map((n) => n.id));
  // Un pare puede quedar anotado en una vía que hoy no llega al cruce (por ejemplo,
  // tras invertirla); solo actúa cuando llega. Basta con que la vía toque el nodo.
  const llegadas = new Map(); // nodoId -> vías que tocan el nodo
  for (const v of datos.vias) {
    for (const extremo of [v.desde, v.hasta]) {
      if (!llegadas.has(extremo)) llegadas.set(extremo, new Set());
      llegadas.get(extremo).add(v.id);
    }
  }

  for (const n of datos.nodos) {
    if (!CONTROLES.includes(n.control)) errores.push(`Nodo ${n.id}: control desconocido "${n.control}"`);
    for (const viaId of n.accesosConPare ?? []) {
      if (!llegadas.get(n.id)?.has(viaId)) {
        errores.push(`Nodo ${n.id}: el pare apunta a la vía ${viaId}, que no toca ese cruce`);
      }
    }
  }
  for (const v of datos.vias) {
    if (!ids.has(v.desde)) errores.push(`Vía ${v.id}: el nodo de inicio ${v.desde} no existe`);
    if (!ids.has(v.hasta)) errores.push(`Vía ${v.id}: el nodo final ${v.hasta} no existe`);
    if (v.desde === v.hasta) errores.push(`Vía ${v.id}: empieza y termina en el mismo nodo`);
    if (!Array.isArray(v.geometria) || v.geometria.length < 2) {
      errores.push(`Vía ${v.id}: geometría con menos de 2 puntos`);
    }
    if (!TIPOS_VIA.includes(v.tipo)) errores.push(`Vía ${v.id}: tipo desconocido "${v.tipo}"`);
    if (!SENTIDOS.includes(v.sentido)) errores.push(`Vía ${v.id}: sentido desconocido "${v.sentido}"`);
    if (!positivo(v.longitud)) errores.push(`Vía ${v.id}: la longitud debe ser mayor que 0`);
    if (!positivo(v.velocidadMax)) errores.push(`Vía ${v.id}: la velocidad máxima debe ser mayor que 0`);
    if (!Number.isInteger(v.carrilesPorSentido) || v.carrilesPorSentido < 1) {
      errores.push(`Vía ${v.id}: los carriles por sentido deben ser al menos 1`);
    }
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
  const entrantes = new Map(datos.nodos.map((n) => [n.id, []]));

  const agregar = (arco) => {
    arcos.set(arco.id, arco);
    salientes.get(arco.desde).push(arco.id);
    entrantes.get(arco.hasta).push(arco.id);
  };
  for (const v of datos.vias) {
    agregar({ id: `${v.id}>`, viaId: v.id, desde: v.desde, hasta: v.hasta, adelante: true });
    if (v.sentido === 'ambos') {
      agregar({ id: `${v.id}<`, viaId: v.id, desde: v.hasta, hasta: v.desde, adelante: false });
    }
  }

  const { version, generado, fuente, bbox } = datos;
  return { meta: { version, generado, fuente, bbox }, nodos, vias, arcos, salientes, entrantes };
}

export function arcoTransitable(red, arcoId) {
  const via = red.vias.get(red.arcos.get(arcoId).viaId);
  return via.abierta && !via.enConstruccion;
}

function recorrer(red, origenId, indice, extremo) {
  const vistos = new Set([origenId]);
  const pendientes = [origenId];
  while (pendientes.length) {
    const actual = pendientes.pop();
    for (const arcoId of indice.get(actual) ?? []) {
      if (!arcoTransitable(red, arcoId)) continue;
      const siguiente = red.arcos.get(arcoId)[extremo];
      if (!vistos.has(siguiente)) {
        vistos.add(siguiente);
        pendientes.push(siguiente);
      }
    }
  }
  return vistos;
}

// Nodos a los que se puede llegar desde el origen.
export function alcanzables(red, origenId) {
  return recorrer(red, origenId, red.salientes, 'hasta');
}

// Nodos desde los que se puede llegar al destino.
export function quePuedenLlegar(red, destinoId) {
  return recorrer(red, destinoId, red.entrantes, 'desde');
}

// El grupo más grande de nodos en el que todos pueden ir y volver entre sí.
// Los nodos por fuera son trampas: se entra y no se sale, o al revés.
export function componentePrincipal(red) {
  const pendientes = new Set(red.nodos.keys());
  let mejor = new Set();
  while (pendientes.size > mejor.size) {
    const [semilla] = pendientes;
    const ida = alcanzables(red, semilla);
    const vuelta = quePuedenLlegar(red, semilla);
    const componente = new Set([...ida].filter((n) => vuelta.has(n)));
    for (const n of componente) pendientes.delete(n);
    if (componente.size > mejor.size) mejor = componente;
  }
  return mejor;
}
