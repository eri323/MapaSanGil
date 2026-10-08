import { describe, it, expect } from 'vitest';
import {
  HISTORIAL_VACIO, agregar, deshacer, rehacer, puedeDeshacer, puedeRehacer, activos, serializar, deserializar,
} from '../../src/escenarios/historial.js';

const e = (n) => ({ cambio: { tipo: 'via', viaId: `v${n}`, propiedades: { abierta: false } }, descripcion: `cambio ${n}` });

describe('historial', () => {
  it('agregar, deshacer y rehacer', () => {
    let h = agregar(agregar(HISTORIAL_VACIO, e(1)), e(2));
    expect(activos(h).map((c) => c.viaId)).toEqual(['v1', 'v2']);
    h = deshacer(h);
    expect(activos(h).map((c) => c.viaId)).toEqual(['v1']);
    expect(puedeRehacer(h)).toBe(true);
    h = rehacer(h);
    expect(activos(h)).toHaveLength(2);
  });

  it('un cambio nuevo después de deshacer descarta lo que se podía rehacer', () => {
    const h = agregar(deshacer(agregar(agregar(HISTORIAL_VACIO, e(1)), e(2))), e(3));
    expect(activos(h).map((c) => c.viaId)).toEqual(['v1', 'v3']);
    expect(puedeRehacer(h)).toBe(false);
  });

  it('no deshace ni rehace más allá de los límites', () => {
    expect(puedeDeshacer(HISTORIAL_VACIO)).toBe(false);
    expect(deshacer(HISTORIAL_VACIO)).toBe(HISTORIAL_VACIO);
    expect(rehacer(HISTORIAL_VACIO)).toBe(HISTORIAL_VACIO);
  });

  it('se serializa y se recupera; lo dañado devuelve null', () => {
    const h = deshacer(agregar(agregar(HISTORIAL_VACIO, e(1)), e(2)));
    expect(deserializar(serializar(h))).toEqual(h);
    expect(deserializar('no es json')).toBeNull();
    expect(deserializar(null)).toBeNull();
    expect(deserializar(JSON.stringify({ version: 9, entradas: [], indice: 0 }))).toBeNull();
    expect(deserializar(JSON.stringify({ version: 1, entradas: [e(1)], indice: 7 })).indice).toBe(1);
  });
});

import { recuperarHistorial, agregarValidado } from '../../src/escenarios/historial.js';
import { datosRedLinea } from '../sim/redesPrueba.js';

describe('historial validado contra la red', () => {
  const cerrar = (via) => ({ cambio: { tipo: 'via', viaId: via, propiedades: { abierta: false } }, descripcion: `cerrar ${via}` });

  it('al recuperar, conserva solo la parte que se puede aplicar, incluidos los pasos por rehacer', () => {
    const base = datosRedLinea();
    const guardado = serializar({ entradas: [cerrar('t0'), cerrar('t1'), cerrar('no-existe'), cerrar('t2')], indice: 1 });
    const h = recuperarHistorial(base, guardado);
    expect(h.entradas.map((e) => e.cambio.viaId)).toEqual(['t0', 't1']);
    expect(h.indice).toBe(1);
  });

  it('un historial ilegible o que no aplica desde el inicio queda vacío', () => {
    const base = datosRedLinea();
    expect(recuperarHistorial(base, 'basura')).toEqual(HISTORIAL_VACIO);
    expect(recuperarHistorial(base, serializar({ entradas: [cerrar('zzz')], indice: 0 }))).toEqual(HISTORIAL_VACIO);
  });

  it('agregar validado rechaza un cambio que ya no aplica sobre el historial actual', () => {
    const base = datosRedLinea();
    const h = agregar(HISTORIAL_VACIO, cerrar('t0'));
    expect(agregarValidado(base, h, cerrar('t1')).indice).toBe(2);
    expect(() => agregarValidado(base, h, cerrar('zzz'))).toThrow(/no existe/);
  });
});

import { historialDesdeEntradas } from '../../src/escenarios/historial.js';

describe('historialDesdeEntradas', () => {
  const cerrar = (via) => ({ cambio: { tipo: 'via', viaId: via, propiedades: { abierta: false } }, descripcion: via });

  it('arma un historial con todas las entradas activas', () => {
    const h = historialDesdeEntradas(datosRedLinea(), [cerrar('t0'), cerrar('t1')]);
    expect(h.indice).toBe(2);
    expect(activos(h)).toHaveLength(2);
  });

  it('lanza si alguna entrada no aplica', () => {
    expect(() => historialDesdeEntradas(datosRedLinea(), [cerrar('zzz')])).toThrow(/no existe/);
  });
});
