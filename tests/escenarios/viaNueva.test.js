import { describe, it, expect } from 'vitest';
import { aplicarCambio } from '../../src/escenarios/cambios.js';
import { validarRed, crearRed, alcanzables } from '../../src/sim/red.js';
import { datosRedLinea, punto } from '../sim/redesPrueba.js';

// Línea de doble sentido n0–n1–n2–n3, tramos de 200 m al este.
const linea = () => datosRedLinea({ extra: { sentido: 'ambos', tipo: 'doble_sentido' } });
const coordNodo = (datos, id) => { const n = datos.nodos.find((x) => x.id === id); return [n.lon, n.lat]; };

const nueva = (extremos, puntos, atributos = {}) => ({ tipo: 'viaNueva', id: 'nueva-1', extremos, puntos, atributos });

describe('vía nueva', () => {
  it('une dos cruces existentes', () => {
    const datos = linea();
    const p0 = coordNodo(datos, 'n0');
    const p3 = coordNodo(datos, 'n3');
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'nodo', nodo: 'n0', punto: p0 }, { tipo: 'nodo', nodo: 'n3', punto: p3 }],
      [p0, punto(300, 150), p3],
      { nombre: 'Atajo', sentido: 'adelante' },
    ));
    const v = r.vias.find((x) => x.id === 'nueva-1');
    expect(v).toMatchObject({ desde: 'n0', hasta: 'n3', nombre: 'Atajo', sentido: 'adelante', tipo: 'un_sentido', osmId: null, nueva: true });
    expect(v.geometria).toHaveLength(3);
    expect(v.longitud).toBeGreaterThan(600);
    expect(validarRed(r)).toEqual([]);
  });

  it('desde un punto suelto crea un cruce nuevo', () => {
    const datos = linea();
    const suelto = punto(300, 300);
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'libre', punto: suelto }, { tipo: 'nodo', nodo: 'n2', punto: coordNodo(datos, 'n2') }],
      [suelto, coordNodo(datos, 'n2')],
    ));
    expect(r.nodos.find((n) => n.id === 'n-nueva-1-0')).toMatchObject({ lon: suelto[0], lat: suelto[1], control: 'sin_senal' });
    expect(validarRed(r)).toEqual([]);
  });

  it('a mitad de una vía la parte en dos y conecta en el punto de corte', () => {
    const datos = linea();
    const enT1 = punto(300, 0);
    const lejos = punto(300, -200);
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'via', via: 't1', punto: enT1 }, { tipo: 'libre', punto: lejos }],
      [enT1, lejos],
      { esPuente: true, nombre: 'Puente nuevo' },
    ));
    expect(r.vias.some((v) => v.id === 't1')).toBe(false);
    const a = r.vias.find((v) => v.id === 't1~n-nueva-1-0a');
    const b = r.vias.find((v) => v.id === 't1~n-nueva-1-0b');
    expect([a.desde, a.hasta, b.desde, b.hasta]).toEqual(['n1', 'n-nueva-1-0', 'n-nueva-1-0', 'n2']);
    expect(a.longitud + b.longitud).toBeCloseTo(datos.vias.find((v) => v.id === 't1').longitud, 0);
    expect(r.vias.find((v) => v.id === 'nueva-1')).toMatchObject({ desde: 'n-nueva-1-0', esPuente: true });
    expect(validarRed(r)).toEqual([]);
    expect(alcanzables(crearRed(r), 'n0').has('n-nueva-1-1')).toBe(true);
  });

  it('partir una vía casi en su extremo usa el cruce existente', () => {
    const datos = linea();
    const casiN1 = punto(200.5, 0);
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'via', via: 't1', punto: casiN1 }, { tipo: 'libre', punto: punto(200, -200) }],
      [casiN1, punto(200, -200)],
    ));
    expect(r.vias.some((v) => v.id === 't1')).toBe(true);
    expect(r.vias.find((v) => v.id === 'nueva-1').desde).toBe('n1');
  });

  it('al partir una vía, el pare de su acceso pasa a la mitad que llega al cruce', () => {
    const datos = linea();
    const n2 = datos.nodos.find((n) => n.id === 'n2');
    n2.control = 'pare';
    n2.accesosConPare = ['t1'];
    const enT1 = punto(300, 0);
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'via', via: 't1', punto: enT1 }, { tipo: 'libre', punto: punto(300, -200) }],
      [enT1, punto(300, -200)],
    ));
    expect(r.nodos.find((n) => n.id === 'n2').accesosConPare).toEqual(['t1~n-nueva-1-0b']);
    expect(validarRed(r)).toEqual([]);
  });

  it('errores claros: mismo cruce en los dos extremos, un solo punto, id repetido', () => {
    const datos = linea();
    const p1 = coordNodo(datos, 'n1');
    expect(() => aplicarCambio(datos, nueva([{ tipo: 'nodo', nodo: 'n1', punto: p1 }, { tipo: 'nodo', nodo: 'n1', punto: p1 }], [p1, punto(250, 50), p1])))
      .toThrow(/mismo cruce/);
    expect(() => aplicarCambio(datos, nueva([{ tipo: 'nodo', nodo: 'n1', punto: p1 }], [p1]))).toThrow(/dos puntos/);
    expect(() => aplicarCambio(datos, { ...nueva([{ tipo: 'nodo', nodo: 'n0', punto: p1 }, { tipo: 'nodo', nodo: 'n2', punto: p1 }], [p1, p1]), id: 't0' }))
      .toThrow(/Ya existe/);
  });
});

describe('vía nueva con los dos extremos sobre la misma vía', () => {
  it('parte la vía dos veces y queda una red válida', () => {
    const datos = linea();
    const p1 = punto(250, 0);
    const p2 = punto(350, 0);
    const r = aplicarCambio(datos, nueva(
      [{ tipo: 'via', via: 't1', punto: p1 }, { tipo: 'via', via: 't1', punto: p2 }],
      [p1, punto(300, 100), p2],
    ));
    expect(validarRed(r)).toEqual([]);
    const v = r.vias.find((x) => x.id === 'nueva-1');
    expect(v.desde).toBe('n-nueva-1-0');
    expect(v.hasta).toBe('n-nueva-1-1');
    expect(r.vias.filter((x) => x.id.startsWith('t1~'))).toHaveLength(3);
  });
});
