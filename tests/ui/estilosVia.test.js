import { describe, it, expect } from 'vitest';
import { TIPOS_VIA } from '../../src/sim/tipos.js';
import { COLOR_TIPO, ANCHO_TIPO, colorVia, anchoVia, flechasDeVias } from '../../src/ui/mapa/estilosVia.js';

const via = (extra) => ({
  id: 'v', geometria: [[-73.137, 6.555], [-73.136, 6.555]], longitud: 110.5,
  tipo: 'un_sentido', sentido: 'adelante', ...extra,
});

describe('estilos de vía', () => {
  it('todo tipo tiene color y ancho', () => {
    for (const tipo of TIPOS_VIA) {
      expect(COLOR_TIPO[tipo]).toHaveLength(3);
      expect(ANCHO_TIPO[tipo]).toBeGreaterThan(0);
      expect(colorVia({ tipo })).toEqual(COLOR_TIPO[tipo]);
      expect(anchoVia({ tipo })).toBe(ANCHO_TIPO[tipo]);
    }
  });

  it('la Avenida Nacional es más ancha que una calle', () => {
    expect(ANCHO_TIPO.avenida_nacional).toBeGreaterThan(ANCHO_TIPO.un_sentido);
  });
});

describe('flechasDeVias', () => {
  it('pone una flecha en la mitad de cada vía de un sentido, apuntando hacia hasta', () => {
    const [flecha, ...resto] = flechasDeVias([via()]);
    expect(resto).toEqual([]);
    expect(flecha.viaId).toBe('v');
    expect(flecha.posicion[0]).toBeCloseTo(-73.1365, 6);
    expect(flecha.angulo).toBeCloseTo(0, 6);
  });

  it('no pone flechas en vías de doble sentido', () => {
    expect(flechasDeVias([via({ sentido: 'ambos' })])).toEqual([]);
  });

  it('no pone flechas en vías muy cortas', () => {
    expect(flechasDeVias([via({ longitud: 10 })])).toEqual([]);
  });
});

import { EXTRA_DOBLE_CALZADA, COLOR_AJUSTE } from '../../src/ui/mapa/estilosVia.js';

describe('estilos del editor', () => {
  it('la doble calzada se dibuja más ancha', () => {
    expect(anchoVia({ tipo: 'avenida_nacional', dobleCalzada: true })).toBe(ANCHO_TIPO.avenida_nacional + EXTRA_DOBLE_CALZADA);
  });

  it('hay un color por tipo de ajuste', () => {
    for (const tipo of ['nodo', 'via', 'libre']) expect(COLOR_AJUSTE[tipo]).toHaveLength(3);
  });
});
