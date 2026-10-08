import { describe, it, expect } from 'vitest';
import {
  TIPOS_VEHICULO, ETIQUETA_VEHICULO, PERFILES, velocidadDeseada, velocidadReferencia,
  crearConductor, CONDUCTOR_NEUTRO,
} from '../../src/sim/vehiculos.js';
import { crearAleatorio } from '../../src/sim/aleatorio.js';

const via = (extra = {}) => ({ velocidadMax: 30, superficie: 'pavimento', estado: 'bueno', ...extra });

describe('perfiles de vehículo', () => {
  it('todo tipo tiene perfil completo y etiqueta', () => {
    for (const tipo of TIPOS_VEHICULO) {
      const p = PERFILES[tipo];
      for (const campo of ['largo', 'vMax', 'a', 'b', 'T', 's0', 'hueco']) expect(p[campo]).toBeGreaterThan(0);
      expect(ETIQUETA_VEHICULO[tipo]).toBeTruthy();
    }
  });

  it('la moto es la más corta y ágil; el camión el más largo y lento', () => {
    expect(PERFILES.moto.largo).toBeLessThan(PERFILES.carro.largo);
    expect(PERFILES.moto.hueco).toBeLessThan(PERFILES.carro.hueco);
    expect(PERFILES.camion.largo).toBeGreaterThan(PERFILES.bus_nacional.largo);
    expect(PERFILES.camion.a).toBeLessThan(PERFILES.carro.a);
  });
});

describe('velocidadDeseada', () => {
  it('en vía buena es el límite de la vía', () => {
    expect(velocidadDeseada(PERFILES.carro, via())).toBeCloseTo(30 / 3.6, 6);
  });

  it('el estado y la superficie la reducen', () => {
    const buena = velocidadDeseada(PERFILES.carro, via());
    const regular = velocidadDeseada(PERFILES.carro, via({ estado: 'regular' }));
    const huecos = velocidadDeseada(PERFILES.carro, via({ estado: 'huecos' }));
    const destapada = velocidadDeseada(PERFILES.carro, via({ superficie: 'destapado' }));
    expect(regular).toBeLessThan(buena);
    expect(huecos).toBeLessThan(regular);
    expect(destapada).toBeLessThan(buena);
  });

  it('el vehículo no supera su propia velocidad máxima', () => {
    expect(velocidadDeseada(PERFILES.camion, via({ velocidadMax: 50 }))).toBe(PERFILES.camion.vMax);
  });

  it('nunca baja de 1 m/s', () => {
    expect(velocidadDeseada(PERFILES.carro, via({ velocidadMax: 1, estado: 'huecos', superficie: 'destapado' }))).toBe(1);
  });

  it('con huecos los conductores se dispersan más que en vía buena', () => {
    const r = crearAleatorio(11);
    const conductores = Array.from({ length: 50 }, () => crearConductor(r));
    const rango = (estado) => {
      const vs = conductores.map((c) => velocidadDeseada(PERFILES.carro, via({ estado }), c));
      return Math.max(...vs) / Math.min(...vs);
    };
    expect(rango('huecos')).toBeGreaterThan(rango('bueno'));
  });

  it('la velocidad de referencia es la de un carro con conductor neutro', () => {
    expect(velocidadReferencia(via())).toBe(velocidadDeseada(PERFILES.carro, via(), CONDUCTOR_NEUTRO));
  });
});
