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
