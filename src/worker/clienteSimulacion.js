// Lado de la interfaz: crea el worker y le envía órdenes.

export function crearClienteSimulacion(alRecibir) {
  const worker = new Worker(new URL('./simulacion.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => alRecibir(data);
  worker.onerror = (evento) => alRecibir({ tipo: 'error', mensaje: evento.message || 'Falló el worker de simulación' });

  return {
    iniciar: (datosRed, opciones) => worker.postMessage({ tipo: 'iniciar', datosRed, opciones }),
    reloj: (corriendo, velocidad) => worker.postMessage({ tipo: 'reloj', corriendo, velocidad }),
    demanda: (parcial) => worker.postMessage({ tipo: 'demanda', parcial }),
    red: (datosRed) => worker.postMessage({ tipo: 'red', datosRed }),
    restriccion: (activa) => worker.postMessage({ tipo: 'restriccion', activa }),
    terminar: () => worker.terminate(),
  };
}
