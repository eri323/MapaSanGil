// Geometría sobre coordenadas [lon, lat]. Distancias en metros.

const RADIO_TIERRA = 6371008.8;
const rad = (grados) => (grados * Math.PI) / 180;

export function distanciaMetros([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.sqrt(a));
}

export function longitudLinea(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += distanciaMetros(coords[i - 1], coords[i]);
  return total;
}

export function puntoALoLargo(coords, distancia) {
  let acumulado = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const tramo = distanciaMetros(coords[i], coords[i + 1]);
    if (acumulado + tramo >= distancia) {
      const t = tramo === 0 ? 0 : (distancia - acumulado) / tramo;
      const [lon1, lat1] = coords[i];
      const [lon2, lat2] = coords[i + 1];
      return { posicion: [lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t], segmento: i };
    }
    acumulado += tramo;
  }
  return { posicion: coords[coords.length - 1], segmento: coords.length - 2 };
}

// Grados en sentido antihorario desde el este, como los usa deck.gl.
export function anguloPantalla([lon1, lat1], [lon2, lat2]) {
  const dx = (lon2 - lon1) * Math.cos(rad((lat1 + lat2) / 2));
  const dy = lat2 - lat1;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
// Punto de la línea más cercano a p. Aproximación plana, suficiente a escala de ciudad.
export function proyectarEnLinea(coords, p) {
  let mejor = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i];
    const [bx, by] = coords[i + 1];
    const k = Math.cos(rad((ay + by) / 2));
    const dx = (bx - ax) * k;
    const dy = by - ay;
    const largo2 = dx * dx + dy * dy;
    let f = largo2 === 0 ? 0 : ((p[0] - ax) * k * dx + (p[1] - ay) * dy) / largo2;
    f = Math.min(1, Math.max(0, f));
    const punto = [ax + (bx - ax) * f, ay + (by - ay) * f];
    const distancia = distanciaMetros(p, punto);
    if (!mejor || distancia < mejor.distancia) mejor = { punto, distancia, segmento: i };
  }
  return mejor;
}

// ¿Algún tramo de a corta (no solo toca) algún tramo de b?
export function lineasSeCruzan(a, b) {
  const lado = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) {
      const [p1, p2, q1, q2] = [a[i - 1], a[i], b[j - 1], b[j]];
      if (lado(p1, p2, q1) * lado(p1, p2, q2) < 0 && lado(q1, q2, p1) * lado(q1, q2, p2) < 0) return true;
    }
  }
  return false;
}
