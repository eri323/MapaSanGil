import { crearRed } from '../../sim/red.js';

// Relativa a la base de la app, para que funcione aunque se publique en una subcarpeta.
export const urlRed = (base = import.meta.env?.BASE_URL ?? '/') => `${base}data/red-sangil.json`;
export const URL_RED = urlRed();

export async function cargarRed(fetchFn = globalThis.fetch, url = URL_RED) {
  let respuesta;
  try {
    respuesta = await fetchFn(url);
  } catch (err) {
    throw new Error(`No se pudo descargar la red vial: ${err.message}`);
  }
  if (!respuesta.ok) {
    throw new Error(`No se encontró la red vial (HTTP ${respuesta.status}). Genérala con "npm run red".`);
  }

  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    throw new Error('El archivo de la red vial no existe o está dañado. Genéralo con "npm run red".');
  }
  return crearRed(datos);
}
