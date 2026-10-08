import { useState } from 'react';

const DURACIONES = [[900, '15 min'], [1800, '30 min'], [3600, '1 hora']];
const SEMILLAS = [[1, '1 (rápido)'], [3, '3 (recomendado)'], [5, '5 (más confiable)']];

export default function PanelComparador({ escenarios, progreso, corriendo, onComparar, onCancelar }) {
  const [elegidos, setElegidos] = useState(() => escenarios.slice(0, 2).map((e) => e.nombre));
  const [duracion, setDuracion] = useState(1800);
  const [semillas, setSemillas] = useState(3);
  const alternar = (nombre) => setElegidos((l) => (l.includes(nombre) ? l.filter((x) => x !== nombre) : [...l, nombre]));

  return (
    <section className="panel comparador">
      <h2>Comparar escenarios</h2>
      <p className="nota">El primero que marques es la referencia. Todos corren con la misma duración y las mismas semillas, sin dibujar.</p>
      <fieldset className="campos">
        <legend>Escenarios</legend>
        {escenarios.map((e) => (
          <label key={e.nombre} className="opcion">
            <input type="checkbox" checked={elegidos.includes(e.nombre)} onChange={() => alternar(e.nombre)} />
            {e.nombre}
            {elegidos[0] === e.nombre && <em className="referencia"> (referencia)</em>}
          </label>
        ))}
      </fieldset>
      <div className="campos">
        <label>
          <span>Duración simulada</span>
          <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))}>
            {DURACIONES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label>
          <span>Repeticiones con semillas distintas</span>
          <select value={semillas} onChange={(e) => setSemillas(Number(e.target.value))}>
            {SEMILLAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      </div>
      {corriendo ? (
        <div className="progreso">
          <progress max={progreso.total || 1} value={progreso.hechos} />
          <span>{progreso.hechos} de {progreso.total} corridas</span>
          <button type="button" onClick={onCancelar}>Cancelar</button>
        </div>
      ) : (
        <button
          type="button"
          className="principal ancho"
          disabled={elegidos.length < 2}
          onClick={() => onComparar(
            elegidos.map((n) => escenarios.find((e) => e.nombre === n)),
            { duracion, semillas: Array.from({ length: semillas }, (_, i) => i + 1) },
          )}
        >
          Comparar ({elegidos.length})
        </button>
      )}
    </section>
  );
}
