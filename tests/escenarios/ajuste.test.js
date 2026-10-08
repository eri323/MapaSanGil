import { describe, it, expect } from 'vitest';
import { ajustarPunto } from '../../src/escenarios/ajuste.js';
import { redLinea, punto } from '../sim/redesPrueba.js';

const red = redLinea();

describe('ajustarPunto', () => {
  it('cerca de un cruce se pega al cruce', () => {
    expect(ajustarPunto(red, punto(205, 8))).toMatchObject({ tipo: 'nodo', nodo: 'n1' });
  });

  it('cerca de una vía, lejos de los cruces, se pega a la vía', () => {
    const r = ajustarPunto(red, punto(300, 10));
    expect(r).toMatchObject({ tipo: 'via', via: 't1' });
    expect(r.punto[1]).toBeCloseTo(punto(300, 0)[1], 6);
  });

  it('lejos de todo queda suelto', () => {
    const p = punto(300, 100);
    expect(ajustarPunto(red, p)).toEqual({ tipo: 'libre', punto: p });
  });
});
