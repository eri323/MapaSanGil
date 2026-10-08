// Restricción de pesados de paso: con la Variante terminada, tractomulas y
// buses que solo atraviesan San Gil no pueden entrar al casco urbano.

import { distanciaMetros } from './geo.js';
import { posicionEnArco } from './geometriaArcos.js';
import { rutaMasRapida } from './rutas.js';
import { arcoTransitable } from './red.js';

export const FLUJOS_RESTRINGIBLES = new Set(['pesado', 'busPaso']);
export const TIPOS_PERMITIDOS = new Set(['avenida_nacional', 'variante']);

export function arcosEnCasco(red, geometria, casco) {
  const dentro = new Set();
  if (!casco) return dentro;
  for (const [arcoId, geo] of geometria) {
    const medio = posicionEnArco(geo, geo.largo / 2);
    if (distanciaMetros(medio, [casco.lon, casco.lat]) <= casco.radio) dentro.add(arcoId);
  }
  return dentro;
}

export function permitidoRestringido(red, arcosCasco, arcoId) {
  if (!arcoTransitable(red, arcoId) || arcosCasco.has(arcoId)) return false;
  return TIPOS_PERMITIDOS.has(red.vias.get(red.arcos.get(arcoId).viaId).tipo);
}

// ¿Se puede ir de a a b, y volver, sin entrar al casco y solo por Avenida y Variante?
export function rodeaElCasco(red, arcosCasco, a, b) {
  const costo = (arcoId) => (permitidoRestringido(red, arcosCasco, arcoId) ? 1 : Infinity);
  return rutaMasRapida(red, a, b, costo) !== null && rutaMasRapida(red, b, a, costo) !== null;
}
