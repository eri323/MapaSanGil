import { TIPOS_VEHICULO } from '../../sim/vehiculos.js';

export const COLOR_VEHICULO = {
  moto: [230, 126, 34],
  carro: [41, 128, 185],
  buseta: [39, 174, 96],
  bus_nacional: [142, 68, 173],
  bus_intermunicipal: [22, 160, 133],
  camion: [44, 62, 80],
};

const RADIO_VEHICULO = { moto: 1.5, carro: 2.2, buseta: 3, bus_nacional: 4, bus_intermunicipal: 3.5, camion: 4.5 };

// El motor envía el índice del tipo; estos arreglos se leen por ese índice.
export const COLOR_POR_INDICE = TIPOS_VEHICULO.map((tipo) => COLOR_VEHICULO[tipo]);
export const RADIO_POR_INDICE = TIPOS_VEHICULO.map((tipo) => RADIO_VEHICULO[tipo]);

export const COLOR_SIN_TRAFICO = [180, 186, 194];

export function colorCongestion(ratio) {
  if (ratio === undefined || ratio === null) return COLOR_SIN_TRAFICO;
  if (ratio >= 0.7) return [46, 160, 67];
  if (ratio >= 0.4) return [241, 196, 15];
  if (ratio >= 0.15) return [214, 69, 65];
  return [120, 20, 30];
}

export const ESCALA_CONGESTION = [
  { etiqueta: 'Fluido', color: [46, 160, 67] },
  { etiqueta: 'Lento', color: [241, 196, 15] },
  { etiqueta: 'Congestionado', color: [214, 69, 65] },
  { etiqueta: 'Detenido', color: [120, 20, 30] },
  { etiqueta: 'Sin tráfico', color: COLOR_SIN_TRAFICO },
];
