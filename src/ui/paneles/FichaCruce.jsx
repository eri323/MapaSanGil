import { CONTROLES, ETIQUETA_CONTROL } from '../../sim/tipos.js';

// Vías que llegan a este cruce, para marcar en cuáles hay pare.
function viasQueLlegan(red, nodoId) {
  const ids = new Set((red.entrantes.get(nodoId) ?? []).map((arcoId) => red.arcos.get(arcoId).viaId));
  return [...ids].map((id) => red.vias.get(id));
}

export default function FichaCruce({ nodo, red, onCambio, onCerrar }) {
  const llegan = viasQueLlegan(red, nodo.id);
  const conPare = new Set(nodo.accesosConPare ?? []);
  const fijar = (control, accesosConPare) => onCambio(
    { tipo: 'cruce', nodoId: nodo.id, control, ...(accesosConPare?.length && { accesosConPare }) },
    `Cruce: ${ETIQUETA_CONTROL[control].toLowerCase()}`,
  );
  const alternarPare = (viaId) => {
    const lista = conPare.has(viaId) ? [...conPare].filter((x) => x !== viaId) : [...conPare, viaId];
    fijar('pare', lista);
  };

  return (
    <section className="panel ficha">
      <header>
        <div>
          <h2>Cruce</h2>
          <p className="subtitulo">{llegan.length} vía(s) llegan aquí</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar ficha">×</button>
      </header>
      <fieldset className="campos">
        <legend>Control</legend>
        {CONTROLES.map((c) => (
          <label key={c} className="opcion">
            <input type="radio" name="control" checked={nodo.control === c} onChange={() => fijar(c)} />
            {ETIQUETA_CONTROL[c]}
          </label>
        ))}
      </fieldset>
      {nodo.control === 'pare' && (
        <fieldset className="campos">
          <legend>¿Quién tiene el pare?</legend>
          {llegan.map((v) => (
            <label key={v.id} className="opcion">
              <input type="checkbox" checked={conPare.has(v.id)} onChange={() => alternarPare(v.id)} />
              {v.nombrePuente ?? (v.nombre || '(vía sin nombre)')}
            </label>
          ))}
          <p className="nota">Sin ninguna marcada, el pare es para las vías de menor jerarquía.</p>
        </fieldset>
      )}
      {nodo.control === 'semaforo' && <p className="nota">Ciclo fijo: 25 s de verde por grupo y 4 s de todo rojo.</p>}
    </section>
  );
}
