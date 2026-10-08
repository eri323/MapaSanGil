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
export const COLOR_CERRADA = [150, 150, 150];
export const COLOR_SEMAFORO = [39, 174, 96];
export const COLOR_CRUCE = [120, 130, 140];
export const COLOR_DIBUJO = [230, 126, 34];
export const COLOR_AJUSTE = { nodo: [39, 174, 96], via: [41, 128, 185], libre: [120, 120, 120] };
export const EXTRA_DOBLE_CALZADA = 4;

export const ANCHO_TIPO = {
  avenida_nacional: 7,
  variante: 7,
  doble_calzada: 6,
  glorieta: 5,
  doble_sentido: 4,
  un_sentido: 4,
};

export const colorVia = (via) => COLOR_TIPO[via.tipo];
export const anchoVia = (via) => ANCHO_TIPO[via.tipo] + (via.dobleCalzada ? EXTRA_DOBLE_CALZADA : 0);

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

export function colorDiferencia(delta) {
  if (delta === undefined || delta === null) return [215, 219, 224];
  if (delta > 0.05) return [46, 160, 67];
  if (delta < -0.05) return [214, 69, 65];
  return [190, 196, 204];
}

export const ESCALA_DIFERENCIA = [
  { etiqueta: 'Más fluida que en la referencia', color: [46, 160, 67] },
  { etiqueta: 'Igual', color: [190, 196, 204] },
  { etiqueta: 'Más lenta que en la referencia', color: [214, 69, 65] },
  { etiqueta: 'Sin tráfico en ninguno', color: [215, 219, 224] },
];
