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
