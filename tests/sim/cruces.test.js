import { describe, it, expect } from 'vitest';
import { analizarAccesos, puedeEntrar, semaforoEnVerde, ESPERA_CORTESIA } from '../../src/sim/cruces.js';
import { prepararGeometria } from '../../src/sim/geometriaArcos.js';
import { PERFILES } from '../../src/sim/vehiculos.js';
import { redCruce } from './redesPrueba.js';

const analizar = (opciones) => {
  const red = redCruce(opciones);
  return analizarAccesos(red, prepararGeometria(red));
};

describe('analizarAccesos', () => {
  it('prioridad: la calle cede a los dos sentidos de la avenida', () => {
    const accesos = analizar({ control: 'prioridad' });
    expect(accesos.get('oc>').tipo).toBe('prioridad');
    expect(accesos.get('ce<').tipo).toBe('prioridad');
    expect(accesos.get('nc>').tipo).toBe('cede');
    expect([...accesos.get('nc>').conflictos].sort()).toEqual(['ce<', 'oc>']);
  });

  it('pare por acceso: solo para la vía listada', () => {
    const accesos = analizar({ control: 'pare', accesosConPare: ['nc'] });
    expect(accesos.get('nc>').tipo).toBe('pare');
    expect(accesos.get('oc>').tipo).toBe('prioridad');
  });

  it('pare sin lista: para la vía de menor jerarquía', () => {
    const accesos = analizar({ control: 'pare' });
    expect(accesos.get('nc>').tipo).toBe('pare');
    expect(accesos.get('oc>').tipo).toBe('prioridad');
  });

  it('sin señal entre vías iguales: cada uno cede al de su derecha', () => {
    const iguales = { tipo: 'doble_sentido', sentido: 'ambos' };
    const accesos = analizar({ control: 'sin_senal', avenida: iguales, calle: iguales });
    // quien baja hacia el sur tiene a su derecha al que viene del oeste
    expect(accesos.get('nc>')).toMatchObject({ tipo: 'derecha', conflictos: ['oc>'] });
    // quien va hacia el este tiene a su derecha al que sube desde el sur
    expect(accesos.get('oc>')).toMatchObject({ tipo: 'derecha', conflictos: ['cs<'] });
  });

  it('glorieta: quien circula en la glorieta tiene prioridad', () => {
    const accesos = analizar({ control: 'sin_senal', avenida: { tipo: 'glorieta', sentido: 'ambos' } });
    expect(accesos.get('oc>').tipo).toBe('prioridad');
    expect(accesos.get('nc>').tipo).toBe('cede');
  });

  it('semáforo: los accesos paralelos comparten fase', () => {
    const accesos = analizar({ control: 'semaforo' });
    expect(accesos.get('oc>').tipo).toBe('semaforo');
    expect(accesos.get('oc>').grupo).toBe(accesos.get('ce<').grupo);
    expect(accesos.get('nc>').grupo).not.toBe(accesos.get('oc>').grupo);
  });
});

describe('semaforoEnVerde', () => {
  it('alterna 25 s de verde por grupo con 4 s de todo rojo', () => {
    expect(semaforoEnVerde({ grupo: 0 }, 10)).toBe(true);
    expect(semaforoEnVerde({ grupo: 1 }, 10)).toBe(false);
    expect(semaforoEnVerde({ grupo: 0 }, 27)).toBe(false);
    expect(semaforoEnVerde({ grupo: 1 }, 27)).toBe(false);
    expect(semaforoEnVerde({ grupo: 1 }, 30)).toBe(true);
    expect(semaforoEnVerde({ grupo: 0 }, 58 + 1)).toBe(true);
  });
});

describe('puedeEntrar', () => {
  const vehiculo = (extra = {}) => ({ perfil: PERFILES.carro, paroEnPare: false, esperaCruce: 0, ...extra });
  const base = { t: 100, ocupadoHasta: -Infinity, llegadas: () => Infinity };

  it('con prioridad siempre entra', () => {
    expect(puedeEntrar({ ...base, acceso: { tipo: 'prioridad', conflictos: [] }, vehiculo: vehiculo(), ocupadoHasta: 999 })).toBe(true);
  });

  it('en un pare no entra si no se ha detenido', () => {
    const acceso = { tipo: 'pare', conflictos: [] };
    expect(puedeEntrar({ ...base, acceso, vehiculo: vehiculo() })).toBe(false);
    expect(puedeEntrar({ ...base, acceso, vehiculo: vehiculo({ paroEnPare: true }) })).toBe(true);
  });

  it('no entra si el cruce está ocupado', () => {
    expect(puedeEntrar({ ...base, acceso: { tipo: 'cede', conflictos: [] }, vehiculo: vehiculo(), ocupadoHasta: 101 })).toBe(false);
  });

  it('cede si alguien con prelación llega antes de su hueco', () => {
    const acceso = { tipo: 'cede', conflictos: ['x'] };
    expect(puedeEntrar({ ...base, acceso, vehiculo: vehiculo(), llegadas: () => 2 })).toBe(false);
    expect(puedeEntrar({ ...base, acceso, vehiculo: vehiculo(), llegadas: () => 5 })).toBe(true);
  });

  it('la moto acepta huecos más cortos que el camión', () => {
    const acceso = { tipo: 'cede', conflictos: ['x'] };
    const llegadas = () => 2.5;
    expect(puedeEntrar({ ...base, acceso, llegadas, vehiculo: vehiculo({ perfil: PERFILES.moto }) })).toBe(true);
    expect(puedeEntrar({ ...base, acceso, llegadas, vehiculo: vehiculo({ perfil: PERFILES.camion }) })).toBe(false);
  });

  it('después de esperar mucho entra por cortesía si el cruce está libre', () => {
    const acceso = { tipo: 'derecha', conflictos: ['x'] };
    const largo = vehiculo({ esperaCruce: ESPERA_CORTESIA + 1 });
    expect(puedeEntrar({ ...base, acceso, vehiculo: largo, llegadas: () => 1 })).toBe(true);
    expect(puedeEntrar({ ...base, acceso, vehiculo: largo, llegadas: () => 1, ocupadoHasta: 101 })).toBe(false);
  });

  it('en semáforo depende de la fase', () => {
    expect(puedeEntrar({ ...base, t: 10, acceso: { tipo: 'semaforo', grupo: 0 }, vehiculo: vehiculo() })).toBe(true);
    expect(puedeEntrar({ ...base, t: 10, acceso: { tipo: 'semaforo', grupo: 1 }, vehiculo: vehiculo() })).toBe(false);
  });
});
