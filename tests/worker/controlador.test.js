import { describe, it, expect } from 'vitest';
import { crearReloj, crearControlador } from '../../src/worker/controlador.js';
import { datosRedLinea } from '../sim/redesPrueba.js';

describe('crearReloj', () => {
  it('a ×1 con ticks de 50 ms da un paso de 0,5 s cada 10 ticks', () => {
    const reloj = crearReloj();
    const pasos = Array.from({ length: 10 }, () => reloj.pasos(1, 50, 0.5));
    expect(pasos.slice(0, 9).every((n) => n === 0)).toBe(true);
    expect(pasos[9]).toBe(1);
  });

  it('a ×20 da dos pasos por tick y en máximo no tiene límite', () => {
    expect(crearReloj().pasos(20, 50, 0.5)).toBe(2);
    expect(crearReloj().pasos('max', 50, 0.5)).toBe(Infinity);
  });
});

describe('crearControlador', () => {
  const armar = () => {
    const enviados = [];
    const controlador = crearControlador((m) => enviados.push(m), { ahora: () => 0, presupuestoMs: 35 });
    return { enviados, controlador };
  };

  it('ignora órdenes antes de iniciar', () => {
    const { enviados, controlador } = armar();
    expect(() => {
      controlador.recibir({ tipo: 'reloj', corriendo: true, velocidad: 5 });
      controlador.recibir({ tipo: 'demanda', parcial: { factor: 2 } });
      controlador.tick(50);
    }).not.toThrow();
    expect(enviados).toEqual([]);
  });

  it('una red inválida responde un error legible', () => {
    const { enviados, controlador } = armar();
    controlador.recibir({ tipo: 'iniciar', datosRed: { version: 1 }, opciones: {} });
    expect(enviados).toEqual([expect.objectContaining({ tipo: 'error', mensaje: expect.stringMatching(/Red inválida/) })]);
  });

  it('al iniciar envía un cuadro y un resumen; corriendo, avanza el tiempo', () => {
    const { enviados, controlador } = armar();
    controlador.recibir({ tipo: 'iniciar', datosRed: datosRedLinea(), opciones: { conDemanda: false } });
    expect(enviados.map((m) => m.tipo)).toEqual(['cuadro', 'resumen']);
    controlador.tick(50);
    expect(enviados).toHaveLength(2); // en pausa no avanza
    controlador.recibir({ tipo: 'reloj', corriendo: true, velocidad: 20 });
    controlador.tick(50);
    const cuadro = enviados.at(-1);
    expect(cuadro.tipo).toBe('cuadro');
    expect(cuadro.t).toBe(1);
  });
});
