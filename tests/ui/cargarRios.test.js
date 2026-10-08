import { describe, it, expect } from 'vitest';
import { cargarRios, urlRios } from '../../src/ui/datos/cargarRios.js';

const respuesta = (cuerpo, ok = true) => async () => ({ ok, status: ok ? 200 : 404, json: async () => cuerpo });

describe('cargarRios', () => {
  it('devuelve las geometrías de los ríos', async () => {
    const rios = await cargarRios(respuesta({ version: 1, rios: [{ nombre: 'Río Fonce', geometria: [[0, 0], [1, 1]] }] }));
    expect(rios).toEqual([[[0, 0], [1, 1]]]);
  });

  it('ante cualquier error devuelve una lista vacía', async () => {
    expect(await cargarRios(respuesta(null, false))).toEqual([]);
    expect(await cargarRios(async () => { throw new Error('sin red'); })).toEqual([]);
    expect(await cargarRios(respuesta({ version: 1 }))).toEqual([]);
  });

  it('la URL es relativa a la base de la app', () => {
    expect(urlRios('/MapaSanGil/')).toBe('/MapaSanGil/data/rios.json');
  });
});
