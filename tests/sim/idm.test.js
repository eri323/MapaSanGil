import { describe, it, expect } from 'vitest';
import { aceleracionIDM, avanzar } from '../../src/sim/idm.js';
import { PERFILES } from '../../src/sim/vehiculos.js';

const carro = PERFILES.carro;

describe('aceleracionIDM', () => {
  it('sin nadie adelante acelera al máximo desde parado y deja de acelerar a su velocidad deseada', () => {
    expect(aceleracionIDM(carro, 0, 10, Infinity, 10)).toBeCloseTo(carro.a, 6);
    expect(aceleracionIDM(carro, 10, 10, Infinity, 10)).toBeCloseTo(0, 6);
  });

  it('nunca frena más fuerte que 9 m/s²', () => {
    expect(aceleracionIDM(carro, 15, 15, 0.001, 0)).toBe(-9);
  });

  it('frena hasta detenerse antes de un obstáculo quieto, sin atravesarlo', () => {
    let x = 0;
    let v = 10;
    const obstaculo = 100;
    for (let k = 0; k < 120; k++) {
      const a = aceleracionIDM(carro, v, 10, obstaculo - x, 0);
      const paso = avanzar(v, a, 0.5);
      v = paso.v;
      x += paso.dx;
      expect(obstaculo - x).toBeGreaterThan(0);
    }
    expect(v).toBeLessThan(0.1);
    expect(obstaculo - x).toBeLessThan(carro.s0 + 1);
  });

  it('detrás de un líder constante converge a su velocidad y a la distancia s0 + vT', () => {
    let xLider = 50;
    let x = 0;
    let v = 0;
    for (let k = 0; k < 480; k++) {
      const a = aceleracionIDM(carro, v, 15, xLider - carro.largo - x, 8);
      const paso = avanzar(v, a, 0.5);
      v = paso.v;
      x += paso.dx;
      xLider += 8 * 0.5;
    }
    expect(v).toBeCloseTo(8, 0);
    const brecha = xLider - carro.largo - x;
    expect(brecha).toBeGreaterThan(carro.s0 + 8 * carro.T - 1.5);
    expect(brecha).toBeLessThan(carro.s0 + 8 * carro.T + 1.5);
  });
});

describe('avanzar', () => {
  it('integra con aceleración constante', () => {
    expect(avanzar(10, 2, 0.5)).toEqual({ v: 11, dx: 5.25 });
  });

  it('si el frenado lo detendría a mitad de paso, se detiene sin retroceder', () => {
    const r = avanzar(1, -9, 0.5);
    expect(r.v).toBe(0);
    expect(r.dx).toBeCloseTo(1 / 18, 6);
  });
});

describe('aceleracionIDM · más rápido que la velocidad deseada', () => {
  it('al entrar a una vía más lenta sin nadie adelante frena con suavidad, no en seco', () => {
    expect(aceleracionIDM(carro, 14, 3, Infinity, 14)).toBeGreaterThanOrEqual(-carro.b);
    expect(aceleracionIDM(carro, 14, 3, 50, 14)).toBeGreaterThanOrEqual(-9);
  });
});
