import { describe, it, expect } from 'vitest';
import { cargarRed } from '../../src/ui/datos/cargarRed.js';

const redMinima = {
  version: 1, generado: 'x', fuente: 'test', bbox: null,
  nodos: [
    { id: 'a', lon: 0, lat: 0, control: 'sin_senal' },
    { id: 'b', lon: 0, lat: 0.001, control: 'sin_senal' },
  ],
  vias: [{
    id: 'ab', osmId: 1, nombre: '', desde: 'a', hasta: 'b',
    geometria: [[0, 0], [0, 0.001]], longitud: 111,
    tipo: 'doble_sentido', sentido: 'ambos', carrilesPorSentido: 1,
    superficie: 'pavimento', estado: 'bueno', velocidadMax: 30,
    abierta: true, enConstruccion: false, esPuente: false,
  }],
};

const respuesta = ({ ok = true, status = 200, json }) => async () => ({ ok, status, json });

describe('cargarRed', () => {
  it('devuelve la red construida', async () => {
    const red = await cargarRed(respuesta({ json: async () => redMinima }));
    expect(red.vias.size).toBe(1);
    expect(red.arcos.size).toBe(2);
  });

  it('archivo ausente (HTTP 404) indica cómo generarlo', async () => {
    await expect(cargarRed(respuesta({ ok: false, status: 404 })))
      .rejects.toThrow(/HTTP 404.*npm run red/);
  });

  it('respuesta que no es JSON (Vite devuelve index.html) indica cómo generarlo', async () => {
    const noJson = respuesta({ json: async () => { throw new SyntaxError('Unexpected token <'); } });
    await expect(cargarRed(noJson)).rejects.toThrow(/npm run red/);
  });

  it('fallo de red se reporta con su causa', async () => {
    const caido = async () => { throw new Error('sin conexión'); };
    await expect(cargarRed(caido)).rejects.toThrow(/sin conexión/);
  });

  it('red con datos inválidos se reporta', async () => {
    await expect(cargarRed(respuesta({ json: async () => ({ version: 1 }) })))
      .rejects.toThrow(/Red inválida/);
  });
});
