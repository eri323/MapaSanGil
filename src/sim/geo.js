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
