import { describe, it, expect } from 'vitest';
import { crearMotor } from '../../src/sim/motor.js';
import { crearRed } from '../../src/sim/red.js';
import { CONDUCTOR_NEUTRO } from '../../src/sim/vehiculos.js';
import { datosDosRutas, datosRedLinea, armarDatos, viaEntre } from './redesPrueba.js';

const carro = (origen, destino) => ({ tipo: 'carro', origen, destino, conductor: CONDUCTOR_NEUTRO });
const cambiarVia = (datos, viaId, cambios) => ({
  ...datos, vias: datos.vias.map((v) => (v.id === viaId ? { ...v, ...cambios } : v)),
});
const sinDemanda = (red) => crearMotor(red, { conDemanda: false });

describe('motor · red en caliente', () => {
  it('cerrar la vía de adelante: el vehículo toma la alterna y llega', () => {
    const datos = datosDosRutas();
    const motor = sinDemanda(crearRed(datos));
    const veh = motor.agregarVehiculo(carro('a', 'd'));
    motor.avanzar(2);
    motor.aplicarRed(crearRed(cambiarVia(datos, 'bd', { abierta: false })));
    motor.avanzar(150);
    expect(veh.ruta).toContain('bm>');
    expect(motor.resumen().viajesCompletados).toBe(1);
  });

  it('cambiar el estado de otra vía no mueve a nadie de su sitio', () => {
    const datos = datosRedLinea();
    const motor = sinDemanda(crearRed(datos));
    const veh = motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(5);
    const antes = { i: veh.i, s: veh.s, v: veh.v };
    motor.aplicarRed(crearRed(cambiarVia(datos, 't2', { estado: 'huecos' })));
    expect(motor.vehiculos()).toContain(veh);
    expect({ i: veh.i, s: veh.s, v: veh.v }).toEqual(antes);
    motor.avanzar(200);
    expect(motor.resumen().viajesCompletados).toBe(1);
  });

  it('invertir la vía en que va un vehículo lo retira y lo cuenta', () => {
    const datos = datosRedLinea();
    const motor = sinDemanda(crearRed(datos));
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(5);
    const t0 = datos.vias.find((v) => v.id === 't0');
    motor.aplicarRed(crearRed(cambiarVia(datos, 't0', { desde: t0.hasta, hasta: t0.desde, geometria: [...t0.geometria].reverse() })));
    const r = motor.resumen();
    expect(r.enRed).toBe(0);
    expect(r.retirados).toBe(1);
  });

  it('si el resto de la ruta deja de existir y no hay otra, el vehículo se retira', () => {
    const datos = datosRedLinea();
    const motor = sinDemanda(crearRed(datos));
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(5);
    const t2 = datos.vias.find((v) => v.id === 't2');
    motor.aplicarRed(crearRed(cambiarVia(datos, 't2', { desde: t2.hasta, hasta: t2.desde, geometria: [...t2.geometria].reverse() })));
    expect(motor.resumen()).toMatchObject({ enRed: 0, retirados: 1 });
    expect(() => motor.avanzar(30)).not.toThrow();
  });

  it('una vía nueva la usan los viajes nuevos', () => {
    const datos = datosDosRutas();
    const motor = sinDemanda(crearRed(datos));
    const nodos = { a: [0, 0], d: [400, 0] };
    const atajo = viaEntre('atajo', nodos, 'a', 'd', { velocidadMax: 60 });
    motor.aplicarRed(crearRed({ ...datos, vias: [...datos.vias, atajo] }));
    expect(motor.agregarVehiculo(carro('a', 'd')).ruta).toEqual(['atajo>']);
  });

  it('pasar de dos carriles a uno no deja vehículos encimados', () => {
    const datos = datosRedLinea({ tramos: 2, largo: 300, extra: { carrilesPorSentido: 2, velocidadMax: 50 } });
    const motor = sinDemanda(crearRed(datos));
    for (let k = 0; k < 12; k++) {
      motor.agregarVehiculo(carro('n0', 'n2'));
      motor.paso();
    }
    motor.avanzar(5);
    motor.aplicarRed(crearRed({ ...datos, vias: datos.vias.map((v) => ({ ...v, carrilesPorSentido: 1 })) }));
    const enT0 = motor.vehiculos().filter((v) => v.ruta[v.i] === 't0>').sort((x, y) => y.s - x.s);
    for (let k = 1; k < enT0.length; k++) {
      expect(enT0[k - 1].s - enT0[k - 1].perfil.largo - enT0[k].s).toBeGreaterThanOrEqual(0);
    }
    expect(() => motor.avanzar(200)).not.toThrow();
  });

  it('un vehículo esperando para entrar recalcula su ruta si la suya dejó de existir', () => {
    const nodos = { a: [0, 0], b: [200, 0], d: [400, 0] };
    const datos = armarDatos(nodos, [viaEntre('ab', nodos, 'a', 'b'), viaEntre('bd', nodos, 'b', 'd'), viaEntre('ad', nodos, 'a', 'd', { velocidadMax: 10 })]);
    const motor = sinDemanda(crearRed(datos));
    const veh = motor.agregarVehiculo(carro('a', 'd'));
    expect(veh.ruta).toEqual(['ab>', 'bd>']);
    const bd = datos.vias.find((v) => v.id === 'bd');
    motor.aplicarRed(crearRed(cambiarVia(datos, 'bd', { desde: 'd', hasta: 'b', geometria: [...bd.geometria].reverse() })));
    expect(veh.ruta).toEqual(['ad>']);
  });
});

describe('motor · demora reciente', () => {
  it('el resumen trae la demora de los últimos 10 minutos', () => {
    const motor = sinDemanda(crearRed(datosRedLinea()));
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(200);
    const r = motor.resumen();
    expect(r.viajesCompletados).toBe(1);
    expect(r.demoraReciente).toBeCloseTo(r.demoraMedia, 6);
  });
});
