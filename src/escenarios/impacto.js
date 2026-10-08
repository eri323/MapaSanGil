// ¿Qué deja desconectado un cambio? Se compara el grupo de cruces que se
// conectan ida y vuelta antes y después, y se revisan zonas y salidas.

import { crearRed, componentePrincipal } from '../sim/red.js';
import { prepararPuntos } from '../sim/demanda.js';

export const UMBRAL_PERDIDOS = 20; // cruces que pueden quedar sin ida y vuelta sin preguntar

export function evaluarImpacto(datosAntes, datosDespues, zonas, salidas) {
  const antes = crearRed(datosAntes);
  const despues = crearRed(datosDespues);
  const principalAntes = componentePrincipal(antes);
  const principalDespues = componentePrincipal(despues);
  const puntos = prepararPuntos(antes, zonas, salidas);
  const lugares = [...Object.values(puntos.zonas), ...Object.values(puntos.salidas)];
  const aisladas = lugares.filter((l) => !principalDespues.has(l.nodo)).map((l) => l.nombre);
  const perdidos = [...principalAntes].filter((id) => !principalDespues.has(id)).length;
  return { aisladas, perdidos, requiereConfirmacion: aisladas.length > 0 || perdidos > UMBRAL_PERDIDOS };
}
