// Métricas de la corrida, las mismas que comparaba la base Python
// (04_analyze.py): viajes, tiempo de viaje, demora y bloqueos.

const MAXIMO_MUESTRAS = 7200; // dos horas a una muestra por segundo

export function crearMetricas() {
  let completados = 0;
  let imposibles = 0;
  let bloqueos = 0;
  let retirados = 0;
  let sumaDuracion = 0;
  let sumaDemora = 0;
  const porTipo = {};
  const serie = [];

  return {
    viajeCompletado({ tipo, duracion, tiempoLibre }) {
      completados += 1;
      sumaDuracion += duracion;
      sumaDemora += Math.max(0, duracion - tiempoLibre);
      porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
    },
    viajeImposible() { imposibles += 1; },
    bloqueo() { bloqueos += 1; },
    retirado() { retirados += 1; },
    muestra(m) {
      serie.push(m);
      if (serie.length > MAXIMO_MUESTRAS) serie.shift();
    },
    resumen() {
      return {
        viajesCompletados: completados,
        viajesImposibles: imposibles,
        bloqueos,
        retirados,
        tiempoMedio: completados ? sumaDuracion / completados : 0,
        demoraMedia: completados ? sumaDemora / completados : 0,
        demoraTotalVh: sumaDemora / 3600,
        porTipo: { ...porTipo },
      };
    },
    serie: () => serie,
  };
}
