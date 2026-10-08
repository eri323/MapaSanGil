import { describe, it, expect } from 'vitest';
import {
  crearDibujo, agregarPunto, quitarUltimo, cambiarAtributos, lineaDelDibujo, cruzaRio, cambioDeDibujo, siguienteIdVia,
} from '../../src/ui/edicion/dibujo.js';
import { redLinea, datosRedLinea, punto } from '../sim/redesPrueba.js';

const red = redLinea();

describe('dibujo de una vía nueva', () => {
  const dibujado = () => [punto(200, 5), punto(300, 150), punto(300, 300)]
    .reduce((d, p) => agregarPunto(d, red, p), crearDibujo('calle'));

  it('pega el primer y el último punto; los del medio quedan donde se marcaron', () => {
    const d = dibujado();
    expect(d.puntos[0].ajuste).toMatchObject({ tipo: 'nodo', nodo: 'n1' });
    expect(d.puntos[2].ajuste.tipo).toBe('libre');
    const linea = lineaDelDibujo(d);
    expect(linea[0]).toEqual(d.puntos[0].ajuste.punto);
    expect(linea[1]).toEqual(punto(300, 150));
  });

  it('quitar el último punto y cambiar atributos', () => {
    const d = cambiarAtributos(quitarUltimo(dibujado()), { velocidadMax: 50 });
    expect(d.puntos).toHaveLength(2);
    expect(d.atributos.velocidadMax).toBe(50);
  });

  it('si cruza el río es un puente', () => {
    const rio = [punto(250, 100), punto(350, 100)];
    expect(cruzaRio(dibujado(), [rio])).toBe(true);
    expect(cruzaRio(dibujado(), [])).toBe(false);
    const cambio = cambioDeDibujo(dibujado(), 'nueva-1', [rio]);
    expect(cambio).toMatchObject({ tipo: 'viaNueva', id: 'nueva-1', atributos: { esPuente: true, nombre: 'Puente nuevo' } });
    expect(cambio.extremos.map((x) => x.tipo)).toEqual(['nodo', 'libre']);
  });

  it('un tramo de Variante nace en construcción y conserva su nombre aunque cruce el río', () => {
    const d = [punto(200, 5), punto(300, 300)].reduce((x, p) => agregarPunto(x, red, p), crearDibujo('variante'));
    const cambio = cambioDeDibujo(d, 'nueva-2', [[punto(150, 100), punto(350, 100)]]);
    expect(cambio.atributos).toMatchObject({ tipo: 'variante', enConstruccion: true, esPuente: true });
    expect(cambio.atributos.nombre).toMatch(/Variante/);
  });

  it('con menos de dos puntos no se puede terminar', () => {
    expect(() => cambioDeDibujo(agregarPunto(crearDibujo('calle'), red, punto(0, 0)), 'x', [])).toThrow(/dos puntos/);
  });

  it('siguienteIdVia no repite ids, ni los de mitades partidas', () => {
    const datos = datosRedLinea();
    expect(siguienteIdVia(datos)).toBe('nueva-1');
    datos.vias.push({ id: 'nueva-1' }, { id: 'nueva-2~n-xa' });
    expect(siguienteIdVia(datos)).toBe('nueva-3');
  });
});
