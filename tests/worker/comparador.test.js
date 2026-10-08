import { describe, it, expect } from 'vitest';
import { crearControladorComparador, filtrarPorId } from '../../src/worker/comparador.js';
import { crearEscenario } from '../../src/escenarios/escenario.js';
import { datosRedLinea } from '../sim/redesPrueba.js';

const base = datosRedLinea({ extra: { sentido: 'ambos', tipo: 'doble_sentido' } });

describe('controlador del comparador', () => {
  it('informa el progreso y entrega el resultado con el mismo id', () => {
    const enviados = [];
    const c = crearControladorComparador((m) => enviados.push(m));
    c.recibir({
      tipo: 'comparar', id: 7, base,
      escenarios: [crearEscenario({ nombre: 'A', demanda: { horaInicio: 11, factor: 0.3 } })],
      opciones: { semillas: [1, 2], duracion: 120 },
    });
    expect(enviados.map((m) => m.tipo)).toEqual(['progreso', 'progreso', 'resultado']);
    expect(enviados.every((m) => m.id === 7)).toBe(true);
    expect(enviados[2].resultado.resultados[0].nombre).toBe('A');
  });

  it('un escenario que no aplica responde error', () => {
    const enviados = [];
    const c = crearControladorComparador((m) => enviados.push(m));
    const malo = crearEscenario({ nombre: 'Malo', entradas: [{ cambio: { tipo: 'via', viaId: 'zzz', propiedades: { abierta: false } }, descripcion: '' }] });
    c.recibir({ tipo: 'comparar', id: 1, base, escenarios: [malo], opciones: { semillas: [1], duracion: 60 } });
    expect(enviados).toEqual([expect.objectContaining({ tipo: 'error', id: 1, mensaje: expect.stringMatching(/no existe/) })]);
  });
});

describe('filtrarPorId', () => {
  it('deja pasar solo los mensajes del pedido vigente', () => {
    const recibidos = [];
    let vigente = 2;
    const filtro = filtrarPorId(() => vigente, (m) => recibidos.push(m));
    filtro({ tipo: 'resultado', id: 1 });
    filtro({ tipo: 'progreso', id: 2 });
    vigente = 3;
    filtro({ tipo: 'resultado', id: 2 });
    expect(recibidos).toEqual([{ tipo: 'progreso', id: 2 }]);
  });
});
