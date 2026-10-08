import { filtrarPorId } from './comparador.js';

// Lado de la interfaz del comparador. Cancelar termina el worker (la
// comparación es un cálculo largo y síncrono) y deja uno nuevo listo.
export function crearClienteComparador(alRecibir) {
  let idVigente = 0;
  const recibir = filtrarPorId(() => idVigente, alRecibir);
  const nuevo = () => {
    const w = new Worker(new URL('./comparador.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }) => recibir(data);
    w.onerror = (e) => alRecibir({ tipo: 'error', id: idVigente, mensaje: e.message || 'Falló el comparador' });
    return w;
  };
  let worker = nuevo();

  return {
    comparar(base, escenarios, opciones) {
      idVigente += 1;
      worker.postMessage({ tipo: 'comparar', id: idVigente, base, escenarios, opciones });
      return idVigente;
    },
    cancelar() {
      idVigente += 1;
      worker.terminate();
      worker = nuevo();
    },
    terminar: () => worker.terminate(),
  };
}
