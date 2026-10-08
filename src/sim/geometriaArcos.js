// Geometría de cada arco dirigido: sus puntos en el sentido de marcha y la
// distancia acumulada, para ubicar un vehículo a s metros del inicio.

import { distanciaMetros } from './geo.js';

const METROS_POR_GRADO_LAT = 110574;
const metrosPorGradoLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

export function prepararGeometria(red) {
  const geometria = new Map();
  for (const arco of red.arcos.values()) {
    const via = red.vias.get(arco.viaId);
    const coords = arco.adelante ? via.geometria : [...via.geometria].reverse();
    const acumulado = [0];
    for (let i = 1; i < coords.length; i++) {
      acumulado.push(acumulado[i - 1] + distanciaMetros(coords[i - 1], coords[i]));
    }
    geometria.set(arco.id, { coords, acumulado, largo: Math.max(acumulado.at(-1), 0.5) });
  }
  return geometria;
}

function vectorMetros([lon1, lat1], [lon2, lat2]) {
  return [(lon2 - lon1) * metrosPorGradoLon(lat1), (lat2 - lat1) * METROS_POR_GRADO_LAT];
}

export function posicionEnArco(geo, s, lateral = 0) {
  const { coords, acumulado } = geo;
  const d = Math.min(Math.max(s, 0), acumulado.at(-1));
  let i = 0;
  while (i < coords.length - 2 && acumulado[i + 1] < d) i++;
  const tramo = acumulado[i + 1] - acumulado[i];
  const f = tramo > 0 ? (d - acumulado[i]) / tramo : 0;
  const [lon1, lat1] = coords[i];
  const [lon2, lat2] = coords[i + 1];
  let lon = lon1 + (lon2 - lon1) * f;
  let lat = lat1 + (lat2 - lat1) * f;
  if (lateral) {
    const [dx, dy] = vectorMetros(coords[i], coords[i + 1]);
    const n = Math.hypot(dx, dy) || 1;
    // la derecha de (dx, dy) es (dy, −dx)
    lon += (lateral * dy) / n / metrosPorGradoLon(lat);
    lat += (lateral * -dx) / n / METROS_POR_GRADO_LAT;
  }
  return [lon, lat];
}

export function direccionLlegada(geo) {
  const { coords } = geo;
  const [dx, dy] = vectorMetros(coords[coords.length - 2], coords[coords.length - 1]);
  const n = Math.hypot(dx, dy) || 1;
  return [dx / n, dy / n];
}
