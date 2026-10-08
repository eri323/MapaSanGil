import { describe, it, expect } from 'vitest';
import { crearMotor } from '../../src/sim/motor.js';
import { CONDUCTOR_NEUTRO } from '../../src/sim/vehiculos.js';
import { redCruce, redDosRutas, redLinea } from './redesPrueba.js';

const viaje = (tipo, origen, destino) => ({ tipo, origen, destino, conductor: CONDUCTOR_NEUTRO });

function conRegistro(red, extra = {}) {
  const cruces = [];
  const terminados = [];
  const motor = crearMotor(red, {
    conDemanda: false,
    alCruzar: (veh, nodo, t) => cruces.push({ id: veh.id, nodo, t, arco: veh.ruta[veh.i - 1] }),
    alTerminar: (veh, t) => terminados.push({ id: veh.id, t }),
    ...extra,
  });
  return { motor, cruces, terminados };
}

// Velocidad mínima de un vehículo en los últimos `metros` de un arco.
function velocidadMinimaAntesDe(motor, veh, arcoId, metros, segundos) {
  let minima = Infinity;
  for (let k = 0; k < segundos / motor.dt; k++) {
    motor.paso();
    const largo = 200;
    if (veh.ruta[veh.i] === arcoId && veh.s > largo - metros) minima = Math.min(minima, veh.v);
  }
  return minima;
}

describe('motor · cruces', () => {
  it('en un pare el carro se detiene por completo antes de cruzar', () => {
    const { motor, terminados } = conRegistro(redCruce({ control: 'pare', accesosConPare: ['nc'] }));
    const carro = motor.agregarVehiculo(viaje('carro', 'n', 's'));
    expect(velocidadMinimaAntesDe(motor, carro, 'nc>', 10, 120)).toBeLessThan(0.3);
    expect(terminados).toHaveLength(1);
  });

  it('en la vía con prioridad no frena en el cruce', () => {
    const { motor, terminados } = conRegistro(redCruce({ control: 'pare', accesosConPare: ['nc'] }));
    const carro = motor.agregarVehiculo(viaje('carro', 'o', 'e'));
    expect(velocidadMinimaAntesDe(motor, carro, 'oc>', 30, 80)).toBeGreaterThan(4);
    expect(terminados).toHaveLength(1);
  });

  it('el que cede espera a que pase todo el tren de carros de la avenida', () => {
    const { motor, cruces, terminados } = conRegistro(redCruce({ control: 'prioridad' }));
    const calle = motor.agregarVehiculo(viaje('carro', 'n', 's'));
    motor.avanzar(10);
    // seis carros cada 3 s: mientras pasan nunca queda un hueco libre de 3 s
    for (let k = 0; k < 6; k++) {
      motor.agregarVehiculo(viaje('carro', 'o', 'e'));
      motor.avanzar(3);
    }
    motor.avanzar(200);
    expect(terminados.some((x) => x.id === calle.id)).toBe(true);
    const enC = cruces.filter((x) => x.nodo === 'c');
    const tCalle = enC.find((x) => x.id === calle.id).t;
    const tAvenida = enC.filter((x) => x.id !== calle.id).map((x) => x.t);
    expect(tAvenida).toHaveLength(6);
    // la calle llega (~27 s) cuando el tren ya está pasando, así que tuvo que esperarlo entero
    expect(Math.min(...tAvenida)).toBeLessThan(30);
    expect(tCalle).toBeGreaterThan(Math.max(...tAvenida));
  });

  it('sin señal entre vías iguales cede al de la derecha aunque haya llegado primero', () => {
    const iguales = { tipo: 'doble_sentido', sentido: 'ambos' };
    const { motor, cruces } = conRegistro(redCruce({ control: 'sin_senal', avenida: iguales, calle: iguales }));
    const haciaElSur = motor.agregarVehiculo(viaje('carro', 'n', 's'));
    motor.avanzar(1);
    const haciaElEste = motor.agregarVehiculo(viaje('carro', 'o', 'e'));
    motor.avanzar(120);
    const t = (veh) => cruces.find((x) => x.id === veh.id && x.nodo === 'c').t;
    // quien va al sur tiene a su derecha a quien viene del oeste: lo deja pasar
    expect(t(haciaElEste)).toBeLessThan(t(haciaElSur));
  });

  it('cuatro vehículos llegando a la vez a un cruce sin señal no se traban', () => {
    const iguales = { tipo: 'doble_sentido', sentido: 'ambos' };
    const { motor, cruces, terminados } = conRegistro(redCruce({ control: 'sin_senal', avenida: iguales, calle: iguales }));
    for (const [o, d] of [['o', 'e'], ['e', 'o'], ['n', 's'], ['s', 'n']]) motor.agregarVehiculo(viaje('carro', o, d));
    motor.avanzar(150);
    expect(terminados).toHaveLength(4);
    expect(motor.resumen().bloqueos).toBe(0);
    const tiempos = cruces.filter((x) => x.nodo === 'c').map((x) => x.t).sort((a, b) => a - b);
    for (let k = 1; k < tiempos.length; k++) expect(tiempos[k] - tiempos[k - 1]).toBeGreaterThanOrEqual(0.5);
  });
});

describe('motor · rutas en marcha', () => {
  it('si se cierra la vía de adelante, el vehículo busca la alterna', () => {
    const red = redDosRutas();
    const { motor, terminados } = conRegistro(red);
    const carro = motor.agregarVehiculo(viaje('carro', 'a', 'd'));
    expect(carro.ruta).toEqual(['ab>', 'bd>']);
    motor.avanzar(2);
    red.vias.get('bd').abierta = false;
    motor.avanzar(150);
    expect(carro.ruta).toContain('bm>');
    expect(terminados).toHaveLength(1);
  });

  it('si no queda ninguna salida, el vehículo se libera como bloqueo', () => {
    const red = redDosRutas();
    const { motor } = conRegistro(red, { umbralBloqueo: 10 });
    motor.agregarVehiculo(viaje('carro', 'a', 'd'));
    motor.avanzar(2);
    red.vias.get('bd').abierta = false;
    red.vias.get('bm').abierta = false;
    motor.avanzar(120);
    const r = motor.resumen();
    expect(r.bloqueos).toBe(1);
    expect(r.enRed).toBe(0);
  });
});

describe('motor · carriles', () => {
  it('un carro rápido cambia de carril para pasar a un camión lento', () => {
    const red = redLinea({ tramos: 3, largo: 300, extra: { carrilesPorSentido: 2, velocidadMax: 60 } });
    const { motor, terminados } = conRegistro(red);
    const camion = motor.agregarVehiculo(viaje('camion', 'n0', 'n3'));
    motor.avanzar(10);
    const carro = motor.agregarVehiculo(viaje('carro', 'n0', 'n3'));
    let cambio = false;
    for (let k = 0; k < 400; k++) {
      motor.paso();
      if (carro.carril === 1) cambio = true;
    }
    expect(cambio).toBe(true);
    const fin = (veh) => terminados.find((x) => x.id === veh.id).t;
    expect(fin(carro)).toBeLessThan(fin(camion));
  });
});
