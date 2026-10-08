// Estado de la herramienta "vía o puente nuevo": puntos marcados, a qué se
// pegó cada extremo y los atributos de la vía.

import { ajustarPunto } from '../../escenarios/ajuste.js';
import { lineasSeCruzan } from '../../sim/geo.js';

export const PRESETS = {
  calle: {
    nombre: 'Vía nueva', tipo: 'doble_sentido', sentido: 'ambos',
    velocidadMax: 30, carrilesPorSentido: 1, enConstruccion: false,
  },
  variante: {
    nombre: 'Variante de San Gil (tramo nuevo)', tipo: 'variante', sentido: 'ambos',
    velocidadMax: 60, carrilesPorSentido: 1, enConstruccion: true,
  },
};

export const crearDibujo = (preset = 'calle') => ({ preset, atributos: { ...PRESETS[preset] }, puntos: [] });

export function agregarPunto(dibujo, red, coordenada) {
  return { ...dibujo, puntos: [...dibujo.puntos, { coordenada, ajuste: ajustarPunto(red, coordenada) }] };
}

export const quitarUltimo = (dibujo) => ({ ...dibujo, puntos: dibujo.puntos.slice(0, -1) });
export const cambiarAtributos = (dibujo, parcial) => ({ ...dibujo, atributos: { ...dibujo.atributos, ...parcial } });

// Extremos pegados a la red; puntos intermedios donde se marcaron.
export function lineaDelDibujo(dibujo) {
  const ultimo = dibujo.puntos.length - 1;
  return dibujo.puntos.map((p, i) => (i === 0 || i === ultimo ? p.ajuste.punto : p.coordenada));
}

export const cruzaRio = (dibujo, rios) => {
  const linea = lineaDelDibujo(dibujo);
  return linea.length >= 2 && rios.some((rio) => lineasSeCruzan(linea, rio));
};

export function cambioDeDibujo(dibujo, id, rios) {
  if (dibujo.puntos.length < 2) throw new Error('Marca al menos dos puntos para crear la vía');
  const esPuente = cruzaRio(dibujo, rios);
  const nombre = esPuente && dibujo.preset === 'calle' ? 'Puente nuevo' : dibujo.atributos.nombre;
  return {
    tipo: 'viaNueva',
    id,
    puntos: lineaDelDibujo(dibujo),
    extremos: [dibujo.puntos[0].ajuste, dibujo.puntos.at(-1).ajuste],
    atributos: { ...dibujo.atributos, esPuente, nombre },
  };
}

export function siguienteIdVia(datos) {
  let k = 1;
  while (datos.vias.some((v) => v.id === `nueva-${k}` || v.id.startsWith(`nueva-${k}~`))) k += 1;
  return `nueva-${k}`;
}
