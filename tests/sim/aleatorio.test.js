import { describe, it, expect } from 'vitest';
import { crearAleatorio } from '../../src/sim/aleatorio.js';

describe('crearAleatorio', () => {
  it('la misma semilla da la misma secuencia', () => {
    const a = crearAleatorio(42);
    const b = crearAleatorio(42);
    const sa = Array.from({ length: 5 }, () => a.siguiente());
    const sb = Array.from({ length: 5 }, () => b.siguiente());
    expect(sa).toEqual(sb);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it('semillas distintas dan secuencias distintas', () => {
    expect(crearAleatorio(1).siguiente()).not.toBe(crearAleatorio(2).siguiente());
  });

  it('entre, entero y elegir respetan sus rangos', () => {
    const r = crearAleatorio(7);
    for (let k = 0; k < 200; k++) {
      const x = r.entre(2, 3);
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThan(3);
      expect(r.entero(4)).toBeLessThan(4);
      expect(['a', 'b']).toContain(r.elegir(['a', 'b']));
    }
  });

  it('elegirPonderado nunca escoge un peso 0', () => {
    const r = crearAleatorio(3);
    for (let k = 0; k < 100; k++) expect(r.elegirPonderado({ a: 0, b: 1 })).toBe('b');
  });

  it('exponencial tiene media 1/tasa', () => {
    const r = crearAleatorio(9);
    let suma = 0;
    for (let k = 0; k < 20000; k++) suma += r.exponencial(0.5);
    expect(suma / 20000).toBeGreaterThan(1.9);
    expect(suma / 20000).toBeLessThan(2.1);
  });
});
