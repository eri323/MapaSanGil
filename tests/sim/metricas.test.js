import { describe, it, expect } from 'vitest';
import { crearMetricas } from '../../src/sim/metricas.js';

describe('crearMetricas', () => {
  it('sin viajes no hay promedios', () => {
    expect(crearMetricas().resumen()).toEqual({
      viajesCompletados: 0, viajesImposibles: 0, bloqueos: 0, retirados: 0,
      tiempoMedio: null, demoraMedia: null, demoraTotalVh: 0, demoraReciente: null, tiempoReciente: null, porTipo: {},
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

describe('crearMetricas · retirados', () => {
  it('cuenta los vehículos retirados por cambios en la red', () => {
    const m = crearMetricas();
    m.retirado();
    expect(m.resumen().retirados).toBe(1);
  });
});

describe('crearMetricas · últimos 10 minutos', () => {
  it('solo cuenta los viajes terminados en la ventana', () => {
    const m = crearMetricas();
    m.viajeCompletado({ tipo: 'carro', duracion: 200, tiempoLibre: 100, t: 0 });
    m.viajeCompletado({ tipo: 'carro', duracion: 70, tiempoLibre: 60, t: 700 });
    const r = m.resumen(800);
    expect(r.demoraReciente).toBe(10);
    expect(r.tiempoReciente).toBe(70);
    expect(r.demoraMedia).toBe(55);
  });

  it('sin tiempo actual promedia todos los viajes', () => {
    const m = crearMetricas();
    m.viajeCompletado({ tipo: 'carro', duracion: 200, tiempoLibre: 100, t: 0 });
    m.viajeCompletado({ tipo: 'carro', duracion: 70, tiempoLibre: 60, t: 700 });
    expect(m.resumen().demoraReciente).toBe(55);
  });
});
