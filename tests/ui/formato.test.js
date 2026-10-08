import { describe, it, expect } from 'vitest';
import { formatearHora, formatearDuracion } from '../../src/ui/formato.js';

describe('formatearHora', () => {
  it('suma el tiempo simulado a la hora de inicio', () => {
    expect(formatearHora(7, 0)).toBe('07:00');
    expect(formatearHora(7, 3600 + 30 * 60 + 59)).toBe('08:30');
    expect(formatearHora(23, 2 * 3600)).toBe('01:00');
  });
});

describe('formatearDuracion', () => {
  it('escribe segundos y minutos', () => {
    expect(formatearDuracion(45.4)).toBe('45 s');
    expect(formatearDuracion(120)).toBe('2 min');
    expect(formatearDuracion(200)).toBe('3 min 20 s');
    expect(formatearDuracion(NaN)).toBe('—');
  });
});

import { formatearMetrica, formatearVariacion, ETIQUETA_METRICA } from '../../src/ui/formato.js';
import { METRICAS_COMPARADAS } from '../../src/escenarios/comparar.js';

describe('formato de métricas', () => {
  it('toda métrica comparada tiene etiqueta', () => {
    for (const clave of METRICAS_COMPARADAS) expect(ETIQUETA_METRICA[clave]).toBeTruthy();
  });

  it('tiempos como duración, conteos redondeados, vehículo-hora con un decimal', () => {
    expect(formatearMetrica('demoraMedia', 125)).toBe('2 min 5 s');
    expect(formatearMetrica('viajesCompletados', 412.6)).toBe('413');
    expect(formatearMetrica('demoraTotalVh', 12.345)).toBe('12,3 veh·h');
  });

  it('variación con signo, o guion si no se puede calcular', () => {
    expect(formatearVariacion(0.254)).toBe('+25 %');
    expect(formatearVariacion(-0.1)).toBe('−10 %');
    expect(formatearVariacion(null)).toBe('—');
  });
});
