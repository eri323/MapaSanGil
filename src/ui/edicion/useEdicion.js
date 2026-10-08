import { useCallback, useEffect, useMemo, useState } from 'react';
import { aplicarCambio, aplicarCambios } from '../../escenarios/cambios.js';
import { evaluarImpacto } from '../../escenarios/impacto.js';
import {
  HISTORIAL_VACIO, agregar, deshacer as deshacerH, rehacer as rehacerH,
  activos, puedeDeshacer, puedeRehacer, serializar, recuperarHistorial, agregarValidado, historialDesdeEntradas,
} from '../../escenarios/historial.js';
import { ZONAS, SALIDAS } from '../../escenarios/zonas.js';

const CLAVE = 'mapa-sangil:cambios';

// Recupera el historial guardado en el navegador, solo la parte que todavía aplica.
function leerGuardado(base) {
  try {
    return recuperarHistorial(base, localStorage.getItem(CLAVE));
  } catch {
    return HISTORIAL_VACIO;
  }
}

export function useEdicion(base) {
  const [historial, setHistorial] = useState(HISTORIAL_VACIO);
  const [cargado, setCargado] = useState(false);
  const [pendiente, setPendiente] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (base && !cargado) {
      setHistorial(leerGuardado(base));
      setCargado(true);
    }
  }, [base, cargado]);

  useEffect(() => {
    if (!cargado) return;
    try { localStorage.setItem(CLAVE, serializar(historial)); } catch { /* el navegador no deja guardar */ }
  }, [historial, cargado]);

  const datos = useMemo(
    () => (base && cargado ? aplicarCambios(base, activos(historial)) : null),
    [base, cargado, historial],
  );

  const aplicar = useCallback((cambio, descripcion) => {
    setError(null);
    try {
      const despues = aplicarCambio(datos, cambio);
      const impacto = evaluarImpacto(datos, despues, ZONAS, SALIDAS);
      const entrada = { cambio, descripcion };
      if (impacto.requiereConfirmacion) setPendiente({ entrada, impacto });
      else setHistorial((h) => agregar(h, entrada));
    } catch (err) {
      setError(err.message);
    }
  }, [datos]);

  return {
    datos,
    historial,
    aplicar,
    pendiente,
    // El cambio se evaluó contra el historial de ese momento: se vuelve a validar.
    confirmar: () => {
      if (pendiente) {
        try {
          setHistorial(agregarValidado(base, historial, pendiente.entrada));
        } catch (err) {
          setError(`No se pudo aplicar: ${err.message}`);
        }
      }
      setPendiente(null);
    },
    cancelar: () => setPendiente(null),
    deshacer: () => setHistorial(deshacerH),
    rehacer: () => setHistorial(rehacerH),
    puedeDeshacer: puedeDeshacer(historial),
    puedeRehacer: puedeRehacer(historial),
    descartarTodo: () => setHistorial(HISTORIAL_VACIO),
    cargar: (entradas) => {
      try {
        setHistorial(historialDesdeEntradas(base, entradas));
        setError(null);
        return true;
      } catch (err) {
        setError(`No se pudo cargar el escenario: ${err.message}`);
        return false;
      }
    },
    error,
    mostrarError: setError,
    limpiarError: () => setError(null),
  };
}
