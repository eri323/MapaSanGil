// Demanda de viajes. Los volúmenes son SUPUESTOS (no hay aforos): sirven para
// comparar escenarios entre sí, no para predecir tiempos absolutos.

import { componentePrincipal } from './red.js';
import { distanciaMetros } from './geo.js';

export const DEMANDA_BASE = {
  local: 1000,
  paso: 300,
  pesado: 120,
  busNacional: 20,
  busPaso: 10,
  intermunicipal: 30,
};
export const FLUJOS = Object.keys(DEMANDA_BASE);

export const MEZCLA_LOCAL = { moto: 0.5, carro: 0.3, buseta: 0.2 };
export const MEZCLA_PASO = { carro: 0.7, moto: 0.3 };

// Multiplicador por hora del día: picos de mañana, mediodía y tarde.
export const PERFIL_HORARIO = [
  0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.7, 1.3, 1.1, 0.9, 0.9, 1.0,
  1.2, 1.1, 0.9, 0.9, 0.9, 1.2, 1.3, 1.0, 0.7, 0.5, 0.3, 0.3,
];

const PROPORCION_A_ZONAS = 0.4;
const RADIO_LOCAL = 2000; // m alrededor del centro para los viajes locales

export function prepararPuntos(red, zonas, salidas) {
  const principal = componentePrincipal(red);
  const candidatos = [...principal].map((id) => red.nodos.get(id));
  const masCercano = (lon, lat) => {
    let mejor = null;
    let mejorDistancia = Infinity;
    for (const n of candidatos) {
      const d = distanciaMetros([lon, lat], [n.lon, n.lat]);
      if (d < mejorDistancia) { mejor = n; mejorDistancia = d; }
    }
    return mejor;
  };

  const avisos = [];
  const zonasListas = {};
  for (const [clave, z] of Object.entries(zonas)) {
    const n = masCercano(z.lon, z.lat);
    if (n) zonasListas[clave] = { nombre: z.nombre, nodo: n.id, peso: z.peso };
  }

  const salidasListas = {};
  for (const [clave, s] of Object.entries(salidas)) {
    if (!principal.has(s.nodo)) {
      avisos.push(`${s.nombre}: el nodo ${s.nodo} no está en la red principal`);
      continue;
    }
    salidasListas[clave] = { nombre: s.nombre, nodo: s.nodo, avenida: s.avenida };
  }

  const nodosSalida = new Set(Object.values(salidasListas).map((s) => s.nodo));
  const centro = zonas.centro;
  const nodosLocales = candidatos
    .filter((n) => !nodosSalida.has(n.id))
    .filter((n) => !centro || distanciaMetros([centro.lon, centro.lat], [n.lon, n.lat]) <= RADIO_LOCAL)
    .map((n) => n.id);

  return { zonas: zonasListas, salidas: salidasListas, nodosLocales, avisos };
}

export function crearDemanda(puntosIniciales, configInicial, aleatorio) {
  let config = { factor: 1, temporada: 1, horaInicio: 7, ...configInicial };
  const proximo = Object.fromEntries(FLUJOS.map((f) => [f, null]));

  let puntos;
  let salidas;
  let salidasAvenida;
  let pesosZonas;
  function usarPuntos(nuevos) {
    puntos = nuevos;
    salidas = Object.values(puntos.salidas);
    salidasAvenida = salidas.filter((s) => s.avenida);
    pesosZonas = Object.fromEntries(Object.entries(puntos.zonas).map(([k, z]) => [k, z.peso]));
  }
  usarPuntos(puntosIniciales);

  const hora = (t) => Math.floor(config.horaInicio + t / 3600) % 24;
  const tasa = (flujo, t) => (DEMANDA_BASE[flujo] * config.factor * config.temporada * PERFIL_HORARIO[hora(t)]) / 3600;

  const dosDistintas = (lista) => {
    if (lista.length < 2) return null;
    const a = aleatorio.elegir(lista);
    let b = aleatorio.elegir(lista);
    while (b === a) b = aleatorio.elegir(lista);
    return [a.nodo, b.nodo];
  };
  const alAzar = (a, b) => (aleatorio.siguiente() < 0.5 ? [a, b] : [b, a]);

  const puntoLocal = () => {
    if (Object.keys(pesosZonas).length && aleatorio.siguiente() < PROPORCION_A_ZONAS) {
      return puntos.zonas[aleatorio.elegirPonderado(pesosZonas)].nodo;
    }
    return aleatorio.elegir(puntos.nodosLocales);
  };

  function crearViaje(flujo) {
    let tipo;
    let par = null;
    if (flujo === 'local') {
      if (!puntos.nodosLocales.length) return null;
      tipo = aleatorio.elegirPonderado(MEZCLA_LOCAL);
      const origen = puntoLocal();
      let destino = puntoLocal();
      for (let intento = 0; destino === origen && intento < 5; intento++) destino = puntoLocal();
      if (destino !== origen) par = [origen, destino];
    } else if (flujo === 'paso') {
      tipo = aleatorio.elegirPonderado(MEZCLA_PASO);
      par = dosDistintas(salidas);
    } else if (flujo === 'pesado') {
      tipo = 'camion';
      par = dosDistintas(salidasAvenida);
    } else if (flujo === 'busNacional') {
      tipo = 'bus_nacional';
      const terminal = puntos.zonas.terminal?.nodo;
      if (terminal && salidasAvenida.length) par = alAzar(aleatorio.elegir(salidasAvenida).nodo, terminal);
    } else if (flujo === 'busPaso') {
      tipo = 'bus_nacional';
      par = dosDistintas(salidasAvenida);
    } else if (flujo === 'intermunicipal') {
      tipo = 'bus_intermunicipal';
      const terminalito = puntos.zonas.terminalito?.nodo;
      if (terminalito && salidas.length) par = alAzar(aleatorio.elegir(salidas).nodo, terminalito);
    }
    if (!par || par[0] === par[1]) return null;
    return { tipo, origen: par[0], destino: par[1], flujo };
  }

  return {
    generar(t, dt) {
      const viajes = [];
      for (const flujo of FLUJOS) {
        const r = tasa(flujo, t);
        if (r <= 0) { proximo[flujo] = null; continue; }
        if (proximo[flujo] === null) proximo[flujo] = t + aleatorio.exponencial(r);
        while (proximo[flujo] < t + dt) {
          const viaje = crearViaje(flujo);
          if (viaje) viajes.push(viaje);
          proximo[flujo] += aleatorio.exponencial(r);
        }
      }
      return viajes;
    },
    configurar(parcial) {
      config = { ...config, ...parcial };
      for (const flujo of FLUJOS) proximo[flujo] = null;
    },
    config: () => ({ ...config }),
    actualizarPuntos: usarPuntos,
  };
}
