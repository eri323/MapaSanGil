import { describe, it, expect } from 'vitest';
import {
  crearEscenario, validarEscenario, aplicarEscenario, exportarEscenario, importarEscenario,
  nombreArchivo, leerEscenarios, guardarEscenario, borrarEscenario, DEMANDA_POR_DEFECTO,
} from '../../src/escenarios/escenario.js';
import { datosRedLinea } from '../sim/redesPrueba.js';

const cerrar = (via) => ({ cambio: { tipo: 'via', viaId: via, propiedades: { abierta: false } }, descripcion: `cerrar ${via}` });
const base = datosRedLinea();

describe('escenario', () => {
  it('se crea con demanda por defecto y se valida', () => {
    const e = crearEscenario({ nombre: 'Prueba', entradas: [cerrar('t1')], demanda: { temporada: 1.4 } });
    expect(e).toMatchObject({ version: 1, nombre: 'Prueba', descripcion: '', restriccionPesados: false });
    expect(e.demanda).toEqual({ ...DEMANDA_POR_DEFECTO, temporada: 1.4 });
    expect(validarEscenario(e)).toEqual([]);
  });

  it('valida nombre, demanda y entradas', () => {
    const e = crearEscenario({ nombre: '', demanda: { factor: -1, horaInicio: 30 } });
    const errores = validarEscenario({ ...e, entradas: [{ descripcion: 'sin cambio' }] }).join(' ');
    expect(errores).toMatch(/nombre/);
    expect(errores).toMatch(/factor/);
    expect(errores).toMatch(/hora/);
    expect(errores).toMatch(/cambio/);
  });

  it('se aplica sobre la red base', () => {
    const datos = aplicarEscenario(base, crearEscenario({ nombre: 'x', entradas: [cerrar('t1')] }));
    expect(datos.vias.find((v) => v.id === 't1').abierta).toBe(false);
  });

  it('exportar e importar devuelve el mismo escenario', () => {
    const e = crearEscenario({ nombre: 'Obra en la Calle 15', entradas: [cerrar('t1')], restriccionPesados: true });
    expect(importarEscenario(exportarEscenario(e), base)).toEqual(e);
  });

  it('importar rechaza lo que no es un escenario o no aplica a esta red, con mensajes claros', () => {
    expect(() => importarEscenario('no es json', base)).toThrow(/no es JSON/);
    expect(() => importarEscenario(JSON.stringify({ nombre: 'x' }), base)).toThrow(/no es un escenario/);
    const ajeno = exportarEscenario(crearEscenario({ nombre: 'Otra ciudad', entradas: [cerrar('zzz')] }));
    expect(() => importarEscenario(ajeno, base)).toThrow(/no se puede aplicar/);
  });

  it('nombre de archivo sin tildes ni espacios', () => {
    expect(nombreArchivo(crearEscenario({ nombre: 'Variante + Restricción' }))).toBe('variante-restriccion.json');
  });
});

describe('almacén de escenarios', () => {
  it('guardar reemplaza el del mismo nombre y borrar lo quita', () => {
    const a = crearEscenario({ nombre: 'A' });
    const b = crearEscenario({ nombre: 'B' });
    let lista = guardarEscenario(guardarEscenario([], a), b);
    lista = guardarEscenario(lista, { ...a, descripcion: 'nueva' });
    expect(lista.map((e) => e.nombre)).toEqual(['B', 'A']);
    expect(lista[1].descripcion).toBe('nueva');
    expect(borrarEscenario(lista, 'B').map((e) => e.nombre)).toEqual(['A']);
  });

  it('leer descarta lo ilegible o inválido', () => {
    expect(leerEscenarios('basura')).toEqual([]);
    expect(leerEscenarios(null)).toEqual([]);
    const valido = crearEscenario({ nombre: 'Bueno' });
    expect(leerEscenarios(JSON.stringify([valido, { nombre: '' }]))).toEqual([valido]);
  });
});

import { esEstadoConocido } from '../../src/escenarios/escenario.js';

describe('esEstadoConocido', () => {
  const e1 = crearEscenario({ nombre: 'Uno', entradas: [cerrar('t1')] });
  it('sin cambios, o con los mismos cambios de un escenario conocido, no hay nada que perder', () => {
    expect(esEstadoConocido([], [e1])).toBe(true);
    expect(esEstadoConocido([cerrar('t1')], [e1])).toBe(true);
  });
  it('cambios propios que no son de ningún escenario sí se perderían', () => {
    expect(esEstadoConocido([cerrar('t2')], [e1])).toBe(false);
    expect(esEstadoConocido([cerrar('t1'), cerrar('t2')], [e1])).toBe(false);
  });
});
