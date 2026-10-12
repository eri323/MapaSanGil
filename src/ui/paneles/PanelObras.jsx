export default function PanelObras({
  datos, variante, restriccion, onRestriccion, onCambio, onIniciarDibujo, onTerminarVariante,
  historial, puedeDeshacer, puedeRehacer, onDeshacer, onRehacer, onDescartar,
}) {
  const todas = (tipo) => {
    const vias = datos.vias.filter((v) => v.tipo === tipo);
    return vias.length > 0 && vias.every((v) => v.dobleCalzada);
  };
  const dobleCalzada = (alcance, nombre) => (e) => onCambio(
    { tipo: 'dobleCalzada', alcance, activa: e.target.checked },
    `Doble calzada en ${nombre}: ${e.target.checked ? 'sí' : 'no'}`,
  );
  const recientes = historial.entradas.slice(0, historial.indice).slice(-6).reverse();

  return (
    <section className="panel obras">
      <h2>Obras y cambios</h2>
      <div className="acciones">
        <button type="button" onClick={() => onIniciarDibujo('calle')}>＋ Vía o puente nuevo</button>
        <button type="button" onClick={() => onIniciarDibujo('variante')}>Trazar tramo de la Variante</button>
      </div>
      <button
        type="button"
        className="principal ancho"
        disabled={variante.enObra.length === 0}
        onClick={onTerminarVariante}
      >
        Terminar la Variante
      </button>
      <p className={variante.conecta ? 'nota' : 'aviso'}>{variante.mensaje}</p>

      <label className="opcion">
        <input type="checkbox" checked={restriccion} onChange={(e) => onRestriccion(e.target.checked)} />
        Restringir pesados de paso en el centro
      </label>
      <label className="opcion">
        <input type="checkbox" checked={todas('avenida_nacional')} onChange={dobleCalzada('avenida_nacional', 'la Avenida')} />
        Doble calzada en la Avenida Nacional
      </label>
      <label className="opcion">
        <input type="checkbox" checked={todas('variante')} onChange={dobleCalzada('variante', 'la Variante')} />
        Doble calzada en la Variante
      </label>

      <h3>Cambios ({historial.indice})</h3>
      <div className="acciones">
        <button type="button" disabled={!puedeDeshacer} onClick={onDeshacer} title="Ctrl+Z">↶ Deshacer</button>
        <button type="button" disabled={!puedeRehacer} onClick={onRehacer} title="Ctrl+Y">↷ Rehacer</button>
        <button type="button" disabled={historial.entradas.length === 0} onClick={onDescartar}>Descartar todo</button>
      </div>
      {recientes.length > 0 && (
        <ol className="historial">
          {recientes.map((e, i) => <li key={`${historial.indice - i}`}>{e.descripcion}</li>)}
        </ol>
      )}
      <p className="nota">Clic en una vía o en un cruce para editarlo.</p>
    </section>
  );
}
