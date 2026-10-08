import { describe, it, expect } from 'vitest';
import { circulo } from '../../src/ui/mapa/geometriaUi.js';
import { distanciaMetros } from '../../src/sim/geo.js';

describe('circulo', () => {
  it('todos sus puntos están al radio pedido y el anillo se cierra', () => {
    const anillo = circulo(-73.1336, 6.5548, 1300, 36);
    expect(anillo).toHaveLength(37);
    expect(anillo[0]).toEqual(anillo[36]);
    for (const p of anillo) {
      const d = distanciaMetros(p, [-73.1336, 6.5548]);
      expect(d).toBeGreaterThan(1300 * 0.99);
      expect(d).toBeLessThan(1300 * 1.01);
    }
  });
});
