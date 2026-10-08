import { describe, it, expect } from 'vitest';
import { crearDemanda, prepararPuntos, DEMANDA_BASE, PERFIL_HORARIO } from '../../src/sim/demanda.js';
import { crearAleatorio } from '../../src/sim/aleatorio.js';
import { redLinea, punto } from './redesPrueba.js';

const puntos = {
  zonas: {
    centro: { nombre: 'Centro', nodo: 'Z', peso: 4 },
    terminal: { nombre: 'Terminal', nodo: 'T', peso: 2 },
    terminalito: { nombre: 'Terminalito', nodo: 't', peso: 1 },
  },
  salidas: {
    s1: { nombre: 'S1', nodo: 'S1', avenida: true },
    s2: { nombre: 'S2', nodo: 'S2', avenida: true },
    s3: { nombre: 'S3', nodo: 'S3', avenida: false },
  },
  nodosLocales: ['L1', 'L2', 'L3', 'L4'],
  avisos: [],
};

const unaHora = (config, semilla = 1) => {
  const demanda = crearDemanda(puntos, config, crearAleatorio(semilla));
  const viajes = [];
  for (let t = 0; t < 3600; t += 0.5) viajes.push(...demanda.generar(t, 0.5));
  return viajes;
};

describe('crearDemanda', () => {
  it('es determinista con la misma semilla', () => {
    expect(unaHora({ horaInicio: 11 }, 5)).toEqual(unaHora({ horaInicio: 11 }, 5));
  });

  it('genera cerca del volumen base en una hora con perfil 1,0', () => {
    expect(PERFIL_HORARIO[11]).toBe(1);
    const locales = unaHora({ horaInicio: 11 }).filter((v) => v.flujo === 'local').length;
    expect(locales).toBeGreaterThan(DEMANDA_BASE.local * 0.85);
    expect(locales).toBeLessThan(DEMANDA_BASE.local * 1.15);
  });

  it('el factor y la temporada multiplican la demanda', () => {
    const normal = unaHora({ horaInicio: 11 }).length;
    const alta = unaHora({ horaInicio: 11, temporada: 1.4 }).length;
    const doble = unaHora({ horaInicio: 11, factor: 2 }).length;
    expect(alta / normal).toBeGreaterThan(1.25);
    expect(alta / normal).toBeLessThan(1.55);
    expect(doble / normal).toBeGreaterThan(1.8);
    expect(doble / normal).toBeLessThan(2.2);
  });

  it('nunca genera un viaje con origen igual a destino', () => {
    expect(unaHora({ horaInicio: 11 }).every((v) => v.origen !== v.destino)).toBe(true);
  });

  it('los pesados van entre salidas de la Avenida y son camiones', () => {
    const pesados = unaHora({ horaInicio: 11 }).filter((v) => v.flujo === 'pesado');
    expect(pesados.length).toBeGreaterThan(0);
    for (const v of pesados) {
      expect(v.tipo).toBe('camion');
      expect(['S1', 'S2']).toContain(v.origen);
      expect(['S1', 'S2']).toContain(v.destino);
    }
  });

  it('los buses nacionales van entre la Avenida y la Terminal; los intermunicipales salen del Terminalito', () => {
    const viajes = unaHora({ horaInicio: 11, factor: 3 });
    for (const v of viajes.filter((x) => x.flujo === 'busNacional')) {
      expect(v.tipo).toBe('bus_nacional');
      expect([v.origen, v.destino]).toContain('T');
    }
    const inter = viajes.filter((x) => x.flujo === 'intermunicipal');
    expect(inter.length).toBeGreaterThan(0);
    for (const v of inter) expect([v.origen, v.destino]).toContain('t');
  });

  it('con factor 0 no genera nada', () => {
    const demanda = crearDemanda(puntos, { horaInicio: 11 }, crearAleatorio(1));
    demanda.configurar({ factor: 0 });
    let total = 0;
    for (let t = 0; t < 600; t += 0.5) total += demanda.generar(t, 0.5).length;
    expect(total).toBe(0);
  });

  it('el perfil horario cambia la tasa con la hora simulada', () => {
    const madrugada = unaHora({ horaInicio: 3 }).length;
    const pico = unaHora({ horaInicio: 7 }).length;
    expect(pico).toBeGreaterThan(madrugada * 3);
  });
});

describe('prepararPuntos', () => {
  const red = redLinea({ tramos: 3, extra: { sentido: 'ambos', tipo: 'doble_sentido' } });

  it('ubica cada zona en el cruce más cercano y excluye las salidas de los cruces locales', () => {
    const [lon, lat] = punto(210, 5);
    const p = prepararPuntos(red, { centro: { nombre: 'C', lon, lat, peso: 1 } }, { x: { nombre: 'X', nodo: 'n3', avenida: true } });
    expect(p.zonas.centro.nodo).toBe('n1');
    expect(p.salidas.x.nodo).toBe('n3');
    expect(p.nodosLocales).not.toContain('n3');
    expect(p.avisos).toEqual([]);
  });

  it('avisa de las salidas cuyo nodo no está en la red', () => {
    const p = prepararPuntos(red, {}, { mala: { nombre: 'Mala', nodo: 'zzz', avenida: false } });
    expect(p.salidas.mala).toBeUndefined();
    expect(p.avisos.join(' ')).toContain('zzz');
  });
});
