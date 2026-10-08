import { describe, it, expect } from 'vitest';
import { TIPOS_VEHICULO } from '../../src/sim/vehiculos.js';
import {
  COLOR_VEHICULO, COLOR_POR_INDICE, RADIO_POR_INDICE, colorCongestion, COLOR_SIN_TRAFICO,
} from '../../src/ui/mapa/estilosVehiculo.js';

describe('estilos de vehículo', () => {
  it('todo tipo tiene color y radio, en el orden de TIPOS_VEHICULO', () => {
    TIPOS_VEHICULO.forEach((tipo, i) => {
      expect(COLOR_VEHICULO[tipo]).toHaveLength(3);
      expect(COLOR_POR_INDICE[i]).toBe(COLOR_VEHICULO[tipo]);
      expect(RADIO_POR_INDICE[i]).toBeGreaterThan(0);
    });
  });
});

describe('colorCongestion', () => {
  it('va de verde a vino tinto según qué tan rápido fluye', () => {
    expect(colorCongestion(0.9)).toEqual([46, 160, 67]);
    expect(colorCongestion(0.5)).toEqual([241, 196, 15]);
    expect(colorCongestion(0.2)).toEqual([214, 69, 65]);
    expect(colorCongestion(0.05)).toEqual([120, 20, 30]);
  });

  it('sin vehículos la vía queda en gris', () => {
    expect(colorCongestion(undefined)).toBe(COLOR_SIN_TRAFICO);
  });
});
