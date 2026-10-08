// Ríos de la zona, para marcar como puente una vía nueva que los cruce.
// Es un dato opcional: si no carga, el editor funciona igual sin esa ayuda.

export const urlRios = (base = import.meta.env?.BASE_URL ?? '/') => `${base}data/rios.json`;

export async function cargarRios(fetchFn = globalThis.fetch, url = urlRios()) {
  try {
    const respuesta = await fetchFn(url);
    if (!respuesta.ok) return [];
    const datos = await respuesta.json();
    return Array.isArray(datos?.rios) ? datos.rios.map((r) => r.geometria) : [];
  } catch {
    return [];
  }
}
