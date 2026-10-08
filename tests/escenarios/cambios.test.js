import { describe, it, expect } from 'vitest';
import { aplicarCambio, aplicarCambios } from '../../src/escenarios/cambios.js';
import { validarRed } from '../../src/sim/red.js';
import { datosRedLinea, armarDatos, viaEntre } from '../sim/redesPrueba.js';

const viaDe = (datos, id) => datos.vias.find((v) => v.id === id);
const nodoDe = (datos, id) => datos.nodos.find((n) => n.id === id);

describe('cambio de propiedades de una vía', () => {
  it('cierra una vía sin modificar los datos originales', () => {
    const datos = datosRedLinea();
    const nuevos = aplicarCambio(datos, { tipo: 'via', viaId: 't1', propiedades: { abierta: false } });
    expect(viaDe(nuevos, 't1').abierta).toBe(false);
    expect(viaDe(datos, 't1').abierta).toBe(true);
    expect(validarRed(nuevos)).toEqual([]);
  });

  it('pasar a doble sentido convierte un sentido en doble sentido, y al revés', () => {
    const datos = datosRedLinea();
    const doble = aplicarCambio(datos, { tipo: 'via', viaId: 't0', propiedades: { sentido: 'ambos' } });
    expect(viaDe(doble, 't0')).toMatchObject({ sentido: 'ambos', tipo: 'doble_sentido' });
    const unico = aplicarCambio(doble, { tipo: 'via', viaId: 't0', propiedades: { sentido: 'adelante' } });
    expect(viaDe(unico, 't0')).toMatchObject({ sentido: 'adelante', tipo: 'un_sentido' });
  });

  it('una avenida conserva su tipo al cambiar de sentido', () => {
    const datos = datosRedLinea({ extra: { tipo: 'avenida_nacional', sentido: 'ambos' } });
    const r = aplicarCambio(datos, { tipo: 'via', viaId: 't0', propiedades: { sentido: 'adelante' } });
    expect(viaDe(r, 't0').tipo).toBe('avenida_nacional');
  });

  it('cambia estado, superficie, velocidad y carriles', () => {
    const r = aplicarCambio(datosRedLinea(), {
      tipo: 'via', viaId: 't0',
      propiedades: { estado: 'huecos', superficie: 'destapado', velocidadMax: 20, carrilesPorSentido: 2 },
    });
    expect(viaDe(r, 't0')).toMatchObject({ estado: 'huecos', superficie: 'destapado', velocidadMax: 20, carrilesPorSentido: 2 });
  });

  it('rechaza propiedades desconocidas o valores inválidos', () => {
    const datos = datosRedLinea();
    expect(() => aplicarCambio(datos, { tipo: 'via', viaId: 't0', propiedades: { desde: 'n3' } })).toThrow(/no editable/);
    expect(() => aplicarCambio(datos, { tipo: 'via', viaId: 't0', propiedades: { estado: 'roto' } })).toThrow(/inválido/);
    expect(() => aplicarCambio(datos, { tipo: 'via', viaId: 't0', propiedades: { velocidadMax: 0 } })).toThrow(/inválido/);
    expect(() => aplicarCambio(datos, { tipo: 'via', viaId: 'zzz', propiedades: { abierta: false } })).toThrow(/no existe/);
  });
});

describe('invertir el sentido', () => {
  it('intercambia los extremos e invierte la geometría', () => {
    const datos = datosRedLinea();
    const r = aplicarCambio(datos, { tipo: 'invertirVia', viaId: 't1' });
    const v = viaDe(r, 't1');
    expect([v.desde, v.hasta]).toEqual(['n2', 'n1']);
    expect(v.geometria[0]).toEqual(viaDe(datos, 't1').geometria.at(-1));
  });

  it('quita el pare de un acceso que ya no llega al cruce', () => {
    const datos = datosRedLinea();
    nodoDe(datos, 'n2').control = 'pare';
    nodoDe(datos, 'n2').accesosConPare = ['t1'];
    const r = aplicarCambio(datos, { tipo: 'invertirVia', viaId: 't1' });
    expect(nodoDe(r, 'n2').accesosConPare).toBeUndefined();
    expect(nodoDe(r, 'n2').control).toBe('pare');
    expect(validarRed(r)).toEqual([]);
  });
});

describe('cambio de un cruce', () => {
  it('pone un semáforo y quita la lista de pares', () => {
    const datos = datosRedLinea();
    nodoDe(datos, 'n1').control = 'pare';
    nodoDe(datos, 'n1').accesosConPare = ['t0'];
    const r = aplicarCambio(datos, { tipo: 'cruce', nodoId: 'n1', control: 'semaforo' });
    expect(nodoDe(r, 'n1').control).toBe('semaforo');
    expect(nodoDe(r, 'n1').accesosConPare).toBeUndefined();
  });

  it('pone pare a un acceso concreto', () => {
    const r = aplicarCambio(datosRedLinea(), { tipo: 'cruce', nodoId: 'n1', control: 'pare', accesosConPare: ['t0'] });
    expect(nodoDe(r, 'n1')).toMatchObject({ control: 'pare', accesosConPare: ['t0'] });
    expect(validarRed(r)).toEqual([]);
  });

  it('rechaza controles desconocidos y cruces inexistentes', () => {
    expect(() => aplicarCambio(datosRedLinea(), { tipo: 'cruce', nodoId: 'n1', control: 'rotonda' })).toThrow(/inválido/);
    expect(() => aplicarCambio(datosRedLinea(), { tipo: 'cruce', nodoId: 'zzz', control: 'pare' })).toThrow(/no existe/);
  });
});

describe('obras y doble calzada', () => {
  it('terminar una obra la habilita', () => {
    const datos = datosRedLinea({ extraPorTramo: (i) => (i === 1 ? { tipo: 'variante', enConstruccion: true } : {}) });
    const r = aplicarCambio(datos, { tipo: 'terminarObra', viaIds: ['t1'] });
    expect(viaDe(r, 't1').enConstruccion).toBe(false);
  });

  it('doble calzada en la Avenida: 2 carriles por sentido, y al quitarla vuelven los de antes', () => {
    const nodos = { a: [0, 0], b: [200, 0], c: [400, 0] };
    const datos = armarDatos(nodos, [
      viaEntre('av', nodos, 'a', 'b', { tipo: 'avenida_nacional', sentido: 'ambos' }),
      viaEntre('calle', nodos, 'b', 'c'),
    ]);
    const con = aplicarCambio(datos, { tipo: 'dobleCalzada', alcance: 'avenida_nacional', activa: true });
    expect(viaDe(con, 'av')).toMatchObject({ carrilesPorSentido: 2, dobleCalzada: true });
    expect(viaDe(con, 'calle').carrilesPorSentido).toBe(1);
    const sin = aplicarCambio(con, { tipo: 'dobleCalzada', alcance: 'avenida_nacional', activa: false });
    expect(viaDe(sin, 'av')).toMatchObject({ carrilesPorSentido: 1, dobleCalzada: false });
    expect(viaDe(sin, 'av').carrilesAntesDobleCalzada).toBeUndefined();
  });

  it('la doble calzada solo se permite en la Avenida y la Variante', () => {
    expect(() => aplicarCambio(datosRedLinea(), { tipo: 'dobleCalzada', alcance: 'un_sentido', activa: true })).toThrow(/Avenida/);
  });
});

describe('aplicarCambios', () => {
  it('aplica una lista en orden', () => {
    const r = aplicarCambios(datosRedLinea(), [
      { tipo: 'via', viaId: 't0', propiedades: { abierta: false } },
      { tipo: 'via', viaId: 't0', propiedades: { abierta: true, estado: 'regular' } },
    ]);
    expect(viaDe(r, 't0')).toMatchObject({ abierta: true, estado: 'regular' });
  });

  it('rechaza tipos de cambio desconocidos', () => {
    expect(() => aplicarCambio(datosRedLinea(), { tipo: 'borrarTodo' })).toThrow(/desconocido/);
  });
});
