import { useRef, useState } from 'react';

export default function PanelEscenarios({ guardados, precargados, onGuardar, onCargar, onBorrar, onExportar, onImportar }) {
  const [nombre, setNombre] = useState('');
  const archivo = useRef(null);

  const fila = (e, borrable) => (
    <li key={e.nombre}>
      <div>
        <strong>{e.nombre}</strong>
        {e.descripcion && <span>{e.descripcion}</span>}
        <span>{e.entradas.length} cambio(s){e.demanda.temporada !== 1 ? ` · temporada ×${String(e.demanda.temporada).replace('.', ',')}` : ''}{e.restriccionPesados ? ' · restricción' : ''}</span>
      </div>
      <div className="acciones">
        <button type="button" onClick={() => onCargar(e)}>Cargar</button>
        <button type="button" onClick={() => onExportar(e)} title="Descargar como archivo">⬇</button>
        {borrable && <button type="button" onClick={() => onBorrar(e.nombre)} aria-label={`Borrar ${e.nombre}`}>✕</button>}
      </div>
    </li>
  );

  return (
    <section className="panel escenarios">
      <h2>Escenarios</h2>
      <form
        className="campos"
        onSubmit={(ev) => { ev.preventDefault(); if (nombre.trim()) { onGuardar(nombre.trim()); setNombre(''); } }}
      >
        <label>
          <span>Guardar el estado actual como…</span>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Variante + puente nuevo" />
        </label>
        <button type="submit" className="principal" disabled={!nombre.trim()}>Guardar escenario</button>
      </form>

      <h3>Mis escenarios</h3>
      {guardados.length ? <ul className="lista-escenarios">{guardados.map((e) => fila(e, true))}</ul> : <p className="nota">Todavía no has guardado ninguno.</p>}
      <button type="button" onClick={() => archivo.current?.click()}>Importar archivo…</button>
      <input
        ref={archivo}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onImportar(await f.text());
        }}
      />

      <h3>Precargados</h3>
      <ul className="lista-escenarios">{precargados.map((e) => fila(e, false))}</ul>
      <p className="nota">La Variante y el puente propuesto usan trazados aproximados: puedes cambiarlos en el editor y guardar tu versión.</p>
    </section>
  );
}
