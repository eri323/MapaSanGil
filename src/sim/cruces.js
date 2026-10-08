// Reglas de paso en los cruces de San Gil: pares, prioridad por jerarquía,
// glorietas y la regla de la derecha donde no hay señal. El semáforo existe
// solo como intervención que el usuario puede agregar.

import { JERARQUIA } from './tipos.js';
import { direccionLlegada } from './geometriaArcos.js';

export const CICLO_SEMAFORO = { verde: 25, todoRojo: 4 };
export const ESPERA_CORTESIA = 20; // s detenido en la línea antes de pasar por cortesía

const viaDe = (red, arcoId) => red.vias.get(red.arcos.get(arcoId).viaId);

// b viene por la derecha de a cuando circula de derecha a izquierda frente a a.
const vieneDeLaDerecha = ([ax, ay], [bx, by]) => ax * by - ay * bx > 0.3;

function tipoDeAcceso(red, nodo, arcoId, entrantes) {
  if (entrantes.length <= 1) return 'prioridad';
  if (nodo.control === 'semaforo') return 'semaforo';

  const via = viaDe(red, arcoId);
  if (entrantes.some((id) => viaDe(red, id).tipo === 'glorieta')) {
    return via.tipo === 'glorieta' ? 'prioridad' : 'cede';
  }

  const jerarquias = entrantes.map((id) => JERARQUIA[viaDe(red, id).tipo]);
  const maxima = Math.max(...jerarquias);
  const todasIguales = jerarquias.every((j) => j === maxima);
  const propia = JERARQUIA[via.tipo];

  if (nodo.control === 'pare') {
    if (nodo.accesosConPare?.length) return nodo.accesosConPare.includes(via.id) ? 'pare' : 'prioridad';
    return todasIguales || propia < maxima ? 'pare' : 'prioridad';
  }
  if (nodo.control === 'prioridad' && !todasIguales) return propia < maxima ? 'cede' : 'prioridad';
  return 'derecha';
}

export function analizarAccesos(red, geometria) {
  const accesos = new Map();
  for (const nodo of red.nodos.values()) {
    const entrantes = red.entrantes.get(nodo.id) ?? [];
    if (!entrantes.length) continue;
    const tipos = new Map(entrantes.map((id) => [id, tipoDeAcceso(red, nodo, id, entrantes)]));
    const direcciones = new Map(entrantes.map((id) => [id, direccionLlegada(geometria.get(id))]));
    const referencia = direcciones.get(entrantes[0]);
    const hayPrioridad = [...tipos.values()].includes('prioridad');

    for (const id of entrantes) {
      const tipo = tipos.get(id);
      const propia = direcciones.get(id);
      const deLaDerecha = () => entrantes.filter((otro) => otro !== id && vieneDeLaDerecha(propia, direcciones.get(otro)));
      let conflictos = [];
      if (tipo === 'cede' || tipo === 'pare') {
        conflictos = hayPrioridad ? entrantes.filter((otro) => tipos.get(otro) === 'prioridad') : deLaDerecha();
      } else if (tipo === 'derecha') {
        conflictos = deLaDerecha();
      }
      const paralelo = Math.abs(propia[0] * referencia[0] + propia[1] * referencia[1]) > 0.7;
      accesos.set(id, { tipo, conflictos, grupo: paralelo ? 0 : 1, nodo: nodo.id });
    }
  }
  return accesos;
}

export function semaforoEnVerde(acceso, t, ciclo = CICLO_SEMAFORO) {
  const periodo = 2 * (ciclo.verde + ciclo.todoRojo);
  const fase = ((t % periodo) + periodo) % periodo;
  const inicio = acceso.grupo === 0 ? 0 : ciclo.verde + ciclo.todoRojo;
  return fase >= inicio && fase < inicio + ciclo.verde;
}

export function puedeEntrar({ acceso, vehiculo, t, ocupadoHasta, llegadas }) {
  if (acceso.tipo === 'prioridad') return true;
  if (acceso.tipo === 'semaforo') return semaforoEnVerde(acceso, t);
  if (acceso.tipo === 'pare' && !vehiculo.paroEnPare) return false;
  if (t < ocupadoHasta) return false;
  if (vehiculo.esperaCruce > ESPERA_CORTESIA) return true;
  return acceso.conflictos.every((arcoId) => llegadas(arcoId) >= vehiculo.perfil.hueco);
}
