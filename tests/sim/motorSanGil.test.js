import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearRed } from '../../src/sim/red.js';
import { crearMotor } from '../../src/sim/motor.js';

const datos = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'red-sangil.json'), 'utf8'));
const ROJAS_PINILLA = 24670013;

const redSanGil = (cerrarOsm = []) => {
  const copia = structuredClone(datos);
  for (const v of copia.vias) if (cerrarOsm.includes(v.osmId)) v.abierta = false;
  return crearRed(copia);
};

describe('motor en San Gil', () => {
  it('todas las zonas y salidas existen en la red', () => {
    const motor = crearMotor(redSanGil(), { conDemanda: false });
    expect(motor.resumen().avisos).toEqual([]);
  });

  it('15 minutos de hora pico: hay tráfico, viajes completos y ninguna posición inválida', () => {
    const inicio = Date.now();
    const motor = crearMotor(redSanGil(), { semilla: 1, demanda: { horaInicio: 7 } });
    motor.avanzar(900);
    const r = motor.resumen();
    console.log(`15 min simulados en ${((Date.now() - inicio) / 1000).toFixed(1)} s:`, JSON.stringify({
      enRed: r.enRed, completados: r.viajesCompletados, imposibles: r.viajesImposibles,
      bloqueos: r.bloqueos, tiempoMedio: Math.round(r.tiempoMedio), demoraMedia: Math.round(r.demoraMedia),
    }));
    expect(r.viajesCompletados).toBeGreaterThan(50);
    expect(r.enRed).toBeGreaterThan(20);
    expect(r.bloqueos).toBeLessThan(r.viajesCompletados * 0.2);
    const { bbox } = datos;
    const { cantidad, datos: pos } = motor.posiciones();
    for (let k = 0; k < cantidad; k++) {
      expect(pos[k * 3]).toBeGreaterThan(bbox.oeste - 0.05);
      expect(pos[k * 3]).toBeLessThan(bbox.este + 0.05);
      expect(pos[k * 3 + 1]).toBeGreaterThan(bbox.sur - 0.05);
      expect(pos[k * 3 + 1]).toBeLessThan(bbox.norte + 0.05);
    }
  }, 180000);

  it('misma semilla, mismo resultado', () => {
    const correr = () => {
      const motor = crearMotor(redSanGil(), { semilla: 7, demanda: { horaInicio: 7 } });
      motor.avanzar(120);
      return { resumen: motor.resumen(), posiciones: [...motor.posiciones().datos] };
    };
    expect(correr()).toEqual(correr());
  }, 60000);

  it('cerrar el Rojas Pinilla empeora la demora y nadie pasa por él', () => {
    const correr = (cerrar) => {
      const motor = crearMotor(redSanGil(cerrar), { semilla: 3, demanda: { horaInicio: 7 } });
      motor.avanzar(1800);
      return motor;
    };
    const base = correr([]);
    const cerrado = correr([ROJAS_PINILLA]);
    const rb = base.resumen();
    const rc = cerrado.resumen();
    console.log('base:', Math.round(rb.demoraMedia), 's · cerrado:', Math.round(rc.demoraMedia), 's');
    expect(rc.demoraMedia).toBeGreaterThan(rb.demoraMedia);
    const viasRojas = datos.vias.filter((v) => v.osmId === ROJAS_PINILLA).map((v) => v.id);
    for (const id of viasRojas) expect(cerrado.usoVias().get(id) ?? 0).toBe(0);
  }, 600000);
});
