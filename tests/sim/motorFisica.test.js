import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearRed } from '../../src/sim/red.js';
import { crearMotor } from '../../src/sim/motor.js';
import { CONDUCTOR_NEUTRO } from '../../src/sim/vehiculos.js';
import { redCruce, redLinea, armarRed, viaEntre } from './redesPrueba.js';

const viaje = (tipo, origen, destino) => ({ tipo, origen, destino, conductor: CONDUCTOR_NEUTRO });

// Ningún par de vehículos del mismo arco y carril se traslapa.
function traslapes(motor) {
  const grupos = new Map();
  for (const v of motor.vehiculos()) {
    const clave = `${v.ruta[v.i]}|${v.carril}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(v);
  }
  let peor = 0;
  for (const lista of grupos.values()) {
    lista.sort((a, b) => b.s - a.s);
    for (let k = 1; k < lista.length; k++) {
      peor = Math.min(peor, lista[k - 1].s - lista[k - 1].perfil.largo - lista[k].s);
    }
  }
  return peor;
}

// Mayor caída de velocidad de un vehículo en un solo paso (m/s).
function vigilarFrenazos(motor, segundos, alPaso = () => {}, registro = { imposibles: 0 }) {
  const antes = new Map();
  let peor = 0;
  for (let k = 0; k < segundos / motor.dt; k++) {
    motor.paso();
    alPaso();
    for (const v of motor.vehiculos()) {
      if (antes.has(v.id)) {
        const caida = antes.get(v.id) - v.v;
        peor = Math.max(peor, caida);
        if (caida > 9 * motor.dt + 1e-9) registro.imposibles += 1;
      }
      antes.set(v.id, v.v);
    }
  }
  return peor;
}

describe('motor · física', () => {
  it('dos giros desde la avenida hacia la misma calle no quedan encimados', () => {
    const red = redCruce({ control: 'prioridad', calle: { tipo: 'doble_sentido', sentido: 'ambos' } });
    const motor = crearMotor(red, { conDemanda: false });
    let peor = 0;
    for (let k = 0; k < 8; k++) {
      motor.agregarVehiculo(viaje('carro', 'o', 's'));
      motor.agregarVehiculo(viaje('carro', 'e', 's'));
      for (let p = 0; p < 4; p++) { motor.paso(); peor = Math.min(peor, traslapes(motor)); }
    }
    for (let p = 0; p < 400; p++) { motor.paso(); peor = Math.min(peor, traslapes(motor)); }
    expect(peor).toBeGreaterThanOrEqual(-0.05);
    expect(motor.resumen().viajesCompletados).toBe(16);
  });

  it('dos carriles que se vuelven uno no encima vehículos', () => {
    const red = redLinea({ tramos: 2, largo: 300, extraPorTramo: (i) => ({ carrilesPorSentido: i === 0 ? 2 : 1, velocidadMax: 50 }) });
    const motor = crearMotor(red, { conDemanda: false });
    let peor = 0;
    for (let k = 0; k < 30; k++) {
      motor.agregarVehiculo(viaje(k % 3 ? 'carro' : 'moto', 'n0', 'n2'));
      motor.paso();
      peor = Math.min(peor, traslapes(motor));
    }
    for (let p = 0; p < 800; p++) { motor.paso(); peor = Math.min(peor, traslapes(motor)); }
    expect(peor).toBeGreaterThanOrEqual(-0.05);
    expect(motor.resumen().viajesCompletados).toBe(30);
  });

  it('antes de un tramo muy corto que termina en un cruce donde cede, frena a tiempo y no en seco', () => {
    const nodos = { a: [0, 0], b: [300, 0], c: [306, 0], d: [500, 0], x: [306, 200] };
    const red = armarRed(nodos, [
      viaEntre('ab', nodos, 'a', 'b', { velocidadMax: 50 }),
      viaEntre('bc', nodos, 'b', 'c', { velocidadMax: 50 }),
      viaEntre('cd', nodos, 'c', 'd', { velocidadMax: 50 }),
      viaEntre('xc', nodos, 'x', 'c', { tipo: 'avenida_nacional', velocidadMax: 50 }),
    ], { c: { control: 'prioridad' } });
    const motor = crearMotor(red, { conDemanda: false });
    motor.agregarVehiculo(viaje('carro', 'a', 'd'));
    let peor = 0;
    // un tren de carros por la avenida obliga a detenerse en c
    for (let k = 0; k < 10; k++) {
      motor.agregarVehiculo(viaje('carro', 'x', 'd'));
      peor = Math.max(peor, vigilarFrenazos(motor, 3));
    }
    peor = Math.max(peor, vigilarFrenazos(motor, 150));
    expect(motor.resumen().viajesCompletados).toBe(11);
    expect(peor).toBeLessThanOrEqual(9 * motor.dt + 1e-9);
  });

  it('en San Gil, con el doble de tráfico, nadie se encima y casi nadie frena más de lo físicamente posible', () => {
    const datos = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'red-sangil.json'), 'utf8'));
    const motor = crearMotor(crearRed(datos), { semilla: 2, demanda: { horaInicio: 7, factor: 2 } });
    let peorTraslape = 0;
    const registro = { imposibles: 0 };
    vigilarFrenazos(motor, 900, () => { peorTraslape = Math.min(peorTraslape, traslapes(motor)); }, registro);
    expect(peorTraslape).toBeGreaterThanOrEqual(-0.05);
    // Quedan casos límite (la vía de salida se llena dos tramos más adelante):
    // se aceptan unos pocos en 15 minutos con el doble de tráfico.
    expect(registro.imposibles).toBeLessThanOrEqual(5);
  }, 300000);
});
