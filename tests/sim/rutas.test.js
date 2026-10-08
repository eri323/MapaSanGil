import { describe, it, expect } from 'vitest';
import { rutaMasRapida, crearTiempos } from '../../src/sim/rutas.js';
import { prepararGeometria } from '../../src/sim/geometriaArcos.js';
import { redDosRutas } from './redesPrueba.js';

const red = redDosRutas();
const geo = prepararGeometria(red);
const porLargo = (arcoId) => geo.get(arcoId).largo;

describe('rutaMasRapida', () => {
  it('toma el camino más corto', () => {
    expect(rutaMasRapida(red, 'a', 'd', porLargo).arcos).toEqual(['ab>', 'bd>']);
  });

  it('evita los arcos con costo infinito', () => {
    const sinDirecta = (id) => (id === 'bd>' ? Infinity : porLargo(id));
    expect(rutaMasRapida(red, 'a', 'd', sinDirecta).arcos).toEqual(['ab>', 'bm>', 'md>']);
  });

  it('devuelve null si no hay camino respetando sentidos', () => {
    expect(rutaMasRapida(red, 'd', 'a', porLargo)).toBeNull();
  });

  it('origen igual a destino es una ruta vacía', () => {
    expect(rutaMasRapida(red, 'b', 'b', porLargo)).toEqual({ arcos: [], tiempo: 0 });
  });
});

describe('crearTiempos', () => {
  it('el tiempo libre es largo / velocidad de referencia', () => {
    const tiempos = crearTiempos(red, geo);
    expect(tiempos.libre('ab>')).toBeCloseTo(geo.get('ab>').largo / (30 / 3.6), 3);
  });

  it('el estimado nunca es menor que el libre y sigue a lo medido', () => {
    const tiempos = crearTiempos(red, geo);
    const libre = tiempos.libre('ab>');
    tiempos.registrar('ab>', 1);
    expect(tiempos.estimado('ab>')).toBe(libre);
    tiempos.registrar('ab>', 100);
    expect(tiempos.estimado('ab>')).toBeCloseTo(0.7 * 1 + 0.3 * 100, 6);
  });

  it('una espera en el frente del arco lo encarece', () => {
    const tiempos = crearTiempos(red, geo);
    tiempos.marcarEspera('bd>', 50);
    expect(tiempos.estimado('bd>')).toBeCloseTo(tiempos.libre('bd>') + 50, 6);
  });

  it('con tiempos medidos altos en la directa, la ruta cambia a la alterna', () => {
    const tiempos = crearTiempos(red, geo);
    for (let k = 0; k < 5; k++) tiempos.registrar('bd>', 300);
    expect(rutaMasRapida(red, 'a', 'd', tiempos.estimado).arcos).toEqual(['ab>', 'bm>', 'md>']);
  });
});
