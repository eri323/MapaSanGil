// Historial de cambios con deshacer y rehacer. Los cambios activos son los
// primeros `indice`; los demás se pueden rehacer hasta que llegue uno nuevo.

export const HISTORIAL_VACIO = { entradas: [], indice: 0 };

export function agregar(h, entrada) {
  return { entradas: [...h.entradas.slice(0, h.indice), entrada], indice: h.indice + 1 };
}

export const puedeDeshacer = (h) => h.indice > 0;
export const puedeRehacer = (h) => h.indice < h.entradas.length;
export const deshacer = (h) => (puedeDeshacer(h) ? { ...h, indice: h.indice - 1 } : h);
export const rehacer = (h) => (puedeRehacer(h) ? { ...h, indice: h.indice + 1 } : h);
export const activos = (h) => h.entradas.slice(0, h.indice).map((e) => e.cambio);

export function serializar(h) {
  return JSON.stringify({ version: 1, entradas: h.entradas, indice: h.indice });
}

export function deserializar(texto) {
  try {
    const x = JSON.parse(texto);
    if (x?.version !== 1 || !Array.isArray(x.entradas) || !Number.isInteger(x.indice)) return null;
    return { entradas: x.entradas, indice: Math.min(Math.max(x.indice, 0), x.entradas.length) };
  } catch {
    return null;
  }
}

// --- validación contra la red ------------------------------------------------

import { aplicarCambio, aplicarCambios } from './cambios.js';
import { crearRed } from '../sim/red.js';

// Recupera un historial guardado conservando solo la parte que todavía se puede
// aplicar sobre la red base, incluidos los pasos por rehacer. Si la red de OSM
// cambió y un paso ya no aplica, desde ahí se descarta.
export function recuperarHistorial(base, texto) {
  const h = deserializar(texto);
  if (!h) return HISTORIAL_VACIO;
  let datos = base;
  const validas = [];
  for (const entrada of h.entradas) {
    try {
      datos = aplicarCambio(datos, entrada.cambio);
      crearRed(datos);
    } catch {
      break;
    }
    validas.push(entrada);
  }
  return validas.length ? { entradas: validas, indice: Math.min(h.indice, validas.length) } : HISTORIAL_VACIO;
}

// Agrega una entrada solo si el historial resultante produce una red válida.
export function agregarValidado(base, h, entrada) {
  const nuevo = agregar(h, entrada);
  crearRed(aplicarCambios(base, activos(nuevo)));
  return nuevo;
}

// Historial con todas las entradas activas (para cargar un escenario en el editor).
export function historialDesdeEntradas(base, entradas) {
  crearRed(aplicarCambios(base, entradas.map((e) => e.cambio)));
  return { entradas: [...entradas], indice: entradas.length };
}
