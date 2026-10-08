// Comparación de escenarios en "modo rápido": el motor corre sin dibujar, con
// la misma duración y las mismas semillas para todos, y se reporta promedio y
// rango. Así se responde "¿y si fue suerte?".

import { crearRed } from '../sim/red.js';
import { crearMotor } from '../sim/motor.js';
import { aplicarEscenario } from './escenario.js';

export const METRICAS_COMPARADAS = [
  'viajesCompletados', 'tiempoMedio', 'demoraMedia', 'demoraTotalVh', 'bloqueos', 'viajesImposibles',
];
const MUESTREO = 60; // s

const promedio = (valores) => (valores.length ? valores.reduce((s, x) => s + x, 0) / valores.length : 0);

export function correrEscenario(base, escenario, { semilla = 1, duracion = 1800, datos } = {}) {
  const red = crearRed(datos ?? aplicarEscenario(base, escenario));
  const motor = crearMotor(red, {
    semilla, demanda: escenario.demanda, restriccionPesados: escenario.restriccionPesados,
  });
  const pasosMuestreo = Math.round(MUESTREO / motor.dt);
  const total = Math.round(duracion / motor.dt);
  const serie = [];
  const acumulado = new Map();
  for (let k = 1; k <= total; k++) {
    motor.paso();
    if (k % pasosMuestreo !== 0) continue;
    const r = motor.resumen();
    serie.push({ t: motor.t, demoraReciente: r.demoraReciente, enRed: r.enRed });
    for (const { viaId, ratio } of motor.estadoVias()) {
      const x = acumulado.get(viaId) ?? { suma: 0, n: 0 };
      x.suma += ratio;
      x.n += 1;
      acumulado.set(viaId, x);
    }
  }
  const uso = motor.usoVias();
  const vias = new Map();
  for (const [viaId, { suma, n }] of acumulado) vias.set(viaId, { ratio: suma / n, uso: uso.get(viaId) ?? 0 });
  for (const [viaId, u] of uso) if (!vias.has(viaId)) vias.set(viaId, { ratio: 1, uso: u });
  return { resumen: motor.resumen(), serie, vias };
}

export function resumirCorridas(nombre, corridas) {
  const metricas = {};
  for (const clave of METRICAS_COMPARADAS) {
    const valores = corridas.map((c) => c.resumen[clave]);
    metricas[clave] = { media: promedio(valores), min: Math.min(...valores), max: Math.max(...valores) };
  }
  const serie = corridas[0].serie.map((punto, i) => ({
    t: punto.t,
    demoraReciente: promedio(corridas.map((c) => c.serie[i]?.demoraReciente ?? 0)),
    enRed: promedio(corridas.map((c) => c.serie[i]?.enRed ?? 0)),
  }));
  const sumas = new Map();
  for (const c of corridas) {
    for (const [viaId, { ratio, uso }] of c.vias) {
      const x = sumas.get(viaId) ?? { ratio: 0, uso: 0 };
      x.ratio += ratio;
      x.uso += uso;
      sumas.set(viaId, x);
    }
  }
  const vias = {};
  for (const [viaId, { ratio, uso }] of sumas) vias[viaId] = { ratio: ratio / corridas.length, uso: uso / corridas.length };
  return { nombre, metricas, serie, vias };
}

export function compararEscenarios(base, escenarios, { semillas = [1, 2, 3], duracion = 1800, alProgreso = () => {} } = {}) {
  const total = escenarios.length * semillas.length;
  let hechos = 0;
  const resultados = escenarios.map((escenario) => {
    const datos = aplicarEscenario(base, escenario);
    const corridas = semillas.map((semilla) => {
      const corrida = correrEscenario(base, escenario, { semilla, duracion, datos });
      hechos += 1;
      alProgreso(hechos, total);
      return corrida;
    });
    return resumirCorridas(escenario.nombre, corridas);
  });
  return { duracion, semillas, resultados };
}

// Variación relativa de una métrica frente a la referencia (0,25 = 25 % más).
export function variacion(referencia, otro, clave) {
  const a = referencia.metricas[clave].media;
  const b = otro.metricas[clave].media;
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return (b - a) / a;
}

// Cuánto cambió la fluidez de cada vía (positivo = más fluida que en la referencia).
export function diferenciasPorVia(referencia, otro, { usoMinimo = 5 } = {}) {
  const ids = new Set([...Object.keys(referencia.vias), ...Object.keys(otro.vias)]);
  const diferencias = new Map();
  for (const id of ids) {
    const a = referencia.vias[id] ?? { ratio: 1, uso: 0 };
    const b = otro.vias[id] ?? { ratio: 1, uso: 0 };
    if (Math.max(a.uso, b.uso) < usoMinimo) continue;
    diferencias.set(id, b.ratio - a.ratio);
  }
  return diferencias;
}
