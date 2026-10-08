const METROS_POR_GRADO_LAT = 110574;

export function circulo(lon, lat, radio, n = 72) {
  const metrosLon = 111320 * Math.cos((lat * Math.PI) / 180);
  return Array.from({ length: n + 1 }, (_, i) => {
    const angulo = (2 * Math.PI * (i % n)) / n;
    return [lon + (radio * Math.cos(angulo)) / metrosLon, lat + (radio * Math.sin(angulo)) / METROS_POR_GRADO_LAT];
  });
}
