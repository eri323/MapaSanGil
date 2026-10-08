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
