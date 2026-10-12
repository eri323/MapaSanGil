import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  correrEscenario, compararEscenarios, variacion, diferenciasPorVia, METRICAS_COMPARADAS, resumirCorridas,
} from '../../src/escenarios/comparar.js';
import { crearEscenario } from '../../src/escenarios/escenario.js';
import { datosRedLinea } from '../sim/redesPrueba.js';

const linea = datosRedLinea({ tramos: 3, extra: { sentido: 'ambos', tipo: 'doble_sentido' } });
const cerrar = (via) => ({ cambio: { tipo: 'via', viaId: via, propiedades: { abierta: false } }, descripcion: via });
const base = crearEscenario({ nombre: 'Base', demanda: { horaInicio: 11, factor: 0.3 } });
const cerrado = crearEscenario({ nombre: 'Cerrado', entradas: [cerrar('t1')], demanda: { horaInicio: 11, factor: 0.3 } });

describe('correrEscenario', () => {
  it('devuelve resumen, serie por minuto y estado por vía', () => {
    const r = correrEscenario(linea, base, { semilla: 1, duracion: 300 });
    expect(r.serie).toHaveLength(5);
    expect(r.serie[0]).toMatchObject({ t: 60 });
    expect(r.resumen.viajesCompletados).toBeGreaterThan(0);
    expect(r.vias.size).toBeGreaterThan(0);
  });

  it('es determinista con la misma semilla', () => {
    const a = correrEscenario(linea, base, { semilla: 4, duracion: 300 });
    const b = correrEscenario(linea, base, { semilla: 4, duracion: 300 });
    expect(a.resumen).toEqual(b.resumen);
  });
});

describe('compararEscenarios', () => {
  it('corre cada escenario con cada semilla, informa el progreso y resume con promedio y rango', () => {
    const progreso = [];
    const r = compararEscenarios(linea, [base, cerrado], { semillas: [1, 2], duracion: 300, alProgreso: (h, t) => progreso.push([h, t]) });
    expect(progreso).toEqual([[1, 4], [2, 4], [3, 4], [4, 4]]);
    expect(r.resultados.map((x) => x.nombre)).toEqual(['Base', 'Cerrado']);
    for (const res of r.resultados) {
      for (const clave of METRICAS_COMPARADAS) {
        const { media, min, max } = res.metricas[clave];
        expect(min).toBeLessThanOrEqual(media);
        expect(media).toBeLessThanOrEqual(max);
      }
      expect(res.serie).toHaveLength(5);
    }
    // la vía cerrada no la usa nadie en ese escenario y sí en la base
    expect(r.resultados[0].vias.t1?.uso ?? 0).toBeGreaterThan(0);
    expect(r.resultados[1].vias.t1?.uso ?? 0).toBe(0);
  });
});

describe('variacion y diferencias', () => {
  const res = (media) => ({ metricas: { demoraMedia: { media, min: media, max: media } } });

  it('variación porcentual frente a la referencia; null si la referencia es 0', () => {
    expect(variacion(res(100), res(150), 'demoraMedia')).toBeCloseTo(0.5, 6);
    expect(variacion(res(0), res(150), 'demoraMedia')).toBeNull();
  });

  it('diferencias por vía: solo las que tienen uso suficiente', () => {
    const a = { vias: { x: { ratio: 0.5, uso: 10 }, y: { ratio: 0.9, uso: 1 } } };
    const b = { vias: { x: { ratio: 0.8, uso: 12 }, y: { ratio: 0.2, uso: 2 }, z: { ratio: 0.7, uso: 9 } } };
    const d = diferenciasPorVia(a, b, { usoMinimo: 5 });
    expect(d.get('x')).toBeCloseTo(0.3, 6);
    expect(d.has('y')).toBe(false);
    expect(d.get('z')).toBeCloseTo(-0.3, 6);
  });
});

describe('comparar en San Gil', () => {
  it('cerrar el Rojas Pinilla da más demora en promedio de dos semillas', () => {
    const datos = JSON.parse(readFileSync(join(process.cwd(), 'public', 'data', 'red-sangil.json'), 'utf8'));
    const rojas = datos.vias.filter((v) => v.osmId === 24670013).map((v) => cerrar(v.id));
    const r = compararEscenarios(datos, [
      crearEscenario({ nombre: 'Base' }),
      crearEscenario({ nombre: 'Obra', entradas: rojas }),
    ], { semillas: [1, 2], duracion: 900 });
    expect(variacion(r.resultados[0], r.resultados[1], 'demoraMedia')).toBeGreaterThan(0);
  }, 300000);
});

describe('uso de puentes y Variante con la red de cada escenario', () => {
  it('cuenta las vías nuevas del escenario, aunque no existan en la red base', () => {
    const corrida = { resumen: Object.fromEntries(METRICAS_COMPARADAS.map((m) => [m, 0])), serie: [], vias: new Map([['puente-nuevo', { ratio: 1, uso: 7 }], ['t0', { ratio: 1, uso: 3 }], ['var', { ratio: 1, uso: 5 }]]) };
    const datos = { vias: [{ id: 'puente-nuevo', esPuente: true, tipo: 'doble_sentido' }, { id: 't0', esPuente: false, tipo: 'un_sentido' }, { id: 'var', esPuente: false, tipo: 'variante' }] };
    const r = resumirCorridas('Con puente', [corrida], datos);
    expect(r.usoClave).toEqual({ puentes: 7, variante: 5 });
  });
});

describe('resumir corridas sin viajes completados', () => {
  it('las duraciones quedan sin dato y la variación no se puede calcular', () => {
    const vacia = { resumen: { viajesCompletados: 0, tiempoMedio: null, demoraMedia: null, demoraTotalVh: 0, bloqueos: 3, viajesImposibles: 9 }, serie: [{ t: 60, demoraReciente: null, enRed: 0 }], vias: new Map() };
    const r = resumirCorridas('Todo cerrado', [vacia, vacia]);
    expect(r.metricas.demoraMedia).toEqual({ media: null, min: null, max: null });
    expect(r.metricas.bloqueos).toEqual({ media: 3, min: 3, max: 3 });
    expect(r.serie[0].demoraReciente).toBeNull();
    const ref = { metricas: { demoraMedia: { media: 40, min: 40, max: 40 } } };
    expect(variacion(ref, r, 'demoraMedia')).toBeNull();
  });
});
