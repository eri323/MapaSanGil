import { describe, it, expect } from 'vitest';
import { evaluarImpacto } from '../../src/escenarios/impacto.js';
import { aplicarCambio } from '../../src/escenarios/cambios.js';
import { datosRedLinea, punto } from '../sim/redesPrueba.js';

const linea = () => datosRedLinea({ extra: { sentido: 'ambos', tipo: 'doble_sentido' } });
const [lonC, latC] = punto(0, 0);
const [lonX, latX] = punto(600, 0);
const zonas = { centro: { nombre: 'Centro', lon: lonC, lat: latC, peso: 1 } };
const salidas = { este: { nombre: 'Salida al este', nodo: 'n3', avenida: true } };

describe('evaluarImpacto', () => {
  it('un cambio que no desconecta nada no pide confirmación', () => {
    const antes = linea();
    const despues = aplicarCambio(antes, { tipo: 'via', viaId: 't1', propiedades: { estado: 'huecos' } });
    expect(evaluarImpacto(antes, despues, zonas, salidas)).toEqual({ aisladas: [], perdidos: 0, requiereConfirmacion: false });
  });

  it('cerrar la vía que une la salida avisa qué queda aislado', () => {
    const antes = linea();
    const despues = aplicarCambio(antes, { tipo: 'via', viaId: 't2', propiedades: { abierta: false } });
    const r = evaluarImpacto(antes, despues, { ...zonas, otra: { nombre: 'Zona del este', lon: lonX, lat: latX, peso: 1 } }, salidas);
    expect(r.requiereConfirmacion).toBe(true);
    expect(r.aisladas.length).toBeGreaterThan(0);
    expect(r.perdidos).toBeGreaterThan(0);
  });
});
