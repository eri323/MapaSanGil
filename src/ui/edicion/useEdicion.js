import { useCallback, useEffect, useMemo, useState } from 'react';
import { aplicarCambio, aplicarCambios } from '../../escenarios/cambios.js';
import { evaluarImpacto } from '../../escenarios/impacto.js';
import {
  HISTORIAL_VACIO, agregar, deshacer as deshacerH, rehacer as rehacerH,
  activos, puedeDeshacer, puedeRehacer, serializar, deserializar,
} from '../../escenarios/historial.js';
import { ZONAS, SALIDAS } from '../../escenarios/zonas.js';

const CLAVE = 'mapa-sangil:cambios';

// Recupera el historial guardado en el navegador si todavía se puede aplicar.
function leerGuardado(base) {
  try {
    const h = deserializar(localStorage.getItem(CLAVE));
    if (!h) return HISTORIAL_VACIO;
    aplicarCambios(base, activos(h));
    return h;
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
    confirmar: () => {
      if (pendiente) setHistorial((h) => agregar(h, pendiente.entrada));
      setPendiente(null);
    },
    cancelar: () => setPendiente(null),
    deshacer: () => setHistorial(deshacerH),
    rehacer: () => setHistorial(rehacerH),
    puedeDeshacer: puedeDeshacer(historial),
    puedeRehacer: puedeRehacer(historial),
    descartarTodo: () => setHistorial(HISTORIAL_VACIO),
    error,
    mostrarError: setError,
    limpiarError: () => setError(null),
  };
}
