import { describe, it, expect } from 'vitest';
import { crearMotor } from '../../src/sim/motor.js';
import { CONDUCTOR_NEUTRO } from '../../src/sim/vehiculos.js';
import { redLinea, armarRed, viaEntre } from './redesPrueba.js';

const sinDemanda = (red, extra = {}) => crearMotor(red, { conDemanda: false, ...extra });
const carro = (origen, destino) => ({ tipo: 'carro', origen, destino, conductor: CONDUCTOR_NEUTRO });

describe('motor · recorrido básico', () => {
  it('un carro solo recorre la línea y termina cerca del tiempo libre', () => {
    const motor = sinDemanda(redLinea());
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(200);
    const r = motor.resumen();
    expect(r.viajesCompletados).toBe(1);
    const libre = 600 / (30 / 3.6);
    expect(r.tiempoMedio).toBeGreaterThan(libre);
    expect(r.tiempoMedio).toBeLessThan(libre * 1.3);
    expect(r.enRed).toBe(0);
  });

  it('dos carros en el mismo carril nunca se traslapan', () => {
    const motor = sinDemanda(redLinea());
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.agregarVehiculo(carro('n0', 'n3'));
    for (let k = 0; k < 400; k++) {
      motor.paso();
      const vs = motor.vehiculos();
      for (const a of vs) {
        for (const b of vs) {
          if (a === b || a.ruta[a.i] !== b.ruta[b.i] || a.s < b.s) continue;
          expect(a.s - a.perfil.largo - b.s).toBeGreaterThanOrEqual(0);
        }
      }
    }
    expect(motor.resumen().viajesCompletados).toBe(2);
  });

  it('una vía con huecos se recorre más despacio', () => {
    const tiempo = (estado) => {
      const motor = sinDemanda(redLinea({ extra: { estado } }));
      motor.agregarVehiculo(carro('n0', 'n3'));
      motor.avanzar(400);
      return motor.resumen().tiempoMedio;
    };
    expect(tiempo('huecos')).toBeGreaterThan(tiempo('bueno') * 1.5);
  });

  it('un viaje contra el sentido de las vías cuenta como imposible', () => {
    const motor = sinDemanda(redLinea());
    expect(motor.agregarVehiculo(carro('n3', 'n0'))).toBeNull();
    expect(motor.resumen().viajesImposibles).toBe(1);
  });

  it('si el primer tramo está lleno, los vehículos esperan para entrar y luego terminan todos', () => {
    const motor = sinDemanda(redLinea());
    for (let k = 0; k < 40; k++) motor.agregarVehiculo(carro('n0', 'n3'));
    motor.paso();
    expect(motor.vehiculos().length).toBe(1);
    expect(motor.resumen().pendientes).toBe(39);
    motor.avanzar(600);
    expect(motor.resumen().viajesCompletados).toBe(40);
  });

  it('las posiciones traen lon, lat y tipo de cada vehículo en la red', () => {
    const motor = sinDemanda(redLinea());
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.agregarVehiculo({ tipo: 'moto', origen: 'n0', destino: 'n3' });
    motor.avanzar(20);
    const { cantidad, datos } = motor.posiciones();
    expect(cantidad).toBe(motor.vehiculos().length);
    expect(datos.length).toBe(cantidad * 3);
    for (let k = 0; k < cantidad; k++) {
      expect(Number.isFinite(datos[k * 3])).toBe(true);
      expect(Number.isFinite(datos[k * 3 + 1])).toBe(true);
      expect([0, 1]).toContain(datos[k * 3 + 2]); // moto o carro
    }
  });

  it('un tramo de 3 m no hace saltar dos cruces en un paso ni da posiciones inválidas', () => {
    const nodos = { a: [0, 0], b: [200, 0], c: [203, 0], d: [400, 0] };
    const red = armarRed(nodos, [
      viaEntre('ab', nodos, 'a', 'b', { velocidadMax: 50 }),
      viaEntre('bc', nodos, 'b', 'c', { velocidadMax: 50 }),
      viaEntre('cd', nodos, 'c', 'd', { velocidadMax: 50 }),
    ]);
    const cruces = [];
    const motor = sinDemanda(red, { alCruzar: (veh, nodo, t) => cruces.push({ nodo, t }) });
    motor.agregarVehiculo(carro('a', 'd'));
    for (let k = 0; k < 200; k++) {
      motor.paso();
      const { datos } = motor.posiciones();
      expect([...datos].every(Number.isFinite)).toBe(true);
    }
    expect(motor.resumen().viajesCompletados).toBe(1);
    expect(cruces.map((c) => c.nodo)).toEqual(['b', 'c']);
    expect(cruces[1].t).toBeGreaterThan(cruces[0].t);
  });

  it('el estado de las vías informa qué tan rápido va el tráfico', () => {
    const motor = sinDemanda(redLinea());
    motor.agregarVehiculo(carro('n0', 'n3'));
    motor.avanzar(30);
    const [via] = motor.estadoVias();
    expect(via.vehiculos).toBe(1);
    expect(via.ratio).toBeGreaterThan(0.5);
    expect(via.ratio).toBeLessThanOrEqual(1);
  });
});
