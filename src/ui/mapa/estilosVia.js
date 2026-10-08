import { longitudLinea, puntoALoLargo, anguloPantalla } from '../../sim/geo.js';

export const COLOR_TIPO = {
  avenida_nacional: [214, 69, 65],
  variante: [142, 68, 173],
  doble_calzada: [230, 126, 34],
  glorieta: [39, 174, 96],
  doble_sentido: [52, 101, 164],
  un_sentido: [93, 109, 126],
};

export const COLOR_PUENTE = [241, 196, 15];
export const COLOR_PARE = [192, 57, 43];
export const COLOR_SELECCION = [20, 20, 20];

export const ANCHO_TIPO = {
  avenida_nacional: 7,
  variante: 7,
  doble_calzada: 6,
  glorieta: 5,
  doble_sentido: 4,
  un_sentido: 4,
};

export const colorVia = (via) => COLOR_TIPO[via.tipo];
export const anchoVia = (via) => ANCHO_TIPO[via.tipo];

export function flechasDeVias(vias, { longitudMinima = 25 } = {}) {
  const flechas = [];
  for (const via of vias) {
    if (via.sentido !== 'adelante' || via.longitud < longitudMinima) continue;
    const { posicion, segmento } = puntoALoLargo(via.geometria, longitudLinea(via.geometria) / 2);
    const angulo = anguloPantalla(via.geometria[segmento], via.geometria[segmento + 1]);
    flechas.push({ viaId: via.id, posicion, angulo });
  }
  return flechas;
}
