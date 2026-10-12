// El motor de simulación: avanza el tiempo en pasos fijos y mueve cada
// vehículo con IDM, respetando cruces, carriles y rutas. JavaScript puro.

import { crearAleatorio } from './aleatorio.js';
import { PERFILES, TIPOS_VEHICULO, crearConductor, velocidadDeseada } from './vehiculos.js';
import { aceleracionIDM, avanzar } from './idm.js';
import { prepararGeometria, posicionEnArco } from './geometriaArcos.js';
import { rutaMasRapida, crearTiempos } from './rutas.js';
import { analizarAccesos, puedeEntrar } from './cruces.js';
import { convieneCambiar } from './mobil.js';
import { crearDemanda, prepararPuntos } from './demanda.js';
import { crearMetricas } from './metricas.js';
import { arcoTransitable } from './red.js';
import { ZONAS, SALIDAS, CASCO_URBANO } from '../escenarios/zonas.js';
import { arcosEnCasco, FLUJOS_RESTRINGIBLES, permitidoRestringido } from './restriccion.js';

const DISTANCIA_DECISION = 60; // m: la vía con prioridad confirma el paso desde aquí
const DISTANCIA_SEMAFORO = 30; // m: se mira el color del semáforo desde aquí
const MARGEN_CEDER = 8; // m sobre s0: quien cede evalúa el hueco ya en la línea
const DISTANCIA_SIN_CAMBIO = 15; // m antes del cruce en que ya no se cambia de carril
const ANCHO_CARRIL = 3.2;
const DISTANCIA_LLEGADA = 40; // m: un vehículo con permiso a esta distancia ya "viene entrando"

export const VALORES_POR_DEFECTO = { dt: 0.5, umbralBloqueo: 180, intervaloReruteo: 90 };

function insertarOrdenado(lista, veh) {
  const k = lista.findIndex((otro) => otro.s < veh.s);
  if (k === -1) lista.push(veh);
  else lista.splice(k, 0, veh);
}

export function crearMotor(redInicial, opciones = {}) {
  const {
    semilla = 1, dt = VALORES_POR_DEFECTO.dt, umbralBloqueo = VALORES_POR_DEFECTO.umbralBloqueo,
    intervaloReruteo = VALORES_POR_DEFECTO.intervaloReruteo,
    demanda: configDemanda = {}, conDemanda = true, zonas = ZONAS, salidas = SALIDAS,
    alCruzar = null, alTerminar = null, casco = CASCO_URBANO, restriccionPesados = false,
  } = opciones;

  const aleatorio = crearAleatorio(semilla);
  const metricas = crearMetricas();
  let red = redInicial;
  let geometria;
  let accesos;
  let cascoArcos;
  let estadoArco;

  // Todo lo que depende de la forma de la red. Cada arco guarda sus carriles;
  // cada carril, sus vehículos del frente hacia atrás.
  function construirArcos() {
    geometria = prepararGeometria(red);
    accesos = analizarAccesos(red, geometria);
    cascoArcos = arcosEnCasco(red, geometria, casco);
    estadoArco = new Map();
    for (const [arcoId, geo] of geometria) {
      const via = red.vias.get(red.arcos.get(arcoId).viaId);
      estadoArco.set(arcoId, {
        id: arcoId, via, geo, largo: geo.largo,
        carriles: Array.from({ length: via.carrilesPorSentido }, () => []),
      });
    }
  }
  construirArcos();

  let tiempos = crearTiempos(red, geometria);
  let restriccion = restriccionPesados;
  let puntos = prepararPuntos(red, zonas, salidas);
  const demanda = conDemanda ? crearDemanda(puntos, configDemanda, aleatorio) : null;

  const ocupadoHasta = new Map();
  const llegandoA = new Set(); // arcos a los que un vehículo con permiso está por entrar
  const usoVias = new Map();
  const pendientes = [];
  const vivos = new Set();
  let t = 0;
  let pasos = 0;
  let siguienteId = 1;

  const costo = (arcoId) => (arcoTransitable(red, arcoId) ? tiempos.estimado(arcoId) : Infinity);
  const costoRestringido = (arcoId) => (permitidoRestringido(red, cascoArcos, arcoId) ? tiempos.estimado(arcoId) : Infinity);

  // Con la restricción activa, los pesados de paso solo usan Avenida y Variante
  // por fuera del casco; si así no llegan (la Variante no conecta), pasan por
  // el centro como hoy.
  function rutaPara(veh, origen) {
    if (restriccion && veh.restringible) {
      const ruta = rutaMasRapida(red, origen, veh.destino, costoRestringido);
      if (ruta) return ruta;
    }
    return rutaMasRapida(red, origen, veh.destino, costo);
  }

  function frente(e) {
    let f = null;
    for (const carril of e.carriles) if (carril[0] && (!f || carril[0].s > f.s)) f = carril[0];
    return f;
  }

  function ultimo(e) {
    let u = null;
    for (const carril of e.carriles) {
      const x = carril.at(-1);
      if (x && (!u || x.s < u.s)) u = x;
    }
    return u;
  }

  // Segundos hasta que el primer vehículo de un arco llegue al cruce.
  function llegadas(arcoId) {
    const e = estadoArco.get(arcoId);
    const f = frente(e);
    if (!f) return Infinity;
    if (f.v < 0.5 && !f.permiso) return Infinity; // está detenido cediendo: no llega
    return (e.largo - f.s) / Math.max(f.v, 0.5);
  }

  function agregarVehiculo({ tipo, origen, destino, conductor, flujo = 'local' }) {
    const restringible = FLUJOS_RESTRINGIBLES.has(flujo);
    const ruta = rutaPara({ restringible, destino }, origen);
    if (!ruta || ruta.arcos.length === 0) {
      metricas.viajeImposible();
      return null;
    }
    const perfil = PERFILES[tipo];
    const cond = conductor ?? crearConductor(aleatorio);
    const tiempoLibre = ruta.arcos.reduce((suma, id) => {
      const e = estadoArco.get(id);
      return suma + e.largo / velocidadDeseada(perfil, e.via, cond);
    }, 0);
    const veh = {
      id: siguienteId++, tipo, tipoIndice: TIPOS_VEHICULO.indexOf(tipo), perfil, conductor: cond,
      ruta: ruta.arcos, i: 0, s: 0, v: 0, a: 0, carril: 0, destino, origen, flujo, restringible,
      tSalida: t, tEntradaArco: t, tiempoLibre,
      permiso: false, paroEnPare: false, esperaCruce: 0, quietoDesde: null, transferidoEn: -1,
      proximoReruteo: t + intervaloReruteo * (0.5 + aleatorio.siguiente()),
    };
    pendientes.push(veh);
    return veh;
  }

  function intentarInsertar() {
    const restantes = [];
    for (const veh of pendientes) {
      const e = estadoArco.get(veh.ruta[0]);
      let carril = -1;
      // No se inserta un viaje nuevo delante de alguien que ya viene entrando al arco.
      if (arcoTransitable(red, e.id) && !llegandoA.has(e.id)) {
        for (let c = 0; c < e.carriles.length; c++) {
          const ult = e.carriles[c].at(-1);
          if (!ult || ult.s - ult.perfil.largo >= veh.perfil.s0 + 1) { carril = c; break; }
        }
      }
      if (carril === -1) {
        // Quien no logra entrar en mucho tiempo (vía cerrada o llena) cuenta como bloqueo.
        if (t - veh.tSalida > umbralBloqueo) metricas.bloqueo();
        else restantes.push(veh);
        continue;
      }
      const ult = e.carriles[carril].at(-1);
      veh.carril = carril;
      veh.s = 0;
      veh.v = ult ? Math.min(ult.v, 5) : 5;
      veh.tEntradaArco = t;
      e.carriles[carril].push(veh);
      vivos.add(veh);
    }
    pendientes.length = 0;
    pendientes.push(...restantes);
  }

  // Lo que tiene adelante el primer vehículo de un carril: la línea del cruce
  // si no tiene permiso, o la cola del arco siguiente si ya lo tiene.
  function obstaculoEnCruce(veh, e) {
    const distLinea = e.largo - veh.s;
    const siguienteArco = veh.ruta[veh.i + 1];
    const sig = estadoArco.get(siguienteArco);
    const ult = ultimo(sig);
    const espacio = ult ? ult.s - ult.perfil.largo : Infinity;

    if (!veh.permiso) {
      const acceso = accesos.get(e.id);
      if (acceso.tipo === 'pare' && veh.v < 0.3 && distLinea < veh.perfil.s0 + 3) veh.paroEnPare = true;
      if (veh.v < 0.3 && distLinea < veh.perfil.s0 + 5) veh.esperaCruce += dt;
      const transitable = arcoTransitable(red, siguienteArco);
      if (!transitable) veh.proximoReruteo = Math.min(veh.proximoReruteo, t);
      let alcance = veh.perfil.s0 + MARGEN_CEDER;
      if (acceso.tipo === 'prioridad') alcance = DISTANCIA_DECISION;
      else if (acceso.tipo === 'semaforo') alcance = DISTANCIA_SEMAFORO;
      if (transitable && distLinea < alcance && espacio >= veh.perfil.largo + 1) {
        const nodo = acceso.nodo;
        veh.permiso = puedeEntrar({
          acceso, vehiculo: veh, t, ocupadoHasta: ocupadoHasta.get(nodo) ?? -Infinity, llegadas,
        });
        // Quien cede reserva el cruce mientras lo atraviesa.
        if (veh.permiso && acceso.tipo !== 'prioridad' && acceso.tipo !== 'semaforo') {
          const despeje = (distLinea + veh.perfil.largo + 6) / Math.max(veh.v, 3);
          ocupadoHasta.set(nodo, Math.max(ocupadoHasta.get(nodo) ?? -Infinity, t + despeje));
        }
      }
    }
    if (veh.permiso) {
      if (distLinea < DISTANCIA_LLEGADA) llegandoA.add(siguienteArco);
      const v0Siguiente = velocidadDeseada(veh.perfil, sig.via, veh.conductor);
      let gap = distLinea + espacio;
      let vLider = ult ? ult.v : v0Siguiente;
      // Si el arco siguiente termina en un cruce donde quizá deba detenerse, su
      // línea también cuenta: así frena a tiempo antes de un tramo muy corto.
      const sigEsElUltimo = veh.i + 1 === veh.ruta.length - 1;
      if (!sigEsElUltimo && accesos.get(siguienteArco).tipo !== 'prioridad') {
        const lineaSiguiente = distLinea + Math.max(sig.largo, veh.perfil.s0 + 1);
        if (lineaSiguiente < gap) { gap = lineaSiguiente; vLider = 0; }
      }
      return { gap, vLider };
    }
    return { gap: distLinea, vLider: 0 };
  }

  function calcularAceleraciones() {
    llegandoA.clear();
    for (const e of estadoArco.values()) {
      for (const carril of e.carriles) {
        for (let k = 0; k < carril.length; k++) {
          const veh = carril[k];
          const v0 = velocidadDeseada(veh.perfil, e.via, veh.conductor);
          let gap = Infinity;
          let vLider = v0;
          if (k > 0) {
            const lider = carril[k - 1];
            gap = lider.s - lider.perfil.largo - veh.s;
            vLider = lider.v;
          } else if (veh.i < veh.ruta.length - 1) {
            ({ gap, vLider } = obstaculoEnCruce(veh, e));
          }
          veh.a = aceleracionIDM(veh.perfil, veh.v, v0, gap, vLider);
        }
      }
    }
  }

  function mover() {
    for (const e of estadoArco.values()) {
      for (const carril of e.carriles) {
        for (let k = 0; k < carril.length; k++) {
          const veh = carril[k];
          const antes = veh.s;
          const { v, dx } = avanzar(veh.v, veh.a, dt);
          veh.v = v;
          veh.s += dx;
          if (k > 0) {
            const lider = carril[k - 1];
            const tope = lider.s - lider.perfil.largo - 0.1;
            if (veh.s > tope) {
              veh.s = Math.max(tope, antes);
              veh.v = Math.min(veh.v, lider.v);
            }
          } else if (!veh.permiso && veh.i < veh.ruta.length - 1 && veh.s > e.largo - 0.1) {
            veh.s = Math.max(e.largo - 0.1, antes);
            veh.v = 0;
          }
          veh.quietoDesde = veh.v < 0.1 ? (veh.quietoDesde ?? t) : null;
        }
      }
    }
  }

  // Carril de llegada con más espacio libre al inicio; ante empate, el que
  // corresponde al carril en que venía.
  function carrilConMasEspacio(e, preferido) {
    let mejor = null;
    const propio = Math.min(preferido, e.carriles.length - 1);
    for (let c = 0; c < e.carriles.length; c++) {
      const ultimo = e.carriles[c].at(-1) ?? null;
      const espacio = ultimo ? ultimo.s - ultimo.perfil.largo : Infinity;
      if (!mejor || espacio > mejor.espacio || (espacio === mejor.espacio && c === propio)) {
        mejor = { carril: c, espacio, ultimo };
      }
    }
    return mejor;
  }

  function transferir() {
    for (const e of estadoArco.values()) {
      for (const carril of e.carriles) {
        while (carril.length && carril[0].s >= e.largo && carril[0].transferidoEn !== pasos) {
          const veh = carril[0];
          const instante = t + dt;
          let destino = null;
          if (veh.i < veh.ruta.length - 1) {
            // Entra al carril con más espacio; si el espacio medido antes ya lo
            // ocupó otro que entró en este mismo paso, espera en la línea.
            destino = carrilConMasEspacio(estadoArco.get(veh.ruta[veh.i + 1]), veh.carril);
            if (destino.espacio < veh.s - e.largo + 0.1) {
              veh.s = e.largo - 0.1;
              veh.v = Math.min(veh.v, destino.ultimo?.v ?? 0);
              break;
            }
          }
          carril.shift();
          tiempos.registrar(e.id, instante - veh.tEntradaArco);
          usoVias.set(e.via.id, (usoVias.get(e.via.id) ?? 0) + 1);

          if (veh.i === veh.ruta.length - 1) {
            vivos.delete(veh);
            metricas.viajeCompletado({ tipo: veh.tipo, duracion: instante - veh.tSalida, tiempoLibre: veh.tiempoLibre, t: instante });
            alTerminar?.(veh, instante);
            continue;
          }

          const nodo = red.arcos.get(e.id).hasta;
          const despeje = (veh.perfil.largo + 6) / Math.max(veh.v, 2);
          ocupadoHasta.set(nodo, Math.max(ocupadoHasta.get(nodo) ?? -Infinity, t + despeje));
          alCruzar?.(veh, nodo, instante);

          const sobrante = veh.s - e.largo;
          veh.i += 1;
          const sig = estadoArco.get(veh.ruta[veh.i]);
          veh.s = Math.min(sobrante, sig.largo - 0.1);
          veh.carril = destino.carril;
          veh.permiso = false;
          veh.paroEnPare = false;
          veh.esperaCruce = 0;
          veh.tEntradaArco = instante;
          veh.transferidoEn = pasos;
          insertarOrdenado(sig.carriles[veh.carril], veh);
        }
      }
    }
  }

  function vecinosEn(carril, s) {
    let lider = null;
    let seguidor = null;
    for (const otro of carril) {
      if (otro.s > s) lider = otro;
      else { seguidor = otro; break; }
    }
    return { lider, seguidor };
  }

  function aceleracionTras(veh, e, lider) {
    const v0 = velocidadDeseada(veh.perfil, e.via, veh.conductor);
    if (lider) return aceleracionIDM(veh.perfil, veh.v, v0, lider.s - lider.perfil.largo - veh.s, lider.v);
    if (veh.i < veh.ruta.length - 1 && !veh.permiso) return aceleracionIDM(veh.perfil, veh.v, v0, e.largo - veh.s, 0);
    return aceleracionIDM(veh.perfil, veh.v, v0, Infinity, v0);
  }

  function cambiosDeCarril() {
    for (const e of estadoArco.values()) {
      if (e.carriles.length < 2) continue;
      for (let c = 0; c < e.carriles.length; c++) {
        for (const veh of [...e.carriles[c]]) {
          if (e.largo - veh.s < DISTANCIA_SIN_CAMBIO) continue;
          for (const destino of [c + 1, c - 1]) {
            if (destino < 0 || destino >= e.carriles.length) continue;
            const { lider, seguidor } = vecinosEn(e.carriles[destino], veh.s);
            if (lider && lider.s - lider.perfil.largo - veh.s < 1) continue;
            if (seguidor && veh.s - veh.perfil.largo - seguidor.s < 1) continue;
            const actual = e.carriles[c];
            const idx = actual.indexOf(veh);
            const liderViejo = idx > 0 ? actual[idx - 1] : null;
            const seguidorViejo = actual[idx + 1] ?? null;
            const conviene = convieneCambiar({
              aActual: veh.a,
              aNueva: aceleracionTras(veh, e, lider),
              seguidorNuevo: seguidor && {
                antes: aceleracionTras(seguidor, e, lider),
                despues: aceleracionTras(seguidor, e, veh),
              },
              seguidorViejo: seguidorViejo && {
                antes: aceleracionTras(seguidorViejo, e, veh),
                despues: aceleracionTras(seguidorViejo, e, liderViejo),
              },
            });
            if (conviene) {
              actual.splice(idx, 1);
              insertarOrdenado(e.carriles[destino], veh);
              veh.carril = destino;
              break;
            }
          }
        }
      }
    }
  }

  // Un vehículo quieto demasiado tiempo se retira y se cuenta como bloqueo
  // (equivale al "teleport" de SUMO): síntoma de colapso.
  function liberarBloqueados() {
    for (const e of estadoArco.values()) {
      for (const carril of e.carriles) {
        for (let k = carril.length - 1; k >= 0; k--) {
          const veh = carril[k];
          if (veh.quietoDesde !== null && t - veh.quietoDesde > umbralBloqueo) {
            carril.splice(k, 1);
            vivos.delete(veh);
            metricas.bloqueo();
          }
        }
      }
    }
  }

  function reRutear() {
    for (const veh of vivos) {
      if (t < veh.proximoReruteo || veh.i >= veh.ruta.length - 1) continue;
      veh.proximoReruteo = t + intervaloReruteo;
      const desde = red.arcos.get(veh.ruta[veh.i]).hasta;
      const nueva = rutaPara(veh, desde);
      if (!nueva || nueva.arcos.length === 0) continue;
      if (nueva.arcos[0] !== veh.ruta[veh.i + 1] && veh.permiso) {
        // Cambiar de giro encima del cruce obligaría a frenar en seco: se
        // vuelve a intentar después de cruzar.
        const distLinea = estadoArco.get(veh.ruta[veh.i]).largo - veh.s;
        if (distLinea < veh.v ** 2 / (2 * veh.perfil.b) + veh.perfil.s0) {
          veh.proximoReruteo = t + 2;
          continue;
        }
        veh.permiso = false;
      }
      veh.ruta = veh.ruta.slice(0, veh.i + 1).concat(nueva.arcos);
    }
  }

  function marcarEsperas() {
    for (const e of estadoArco.values()) {
      const f = frente(e);
      tiempos.marcarEspera(e.id, f && f.quietoDesde !== null ? t - f.quietoDesde : 0);
    }
  }

  function contarEnCola() {
    let n = 0;
    for (const veh of vivos) if (veh.v < 1) n += 1;
    return n;
  }

  function estadoVias() {
    const acumulado = new Map();
    for (const e of estadoArco.values()) {
      for (const carril of e.carriles) {
        for (const veh of carril) {
          const x = acumulado.get(e.via.id) ?? { suma: 0, n: 0 };
          x.suma += veh.v / velocidadDeseada(veh.perfil, e.via, veh.conductor);
          x.n += 1;
          acumulado.set(e.via.id, x);
        }
      }
    }
    return [...acumulado].map(([viaId, { suma, n }]) => ({ viaId, ratio: Math.min(1, suma / n), vehiculos: n }));
  }

  const firma = (r, g, arcoId) => {
    const arco = r.arcos.get(arcoId);
    return arco ? `${arco.desde}|${arco.hasta}|${g.get(arcoId).largo.toFixed(1)}` : null;
  };

  // Aplica una red editada a la simulación en curso. Quien va por un arco que
  // no cambió sigue donde iba; quien iba por uno que cambió se retira.
  function aplicarRed(nuevaRed) {
    const antes = { red, geometria, estadoArco };
    const medidos = tiempos.exportar();
    red = nuevaRed;
    construirArcos();
    const igual = (arcoId) => {
      const f = firma(antes.red, antes.geometria, arcoId);
      return f !== null && f === firma(red, geometria, arcoId);
    };
    tiempos = crearTiempos(red, geometria, new Map([...medidos].filter(([id]) => igual(id))));
    puntos = prepararPuntos(red, zonas, salidas);
    demanda?.actualizarPuntos(puntos);
    llegandoA.clear();

    const retirar = (veh) => { vivos.delete(veh); metricas.retirado(); };
    for (const viejo of antes.estadoArco.values()) {
      for (const carril of viejo.carriles) {
        for (const veh of carril) {
          const actual = veh.ruta[veh.i];
          if (!igual(actual)) { retirar(veh); continue; }
          if (!veh.ruta.slice(veh.i + 1).every(igual)) {
            const nueva = rutaPara(veh, red.arcos.get(actual).hasta);
            if (!nueva || nueva.arcos.length === 0) { retirar(veh); continue; }
            veh.ruta = [...veh.ruta.slice(0, veh.i + 1), ...nueva.arcos];
          }
          const e = estadoArco.get(actual);
          veh.carril = Math.min(veh.carril, e.carriles.length - 1);
          veh.permiso = false;
          veh.paroEnPare = false;
          veh.proximoReruteo = t + (veh.id % 10); // repartido para no recalcular todo de una vez
          const lista = e.carriles[veh.carril];
          insertarOrdenado(lista, veh);
          const k = lista.indexOf(veh);
          const lider = lista[k - 1];
          const seguidor = lista[k + 1];
          if ((lider && lider.s - lider.perfil.largo < veh.s) || (seguidor && veh.s - veh.perfil.largo < seguidor.s)) {
            lista.splice(k, 1);
            retirar(veh);
          }
        }
      }
    }

    const siguenEsperando = [];
    for (const veh of pendientes) {
      if (veh.ruta.every(igual)) { siguenEsperando.push(veh); continue; }
      const nueva = rutaPara(veh, veh.origen);
      if (nueva && nueva.arcos.length) {
        veh.ruta = nueva.arcos;
        siguenEsperando.push(veh);
      } else {
        metricas.viajeImposible();
      }
    }
    pendientes.length = 0;
    pendientes.push(...siguenEsperando);
  }

  function configurarRestriccion(activa) {
    restriccion = Boolean(activa);
    for (const veh of vivos) if (veh.restringible) veh.proximoReruteo = t;
  }

  function paso() {
    if (demanda) for (const viaje of demanda.generar(t, dt)) agregarVehiculo(viaje);
    intentarInsertar();
    calcularAceleraciones();
    mover();
    transferir();
    if (pasos % 2 === 0) cambiosDeCarril();
    liberarBloqueados();
    if (pasos % 4 === 0) {
      reRutear();
      marcarEsperas();
    }
    t += dt;
    pasos += 1;
    if (pasos % Math.round(1 / dt) === 0) metricas.muestra({ t, enRed: vivos.size, enCola: contarEnCola() });
  }

  return {
    get t() { return t; },
    get restriccion() { return restriccion; },
    configurarRestriccion,
    aplicarRed,
    dt,
    paso,
    avanzar(segundos) {
      const n = Math.round(segundos / dt);
      for (let k = 0; k < n; k++) paso();
    },
    agregarVehiculo,
    vehiculos: () => [...vivos],
    posiciones() {
      const datos = new Float64Array(vivos.size * 3);
      let j = 0;
      for (const veh of vivos) {
        const e = estadoArco.get(veh.ruta[veh.i]);
        const n = e.carriles.length;
        const lateral = e.via.sentido === 'ambos'
          ? (veh.carril + 0.5) * ANCHO_CARRIL
          : (veh.carril - (n - 1) / 2) * ANCHO_CARRIL;
        const [lon, lat] = posicionEnArco(e.geo, veh.s - veh.perfil.largo / 2, lateral);
        datos[j++] = lon;
        datos[j++] = lat;
        datos[j++] = veh.tipoIndice;
      }
      return { cantidad: vivos.size, datos };
    },
    estadoVias,
    usoVias: () => new Map(usoVias),
    configurarDemanda: (parcial) => demanda?.configurar(parcial),
    resumen() {
      const cuellos = estadoVias()
        .filter((x) => x.vehiculos >= 3)
        .sort((a, b) => a.ratio - b.ratio)
        .slice(0, 5)
        .map((x) => {
          const via = red.vias.get(x.viaId);
          return { ...x, nombre: via.nombrePuente ?? (via.nombre || '(vía sin nombre)') };
        });
      return {
        t,
        ...metricas.resumen(t),
        enRed: vivos.size,
        enCola: contarEnCola(),
        pendientes: pendientes.length,
        avisos: puntos.avisos,
        cuellos,
      };
    },
  };
}
