import { describe, it, expect } from 'vitest';
import { arcosEnCasco, rodeaElCasco, permitidoRestringido } from '../../src/sim/restriccion.js';
import { prepararGeometria } from '../../src/sim/geometriaArcos.js';
import { crearMotor } from '../../src/sim/motor.js';
import { CONDUCTOR_NEUTRO } from '../../src/sim/vehiculos.js';
import { redRodeo, CASCO_PRUEBA } from './redesPrueba.js';

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
