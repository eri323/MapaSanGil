import { describe, it, expect } from 'vitest';
import { prepararGeometria, posicionEnArco, direccionLlegada } from '../../src/sim/geometriaArcos.js';
import { redLinea, punto } from './redesPrueba.js';

const red = redLinea({ tramos: 1, largo: 200, extra: { sentido: 'ambos', tipo: 'doble_sentido' } });
const geo = prepararGeometria(red);

describe('prepararGeometria', () => {
  it('cada arco tiene el largo de su vía', () => {
    expect(geo.get('t0>').largo).toBeCloseTo(red.vias.get('t0').longitud, 0);
    expect(geo.get('t0<').largo).toBeCloseTo(red.vias.get('t0').longitud, 0);
  });

  it('el arco de vuelta recorre la geometría al revés', () => {
    expect(geo.get('t0<').coords[0]).toEqual(red.vias.get('t0').geometria.at(-1));
  });
});

describe('posicionEnArco', () => {
  it('a mitad del arco devuelve el punto medio', () => {
    const g = geo.get('t0>');
    const [lon, lat] = posicionEnArco(g, g.largo / 2);
    expect(lon).toBeCloseTo(punto(100, 0)[0], 6);
    expect(lat).toBeCloseTo(punto(100, 0)[1], 6);
  });

  it('fuera de rango se queda en los extremos', () => {
    expect(posicionEnArco(geo.get('t0>'), -5)).toEqual(geo.get('t0>').coords[0]);
    expect(posicionEnArco(geo.get('t0>'), 9999)).toEqual(geo.get('t0>').coords.at(-1));
  });

  it('el desplazamiento lateral va a la derecha del sentido de marcha', () => {
    const [, latIda] = posicionEnArco(geo.get('t0>'), 100, 3);
    const [, latVuelta] = posicionEnArco(geo.get('t0<'), 100, 3);
    expect(latIda).toBeLessThan(punto(100, 0)[1]); // hacia el este, la derecha es el sur
    expect(latVuelta).toBeGreaterThan(punto(100, 0)[1]); // hacia el oeste, la derecha es el norte
  });
});

describe('direccionLlegada', () => {
  it('apunta en el sentido de marcha', () => {
    const [dx, dy] = direccionLlegada(geo.get('t0>'));
    expect(dx).toBeCloseTo(1, 3);
    expect(dy).toBeCloseTo(0, 3);
    expect(direccionLlegada(geo.get('t0<'))[0]).toBeCloseTo(-1, 3);
  });
});
