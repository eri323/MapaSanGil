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
