export default function PanelHistoria({ historias, onEmpezar }) {
  return (
    <section className="panel historia">
      <h2>Modo historia</h2>
      <p className="nota">
        Cada paso aplica sus cambios sobre la simulación en curso. Avanza con ▶ o con las flechas del teclado.
      </p>
      <ul className="lista-escenarios">
        {historias.map((h) => (
          <li key={h.nombre}>
            <div>
              <strong>{h.nombre}</strong>
              <span>{h.pasos.map((p) => p.titulo).join(' → ')}</span>
            </div>
            <div className="acciones">
              <button type="button" className="principal" onClick={() => onEmpezar(h)}>Empezar</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
