import { describe, it, expect } from 'vitest';
import { validarRed, crearRed, arcoTransitable, alcanzables, componentePrincipal } from '../../src/sim/red.js';

const via = (id, desde, hasta, extra = {}) => ({
  id, osmId: 1, nombre: '', desde, hasta,
  geometria: [[0, 0], [0, 0.001]], longitud: 111,
  tipo: 'doble_sentido', sentido: 'ambos', carrilesPorSentido: 1,
  superficie: 'pavimento', estado: 'bueno', velocidadMax: 30,
  abierta: true, enConstruccion: false, esPuente: false,
  ...extra,
});

// a --(un sentido)--> b <--(doble)--> c
const datos = (extra = {}) => ({
  version: 1, generado: '2026-10-08T00:00:00Z', fuente: 'test', bbox: null,
  nodos: ['a', 'b', 'c'].map((id) => ({ id, lon: 0, lat: 0, control: 'sin_senal' })),
  vias: [
    via('ab', 'a', 'b', { tipo: 'un_sentido', sentido: 'adelante' }),
    via('bc', 'b', 'c', extra.bc),
  ],
});

describe('validarRed', () => {
  it('una red bien formada no tiene errores', () => {
    expect(validarRed(datos())).toEqual([]);
  });

  it('reporta nodos inexistentes, geometrías cortas y valores desconocidos', () => {
    const d = datos();
    d.vias[0].hasta = 'zzz';
    d.vias[1].geometria = [[0, 0]];
    d.vias[1].tipo = 'autopista';
    d.nodos[0].control = 'rotonda';
    const errores = validarRed(d).join('\n');
    expect(errores).toContain('ab');
    expect(errores).toContain('zzz');
    expect(errores).toContain('geometría');
    expect(errores).toContain('autopista');
    expect(errores).toContain('rotonda');
  });

  it('rechaza versiones y estructuras inesperadas', () => {
    expect(validarRed(null)).not.toEqual([]);
    expect(validarRed({ version: 2, nodos: [], vias: [] })[0]).toContain('Versión');
    expect(validarRed({ version: 1 })).not.toEqual([]);
  });
});

describe('crearRed', () => {
  it('construye arcos dirigidos según el sentido', () => {
    const red = crearRed(datos());
    expect([...red.arcos.keys()].sort()).toEqual(['ab>', 'bc<', 'bc>']);
    expect(red.salientes.get('a')).toEqual(['ab>']);
    expect(red.salientes.get('b')).toEqual(['bc>']);
    expect(red.salientes.get('c')).toEqual(['bc<']);
    expect(red.arcos.get('bc<')).toMatchObject({ desde: 'c', hasta: 'b', adelante: false });
  });

  it('lanza un error legible si la red es inválida', () => {
    const d = datos();
    d.vias[0].desde = 'zzz';
    expect(() => crearRed(d)).toThrow(/^Red inválida/);
  });
});

describe('alcanzables y arcos transitables', () => {
  it('respeta el sentido de las vías', () => {
    const red = crearRed(datos());
    expect(alcanzables(red, 'a')).toEqual(new Set(['a', 'b', 'c']));
    expect(alcanzables(red, 'c')).toEqual(new Set(['c', 'b']));
  });

  it('una vía cerrada no se puede transitar', () => {
    const red = crearRed(datos({ bc: { abierta: false } }));
    expect(arcoTransitable(red, 'bc>')).toBe(false);
    expect(alcanzables(red, 'a')).toEqual(new Set(['a', 'b']));
  });

  it('una vía en construcción no se puede transitar', () => {
    const red = crearRed(datos({ bc: { enConstruccion: true } }));
    expect(arcoTransitable(red, 'bc>')).toBe(false);
    expect(alcanzables(red, 'a')).toEqual(new Set(['a', 'b']));
  });
});

describe('validarRed · ids únicos y valores físicos', () => {
  it('rechaza ids de nodo o de vía repetidos', () => {
    const d = datos();
    d.nodos.push({ id: 'a', lon: 1, lat: 1, control: 'sin_senal' });
    d.vias.push(via('ab', 'b', 'c'));
    const errores = validarRed(d).join('\n');
    expect(errores).toContain('Nodo a: id repetido');
    expect(errores).toContain('Vía ab: id repetido');
  });

  it('rechaza longitud, velocidad o carriles en cero y vías de un nodo a sí mismo', () => {
    const d = datos();
    d.vias[0].longitud = 0;
    d.vias[0].velocidadMax = 0;
    d.vias[0].carrilesPorSentido = 0;
    d.vias[1].hasta = 'b';
    const errores = validarRed(d).join('\n');
    expect(errores).toContain('longitud');
    expect(errores).toContain('velocidad');
    expect(errores).toContain('carriles');
    expect(errores).toContain('mismo nodo');
  });

  it('accesosConPare debe nombrar vías que llegan a ese nodo', () => {
    const d = datos();
    d.nodos[1].accesosConPare = ['ab'];
    expect(validarRed(d)).toEqual([]);
    d.nodos[1].accesosConPare = ['zzz'];
    expect(validarRed(d).join('\n')).toContain('zzz');
  });
});

describe('entrantes y componente principal', () => {
  it('indexa los arcos que llegan a cada nodo', () => {
    const red = crearRed(datos());
    expect(red.entrantes.get('a')).toEqual([]);
    expect(red.entrantes.get('b').sort()).toEqual(['ab>', 'bc<']);
    expect(red.entrantes.get('c')).toEqual(['bc>']);
  });

  it('el componente principal deja por fuera los nodos de los que no se puede volver', () => {
    // a -> b <-> c : desde b y c no se vuelve a a
    expect(componentePrincipal(crearRed(datos()))).toEqual(new Set(['b', 'c']));
  });
});
