const dos = (n) => String(n).padStart(2, '0');

export function formatearHora(horaInicio, t) {
  const total = Math.floor(horaInicio * 3600 + t);
  const horas = Math.floor(total / 3600) % 24;
  const minutos = Math.floor((total % 3600) / 60);
  return `${dos(horas)}:${dos(minutos)}`;
}

export function formatearDuracion(segundos) {
  if (!Number.isFinite(segundos)) return '—';
  const s = Math.round(segundos);
  if (s < 60) return `${s} s`;
  const minutos = Math.floor(s / 60);
  const resto = s % 60;
  return resto ? `${minutos} min ${resto} s` : `${minutos} min`;
}

export const ETIQUETA_METRICA = {
  viajesCompletados: 'Viajes completados',
  tiempoMedio: 'Tiempo medio de viaje',
  demoraMedia: 'Demora media',
  demoraTotalVh: 'Demora total',
  bloqueos: 'Bloqueos',
  viajesImposibles: 'Viajes imposibles',
};

const DURACIONES = new Set(['tiempoMedio', 'demoraMedia']);

export function formatearMetrica(clave, valor) {
  if (!Number.isFinite(valor)) return '—';
  if (DURACIONES.has(clave)) return formatearDuracion(valor);
  if (clave === 'demoraTotalVh') return `${valor.toFixed(1).replace('.', ',')} veh·h`;
  return String(Math.round(valor));
}

export function formatearVariacion(v) {
  if (v === null || !Number.isFinite(v)) return '—';
  const pct = Math.round(v * 100);
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct)} %`;
}
