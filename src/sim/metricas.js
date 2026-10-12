// Métricas de la corrida, las mismas que comparaba la base Python
// (04_analyze.py): viajes, tiempo de viaje, demora y bloqueos.

const MAXIMO_MUESTRAS = 7200; // dos horas a una muestra por segundo
export const VENTANA_RECIENTE = 600; // s: "últimos 10 minutos"

export function crearMetricas() {
  let completados = 0;
  let imposibles = 0;
  let bloqueos = 0;
  let retirados = 0;
  let sumaDuracion = 0;
  let sumaDemora = 0;
  const porTipo = {};
  const serie = [];
  const recientes = []; // { t, duracion, demora }

  return {
    viajeCompletado({ tipo, duracion, tiempoLibre, t = 0 }) {
      const demora = Math.max(0, duracion - tiempoLibre);
      completados += 1;
      sumaDuracion += duracion;
      sumaDemora += demora;
      porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;
      recientes.push({ t, duracion, demora });
    },
    viajeImposible() { imposibles += 1; },
    bloqueo() { bloqueos += 1; },
    retirado() { retirados += 1; },
    muestra(m) {
      serie.push(m);
      if (serie.length > MAXIMO_MUESTRAS) serie.shift();
    },
    // Con el tiempo actual, lo "reciente" son los viajes de los últimos 10 min;
    // sin él, todos.
    resumen(tActual) {
      if (Number.isFinite(tActual)) {
        while (recientes.length && recientes[0].t < tActual - VENTANA_RECIENTE) recientes.shift();
      }
      const n = recientes.length;
      const promedio = (campo) => (n ? recientes.reduce((s, x) => s + x[campo], 0) / n : null);
      return {
        viajesCompletados: completados,
        viajesImposibles: imposibles,
        bloqueos,
        retirados,
        tiempoMedio: completados ? sumaDuracion / completados : null,
        demoraMedia: completados ? sumaDemora / completados : null,
        demoraTotalVh: sumaDemora / 3600,
        demoraReciente: promedio('demora'),
        tiempoReciente: promedio('duracion'),
        porTipo: { ...porTipo },
      };
    },
    serie: () => serie,
  };
}
