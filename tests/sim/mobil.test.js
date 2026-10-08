import { describe, it, expect } from 'vitest';
import { convieneCambiar } from '../../src/sim/mobil.js';

describe('convieneCambiar', () => {
  it('cambia si gana bastante y nadie sale perjudicado', () => {
    expect(convieneCambiar({ aActual: -2, aNueva: 1 })).toBe(true);
  });

  it('no cambia si obligaría al de atrás a frenar en seco', () => {
    expect(convieneCambiar({ aActual: -2, aNueva: 1, seguidorNuevo: { antes: 0, despues: -5 } })).toBe(false);
  });

  it('no cambia por una ganancia marginal', () => {
    expect(convieneCambiar({ aActual: 0.5, aNueva: 0.6 })).toBe(false);
  });

  it('la cortesía pesa: no cambia si perjudica mucho a los demás', () => {
    expect(convieneCambiar({
      aActual: 0, aNueva: 0.6,
      seguidorNuevo: { antes: 1, despues: -1.5 },
    })).toBe(false);
  });
});
