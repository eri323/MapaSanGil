import { describe, it, expect } from 'vitest';
import { aplicarCorrecciones } from '../../scripts/lib/correcciones.js';

const base = () => ({
  elements: [
    { type: 'node', id: 1, lon: 0, lat: 0 },
    { type: 'node', id: 2, lon: 0.001, lat: 0 },
    { type: 'way', id: 10, nodes: [1, 2], tags: { highway: 'pedestrian' } },
  ],
});

describe('aplicarCorrecciones', () => {
  it('agrega una vía vehicular nueva entre nodos existentes', () => {
    const r = aplicarCorrecciones(base(), { viasAgregadas: [{ id: 99, nodes: [1, 2], tags: { highway: 'residential', oneway: 'yes' } }] });
    expect(r.elements.find((e) => e.id === 99)).toEqual({ type: 'way', id: 99, nodes: [1, 2], tags: { highway: 'residential', oneway: 'yes' } });
  });

  it('reemplaza la vía de OSM con el mismo id', () => {
    const r = aplicarCorrecciones(base(), { viasAgregadas: [{ id: 10, nodes: [1, 2], tags: { highway: 'residential' } }] });
    const vias = r.elements.filter((e) => e.type === 'way' && e.id === 10);
    expect(vias).toHaveLength(1);
    expect(vias[0].tags.highway).toBe('residential');
  });

  it('falla con un mensaje claro si un nodo no existe en los datos', () => {
    expect(() => aplicarCorrecciones(base(), { viasAgregadas: [{ id: 99, nodes: [1, 7], tags: { name: 'Calle X' } }] }))
      .toThrow(/Calle X.*7/);
  });

  it('sin correcciones devuelve los mismos elementos', () => {
    expect(aplicarCorrecciones(base()).elements).toEqual(base().elements);
  });
});

import { aplicarEstadosCampo } from '../../scripts/lib/correcciones.js';

describe('aplicarEstadosCampo', () => {
  const vias = [
    { id: 'a', nombre: 'Carrera 1', estado: 'bueno', superficie: 'pavimento' },
    { id: 'b', nombre: 'Calle 12', estado: 'bueno', superficie: 'pavimento' },
  ];

  it('cambia estado y superficie de las vías nombradas, sin tocar las demás ni los datos originales', () => {
    const r = aplicarEstadosCampo(vias, [{ nombres: ['Carrera 1'], estado: 'huecos', superficie: 'destapado', nota: 'x' }]);
    expect(r[0]).toMatchObject({ estado: 'huecos', superficie: 'destapado' });
    expect(r[1]).toBe(vias[1]);
    expect(vias[0].estado).toBe('bueno');
  });

  it('una regla puede cambiar solo el estado', () => {
    const r = aplicarEstadosCampo(vias, [{ nombres: ['Calle 12'], estado: 'regular', nota: 'x' }]);
    expect(r[1]).toMatchObject({ estado: 'regular', superficie: 'pavimento' });
  });

  it('sin reglas devuelve las mismas vías', () => {
    expect(aplicarEstadosCampo(vias)).toEqual(vias);
  });
});
