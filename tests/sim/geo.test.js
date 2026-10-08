import { describe, it, expect } from 'vitest';
import { distanciaMetros, longitudLinea, puntoALoLargo, anguloPantalla } from '../../src/sim/geo.js';

const A = [-73.137, 6.555];
const B = [-73.136, 6.555]; // 0,001° al este de A: unos 110,5 m
const C = [-73.136, 6.556]; // 0,001° al norte de B: unos 111,2 m

describe('geo', () => {
  it('distancia entre dos puntos cercanos', () => {
    const d = distanciaMetros(A, B);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(111);
  });

  it('longitud de una línea es la suma de sus tramos', () => {
    expect(longitudLinea([A, B, C])).toBeCloseTo(distanciaMetros(A, B) + distanciaMetros(B, C), 6);
    expect(longitudLinea([A])).toBe(0);
  });

  it('punto a lo largo de la línea', () => {
    const mitad = puntoALoLargo([A, B], distanciaMetros(A, B) / 2);
    expect(mitad.segmento).toBe(0);
    expect(mitad.posicion[0]).toBeCloseTo(-73.1365, 6);
    expect(mitad.posicion[1]).toBeCloseTo(6.555, 6);

    const enSegundoTramo = puntoALoLargo([A, B, C], distanciaMetros(A, B) + 10);
    expect(enSegundoTramo.segmento).toBe(1);

    const masAlla = puntoALoLargo([A, B], 99999);
    expect(masAlla.posicion).toEqual(B);
  });

  it('ángulo en pantalla: este 0°, norte 90°, oeste 180°', () => {
    expect(anguloPantalla(A, B)).toBeCloseTo(0, 6);
    expect(anguloPantalla(B, C)).toBeCloseTo(90, 6);
    expect(Math.abs(anguloPantalla(B, A))).toBeCloseTo(180, 6);
  });
});
