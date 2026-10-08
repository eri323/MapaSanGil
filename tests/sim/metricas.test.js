import { describe, it, expect } from 'vitest';
import { crearMetricas } from '../../src/sim/metricas.js';

describe('crearMetricas', () => {
  it('sin viajes todo es cero', () => {
    expect(crearMetricas().resumen()).toEqual({
      viajesCompletados: 0, viajesImposibles: 0, bloqueos: 0,
      tiempoMedio: 0, demoraMedia: 0, demoraTotalVh: 0, porTipo: {},
    });
  });

  it('la demora es lo que el viaje tardó por encima del tiempo libre', () => {
    const m = crearMetricas();
    m.viajeCompletado({ tipo: 'carro', duracion: 100, tiempoLibre: 60 });
    m.viajeCompletado({ tipo: 'moto', duracion: 50, tiempoLibre: 50 });
    m.viajeCompletado({ tipo: 'moto', duracion: 3600, tiempoLibre: 0 });
    const r = m.resumen();
    expect(r.viajesCompletados).toBe(3);
    expect(r.tiempoMedio).toBeCloseTo((100 + 50 + 3600) / 3, 6);
    expect(r.demoraMedia).toBeCloseTo((40 + 0 + 3600) / 3, 6);
    expect(r.demoraTotalVh).toBeCloseTo(3640 / 3600, 6);
    expect(r.porTipo).toEqual({ carro: 1, moto: 2 });
  });

  it('una demora negativa (llegó antes de lo libre) cuenta como cero', () => {
    const m = crearMetricas();
    m.viajeCompletado({ tipo: 'carro', duracion: 50, tiempoLibre: 60 });
    expect(m.resumen().demoraMedia).toBe(0);
  });

  it('cuenta imposibles y bloqueos, y guarda la serie', () => {
    const m = crearMetricas();
    m.viajeImposible();
    m.bloqueo();
    m.bloqueo();
    m.muestra({ t: 1, enRed: 3, enCola: 1 });
    expect(m.resumen()).toMatchObject({ viajesImposibles: 1, bloqueos: 2 });
    expect(m.serie()).toEqual([{ t: 1, enRed: 3, enCola: 1 }]);
  });
});
