import { describe, it, expect } from 'vitest';
import { osmARed } from '../../scripts/lib/osmARed.js';

const nodo = (id, lon, lat, tags) => ({ type: 'node', id, lon, lat, ...(tags && { tags }) });
const way = (id, nodes, tags = {}) => ({ type: 'way', id, nodes, tags: { highway: 'residential', ...tags } });

// Cruz: una calle de doble sentido (1-2-3) y una de un sentido (4-2-5) que se cortan en 2.
const cruz = (extras = []) => ({
  elements: [
    nodo(1, -73.137, 6.555), nodo(2, -73.136, 6.555), nodo(3, -73.135, 6.555),
    nodo(4, -73.136, 6.556), nodo(5, -73.136, 6.554),
    way(100, [1, 2, 3]),
    way(200, [4, 2, 5], { oneway: 'yes' }),
    ...extras,
  ],
});

const porId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]));

describe('osmARed', () => {
  it('corta las vías en los cruces', () => {
    const { nodos, vias } = osmARed(cruz());
    expect(nodos.map((n) => n.id).sort()).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
    expect(vias.map((v) => v.id).sort()).toEqual(['v100_0', 'v100_1', 'v200_0', 'v200_1']);

    const v = porId(vias);
    expect(v.v100_0).toMatchObject({ desde: 'n1', hasta: 'n2', tipo: 'doble_sentido', sentido: 'ambos', abierta: true });
    expect(v.v200_0).toMatchObject({ desde: 'n4', hasta: 'n2', tipo: 'un_sentido', sentido: 'adelante' });
    expect(v.v100_0.geometria).toEqual([[-73.137, 6.555], [-73.136, 6.555]]);
    expect(v.v100_0.longitud).toBeGreaterThan(110);
    expect(v.v100_0.longitud).toBeLessThan(111);
  });

  it('cruce entre vías de distinta jerarquía es de prioridad; los extremos, sin señal', () => {
    const n = porId(osmARed(cruz()).nodos);
    expect(n.n2.control).toBe('prioridad');
    expect(n.n1.control).toBe('sin_senal');
  });

  it('ningún nodo empieza con semáforo', () => {
    const { nodos } = osmARed(cruz());
    expect(nodos.every((n) => n.control !== 'semaforo')).toBe(true);
  });

  it('un nodo de pare a mitad de vía marca el cruce más cercano', () => {
    const conPare = cruz([nodo(10, -73.136, 6.5552, { highway: 'stop' })]);
    conPare.elements.find((e) => e.id === 200).nodes = [4, 10, 2, 5];
    const { nodos, pares } = osmARed(conPare);
    expect(porId(nodos).n2.control).toBe('pare');
    expect(pares).toBe(1);
  });

  it('oneway=-1 invierte la geometría', () => {
    const { vias } = osmARed({
      elements: [nodo(6, -73.137, 6.555), nodo(7, -73.136, 6.555), way(300, [6, 7], { oneway: '-1' })],
    });
    expect(vias).toHaveLength(1);
    expect(vias[0]).toMatchObject({ desde: 'n7', hasta: 'n6', sentido: 'adelante' });
    expect(vias[0].geometria[0]).toEqual([-73.136, 6.555]);
  });

  it('omite nodos que Overpass no devolvió', () => {
    const { vias } = osmARed({
      elements: [nodo(1, -73.137, 6.555), nodo(2, -73.136, 6.555), way(100, [1, 999, 2])],
    });
    expect(vias).toHaveLength(1);
    expect(vias[0].geometria).toHaveLength(2);
  });

  it('descarta vías sin nodos suficientes', () => {
    const { vias } = osmARed({ elements: [nodo(1, -73.137, 6.555), way(100, [1, 999])] });
    expect(vias).toHaveLength(0);
  });

  it('glorieta cerrada se corta en sus cruces y no deja lazos', () => {
    const { vias } = osmARed({
      elements: [
        nodo(20, -73.1360, 6.5550), nodo(21, -73.1355, 6.5555), nodo(22, -73.1350, 6.5550),
        nodo(23, -73.1355, 6.5565),
        way(500, [20, 21, 22, 20], { junction: 'roundabout', highway: 'tertiary' }),
        way(600, [23, 21]),
      ],
    });
    expect(vias.every((v) => v.desde !== v.hasta)).toBe(true);
    expect(vias.filter((v) => v.tipo === 'glorieta')).toHaveLength(2);
  });

  it('se queda con la parte conectada más grande y cuenta lo descartado', () => {
    const { vias, descartadas } = osmARed(cruz([
      nodo(8, -73.120, 6.570), nodo(9, -73.119, 6.570), way(400, [8, 9]),
    ]));
    expect(vias.some((v) => v.osmId === 400)).toBe(false);
    expect(descartadas).toBe(1);
  });

  it('ignora vías no vehiculares', () => {
    const { vias } = osmARed(cruz([way(700, [1, 4], { highway: 'footway' })]));
    expect(vias.some((v) => v.osmId === 700)).toBe(false);
  });
});

describe('osmARed · casos de la revisión', () => {
  it('una calle en lazo unida solo por su nodo de cierre se parte en dos y no desaparece', () => {
    const { vias, nodos } = osmARed({
      elements: [
        nodo(1, -73.137, 6.555), nodo(2, -73.136, 6.555),
        nodo(31, -73.1350, 6.5550), nodo(32, -73.1345, 6.5555), nodo(33, -73.1350, 6.5560),
        way(100, [1, 2, 31]),
        way(800, [31, 32, 33, 31]),
      ],
    });
    const lazo = vias.filter((v) => v.osmId === 800);
    expect(lazo).toHaveLength(2);
    expect(lazo.every((v) => v.desde !== v.hasta)).toBe(true);
    expect(nodos.some((n) => n.id === 'n32' || n.id === 'n33')).toBe(true);
  });

  it('una piruleta [A,B,C,B,D] conserva el tramo B-C-B partido en C', () => {
    const { vias } = osmARed({
      elements: [
        nodo(41, -73.137, 6.555), nodo(42, -73.136, 6.555), nodo(43, -73.136, 6.556),
        nodo(44, -73.135, 6.555),
        way(900, [41, 42, 43, 42, 44]),
      ],
    });
    expect(vias.filter((v) => v.osmId === 900)).toHaveLength(4);
    expect(vias.every((v) => v.desde !== v.hasta)).toBe(true);
  });

  it('un tramo de menos de medio metro une sus dos nodos en vez de cortar la red', () => {
    const { vias, nodos, descartadas } = osmARed({
      elements: [
        nodo(1, -73.137, 6.555), nodo(2, -73.136, 6.555),
        nodo(3, -73.136000001, 6.555), nodo(4, -73.135, 6.555),
        way(100, [1, 2]),
        way(150, [2, 3]),
        way(200, [3, 4]),
      ],
    });
    expect(descartadas).toBe(0);
    expect(vias).toHaveLength(2);
    expect(nodos).toHaveLength(3);
    const ids = new Set(nodos.map((n) => n.id));
    for (const v of vias) {
      expect(ids.has(v.desde)).toBe(true);
      expect(ids.has(v.hasta)).toBe(true);
    }
  });

  it('el pare en una vía de un sentido nunca marca el cruce de salida, aunque esté más cerca', () => {
    // vía de un sentido 4 -> 2; la señal está a 10 m de 4 (salida) y a 100 m de 2 (llegada)
    const conPare = cruz([nodo(10, -73.136, 6.55591, { highway: 'stop' })]);
    conPare.elements.find((e) => e.id === 200).nodes = [4, 10, 2, 5];
    const { nodos, pares } = osmARed(conPare);
    expect(porId(nodos).n4.control).not.toBe('pare');
    expect(pares).toBe(0);
  });

  it('el pare respeta direction=backward en vías de doble sentido', () => {
    // señal a 22 m de n2, pero direction=backward: aplica a quien va hacia n1
    const conPare = cruz([nodo(11, -73.1362, 6.555, { highway: 'stop', direction: 'backward' })]);
    conPare.elements.find((e) => e.id === 100).nodes = [1, 11, 2, 3];
    const n = porId(osmARed(conPare).nodos);
    expect(n.n2.control).not.toBe('pare');
  });

  it('el pare queda registrado por acceso: solo la vía donde está la señal', () => {
    const conPare = cruz([nodo(10, -73.136, 6.5552, { highway: 'stop' })]);
    conPare.elements.find((e) => e.id === 200).nodes = [4, 10, 2, 5];
    const n = porId(osmARed(conPare).nodos);
    expect(n.n2.accesosConPare).toEqual(['v200_0']);
  });

  it('pone el nombre común a los puentes conocidos', () => {
    const { vias } = osmARed(cruz(), { nombresPuentes: { 100: 'Puente de prueba' } });
    expect(vias.filter((v) => v.osmId === 100).every((v) => v.nombrePuente === 'Puente de prueba')).toBe(true);
    expect(vias.find((v) => v.osmId === 200).nombrePuente).toBeUndefined();
  });
});
