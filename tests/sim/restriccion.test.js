import { describe, it, expect } from 'vitest';
import { arcosEnCasco, rodeaElCasco, permitidoRestringido } from '../../src/sim/restriccion.js';
import { prepararGeometria } from '../../src/sim/geometriaArcos.js';
import { crearMotor } from '../../src/sim/motor.js';
import { CONDUCTOR_NEUTRO } from '../../src/sim/vehiculos.js';
import { crearRed } from '../../src/sim/red.js';
import { redRodeo, CASCO_PRUEBA, datosRodeo, viaEntre } from './redesPrueba.js';

describe('casco urbano', () => {
  it('solo el tramo de Avenida del centro queda dentro del casco', () => {
    const red = redRodeo();
    expect([...arcosEnCasco(red, prepararGeometria(red), CASCO_PRUEBA)].sort()).toEqual(['ab<', 'ab>']);
  });

  it('la Variante rodea el casco solo si está terminada', () => {
    for (const [varianteEnObra, esperado] of [[false, true], [true, false]]) {
      const red = redRodeo({ varianteEnObra });
      const casco = arcosEnCasco(red, prepararGeometria(red), CASCO_PRUEBA);
      expect(rodeaElCasco(red, casco, 'W', 'E')).toBe(esperado);
    }
  });

  it('un restringido no puede usar calles comunes aunque estén fuera del casco', () => {
    const red = redRodeo();
    red.vias.get('Wa').tipo = 'doble_sentido';
    expect(permitidoRestringido(red, new Set(), 'Wa>')).toBe(false);
    expect(permitidoRestringido(red, new Set(), 'Wv1>')).toBe(true);
  });
});

describe('motor con restricción de pesados', () => {
  const camion = { tipo: 'camion', origen: 'W', destino: 'E', flujo: 'pesado', conductor: CONDUCTOR_NEUTRO };
  const motor = (opciones = {}, red = redRodeo()) => crearMotor(red, { conDemanda: false, casco: CASCO_PRUEBA, ...opciones });

  it('sin restricción el camión de paso cruza por el centro', () => {
    expect(motor().agregarVehiculo(camion).ruta).toContain('ab>');
  });

  it('con restricción el camión de paso usa la Variante', () => {
    const ruta = motor({ restriccionPesados: true }).agregarVehiculo(camion).ruta;
    expect(ruta).toContain('v1v2>');
    expect(ruta).not.toContain('ab>');
  });

  it('un carro de paso no se restringe', () => {
    const ruta = motor({ restriccionPesados: true }).agregarVehiculo({ ...camion, tipo: 'carro', flujo: 'paso' }).ruta;
    expect(ruta).toContain('ab>');
  });

  it('si la Variante no conecta, el camión pasa por el centro y no es un viaje imposible', () => {
    const m = motor({ restriccionPesados: true }, redRodeo({ varianteEnObra: true }));
    expect(m.agregarVehiculo(camion).ruta).toContain('ab>');
    expect(m.resumen().viajesImposibles).toBe(0);
  });

  it('activar la restricción en marcha cambia la ruta de los camiones nuevos', () => {
    const m = motor();
    expect(m.restriccion).toBe(false);
    m.configurarRestriccion(true);
    expect(m.restriccion).toBe(true);
    expect(m.agregarVehiculo(camion).ruta).toContain('v1v2>');
  });
});

describe('camiones y buses nacionales siempre por la Avenida', () => {
  // Rodeo con un atajo de calle común (a → E) más rápido que la Avenida.
  const redConAtajo = () => {
    const datos = datosRodeo();
    const nodos = { a: [-500, 0], E: [1500, 0] };
    datos.vias.push(viaEntre('aE', nodos, 'a', 'E', { tipo: 'doble_sentido', sentido: 'ambos', velocidadMax: 80 }));
    return crearRed(datos);
  };
  const motor = (red = redConAtajo()) => crearMotor(red, { conDemanda: false, casco: CASCO_PRUEBA, terminal: null });
  const viaje = (tipo, flujo) => ({ tipo, origen: 'W', destino: 'E', flujo, conductor: CONDUCTOR_NEUTRO });

  it('el carro toma el atajo; el camión y el bus nacional siguen por la Avenida', () => {
    expect(motor().agregarVehiculo(viaje('carro', 'paso')).ruta).toContain('aE>');
    for (const [tipo, flujo] of [['camion', 'pesado'], ['bus_nacional', 'busNacional'], ['bus_nacional', 'busPaso']]) {
      const ruta = motor().agregarVehiculo(viaje(tipo, flujo)).ruta;
      expect(ruta).toContain('ab>');
      expect(ruta).not.toContain('aE>');
    }
  });

  it('las calles junto a la Terminal son solo para los buses que entran o salen de ella', () => {
    const red = redConAtajo();
    const geo = prepararGeometria(red);
    const [lon, lat] = geo.get('aE>').coords[0];
    const terminal = { lon, lat, radio: 3000 }; // cubre el atajo
    const m = crearMotor(red, { conDemanda: false, casco: CASCO_PRUEBA, terminal });
    expect(m.agregarVehiculo(viaje('camion', 'pesado')).ruta).not.toContain('aE>');
    expect(m.agregarVehiculo(viaje('bus_nacional', 'busPaso')).ruta).not.toContain('aE>');
    expect(m.agregarVehiculo(viaje('bus_nacional', 'busNacional')).ruta).toContain('aE>');
  });

  it('si la Avenida se cierra, el camión se desvía por donde pueda', () => {
    const red = redConAtajo();
    red.vias.get('ab').abierta = false;
    red.vias.get('v1v2').abierta = false;
    const m = motor(red);
    expect(m.agregarVehiculo(viaje('camion', 'pesado')).ruta).toContain('aE>');
    expect(m.resumen().viajesImposibles).toBe(0);
  });
});
