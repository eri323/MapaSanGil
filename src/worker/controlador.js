// Lógica del worker de simulación, separada de `self` para poder probarla.
// Recibe órdenes de la interfaz, avanza el motor en ticks y envía posiciones
// y métricas.

import { crearRed } from '../sim/red.js';
import { crearMotor } from '../sim/motor.js';

export function crearReloj() {
  let acumulado = 0;
  return {
    pasos(velocidad, ms, dt) {
      if (velocidad === 'max') return Infinity;
      acumulado += (velocidad * ms) / 1000;
      const n = Math.floor(acumulado / dt + 1e-9);
      acumulado -= n * dt;
      return n;
    },
    reiniciar() { acumulado = 0; },
  };
}

export function crearControlador(enviar, { ahora = () => performance.now(), presupuestoMs = 35 } = {}) {
  let motor = null;
  let corriendo = false;
  let velocidad = 1;
  let ultimoResumen = -Infinity;
  const reloj = crearReloj();

  function enviarCuadro() {
    const { cantidad, datos } = motor.posiciones();
    enviar({ tipo: 'cuadro', t: motor.t, cantidad, datos }, [datos.buffer]);
  }

  function enviarResumen() {
    enviar({ tipo: 'resumen', resumen: motor.resumen(), vias: motor.estadoVias() });
    ultimoResumen = ahora();
  }

  return {
    recibir(mensaje) {
      try {
        if (mensaje.tipo === 'iniciar') {
          motor = crearMotor(crearRed(mensaje.datosRed), mensaje.opciones);
          corriendo = false;
          reloj.reiniciar();
          enviarCuadro();
          enviarResumen();
        } else if (mensaje.tipo === 'reloj') {
          corriendo = Boolean(mensaje.corriendo);
          velocidad = mensaje.velocidad;
        } else if (mensaje.tipo === 'demanda') {
          motor?.configurarDemanda(mensaje.parcial);
        } else if (mensaje.tipo === 'restriccion') {
          motor?.configurarRestriccion(mensaje.activa);
        } else if (mensaje.tipo === 'red') {
          if (!motor) return;
          let nueva;
          try {
            nueva = crearRed(mensaje.datosRed);
          } catch (err) {
            enviar({ tipo: 'error', mensaje: err.message });
            return;
          }
          motor.aplicarRed(nueva);
          enviarCuadro();
          enviarResumen();
        }
      } catch (err) {
        motor = null;
        enviar({ tipo: 'error', mensaje: err.message });
      }
    },
    tick(ms) {
      if (!motor || !corriendo) return;
      const inicio = ahora();
      const n = reloj.pasos(velocidad, ms, motor.dt);
      for (let k = 0; k < n; k++) {
        motor.paso();
        if (ahora() - inicio > presupuestoMs) break;
      }
      enviarCuadro();
      if (ahora() - ultimoResumen >= 1000) enviarResumen();
    },
  };
}
