import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  trazadoAproximadoVariante, puentePropuesto, arreglarVias, construirPrecargados,
} from '../../src/escenarios/precargados.js';
import { aplicarEscenario } from '../../src/escenarios/escenario.js';
import { aplicarCambios } from '../../src/escenarios/cambios.js';
import { crearRed } from '../../src/sim/red.js';
import { prepararGeometria } from '../../src/sim/geometriaArcos.js';
import { arcosEnCasco, rodeaElCasco } from '../../src/sim/restriccion.js';
import { distanciaMetros, lineasSeCruzan } from '../../src/sim/geo.js';
import { CASCO_URBANO, SALIDAS } from '../../src/escenarios/zonas.js';

const leer = (archivo) => JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', archivo), 'utf8'));
const base = leer('red-sangil.json');
const rios = leer('rios.json').rios.map((r) => r.geometria);
const aplicar = (entradas) => aplicarCambios(base, entradas.map((e) => e.cambio));

describe('Variante con trazado aproximado', () => {
  it('conecta Socorro con Bucaramanga por fuera del casco urbano', () => {
    const datos = aplicar(trazadoAproximadoVariante(base));
    const red = crearRed(datos);
    const casco = arcosEnCasco(red, prepararGeometria(red), CASCO_URBANO);
    expect(rodeaElCasco(red, casco, SALIDAS.socorro.nodo, SALIDAS.bucaramanga.nodo)).toBe(true);
    expect(datos.vias.filter((v) => v.tipo === 'variante').every((v) => !v.enConstruccion)).toBe(true);
  }, 30000);
});

describe('puente propuesto', () => {
  it('cruza el río, mide máximo 160 m y queda lejos de los puentes existentes', () => {
    const entrada = puentePropuesto(base, rios);
    expect(entrada).not.toBeNull();
    const datos = aplicar([entrada]);
    const puente = datos.vias.find((v) => v.id === entrada.cambio.id);
    expect(puente.esPuente).toBe(true);
    expect(puente.longitud).toBeLessThanOrEqual(160);
    expect(rios.some((r) => lineasSeCruzan(puente.geometria, r))).toBe(true);
    const medio = (g) => g[Math.floor(g.length / 2)];
    for (const v of base.vias.filter((x) => x.esPuente)) {
      expect(distanciaMetros(medio(puente.geometria), medio(v.geometria))).toBeGreaterThanOrEqual(250);
    }
  }, 30000);

  it('sin ríos no hay puente propuesto', () => {
    expect(puentePropuesto(base, [])).toBeNull();
  });
});

describe('vías arregladas', () => {
  it('deja en buen estado y pavimentadas las vías en mal estado cerca del centro', () => {
    const entradas = arreglarVias(base);
    expect(entradas.length).toBeGreaterThan(0);
    const datos = aplicar(entradas);
    for (const e of entradas) {
      expect(datos.vias.find((v) => v.id === e.cambio.viaId)).toMatchObject({ estado: 'bueno', superficie: 'pavimento' });
    }
  });
});

describe('construirPrecargados', () => {
  it('todos los escenarios y pasos de historia se aplican a la red', () => {
    const { escenarios, historias } = construirPrecargados(base, rios);
    expect(escenarios.map((e) => e.nombre)).toEqual(expect.arrayContaining([
      'San Gil actual', 'Temporada alta', 'Obra en el Rojas Pinilla', 'Variante terminada con restricción', 'Puente nuevo propuesto',
    ]));
    for (const e of escenarios) expect(() => aplicarEscenario(base, e)).not.toThrow();
    const mejora = historias.find((h) => h.nombre === 'Cómo mejora San Gil');
    expect(mejora.pasos.map((p) => p.titulo)).toHaveLength(5);
    for (const p of mejora.pasos) expect(() => aplicarEscenario(base, p.escenario)).not.toThrow();
    // cada paso acumula los cambios del anterior
    for (let i = 1; i < mejora.pasos.length; i++) {
      expect(mejora.pasos[i].escenario.entradas.length).toBeGreaterThanOrEqual(mejora.pasos[i - 1].escenario.entradas.length);
    }
    expect(historias.find((h) => h.nombre === 'Cómo empeora San Gil').pasos).toHaveLength(3);
  }, 60000);

  it('sin ríos se construye igual, sin el puente propuesto', () => {
    const { escenarios, historias } = construirPrecargados(base, []);
    expect(escenarios.some((e) => e.nombre === 'Puente nuevo propuesto')).toBe(false);
    expect(historias.find((h) => h.nombre === 'Cómo mejora San Gil').pasos).toHaveLength(4);
  }, 60000);
});
