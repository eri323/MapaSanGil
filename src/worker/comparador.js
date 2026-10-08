// Lógica del worker del comparador, separada de `self` para poder probarla.

import { compararEscenarios } from '../escenarios/comparar.js';

export function crearControladorComparador(enviar) {
  return {
    recibir(mensaje) {
      if (mensaje.tipo !== 'comparar') return;
      const { id } = mensaje;
      try {
        const resultado = compararEscenarios(mensaje.base, mensaje.escenarios, {
          ...mensaje.opciones,
          alProgreso: (hechos, total) => enviar({ tipo: 'progreso', id, hechos, total }),
        });
        enviar({ tipo: 'resultado', id, resultado });
      } catch (err) {
        enviar({ tipo: 'error', id, mensaje: err.message });
      }
    },
  };
}

// Descarta mensajes de pedidos viejos (por ejemplo, de una comparación cancelada).
export function filtrarPorId(idVigente, alRecibir) {
  return (mensaje) => {
    if (mensaje.id === idVigente()) alRecibir(mensaje);
  };
}
