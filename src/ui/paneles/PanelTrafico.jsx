const HORAS = Array.from({ length: 24 }, (_, h) => h);

export default function PanelTrafico({ config, onCambiar, colorPor, onColorPor, onReiniciar }) {
  return (
    <section className="panel controles">
      <h2>Tráfico</h2>
      <label>
        <span>Cantidad de vehículos: <strong>{Math.round(config.factor * 100)} %</strong></span>
        <input
          type="range" min="0" max="2" step="0.1" value={config.factor}
          onChange={(e) => onCambiar({ factor: Number(e.target.value) })}
        />
      </label>
      <label>
        <span>Temporada</span>
        <select value={config.temporada} onChange={(e) => onCambiar({ temporada: Number(e.target.value) })}>
          <option value={1}>Normal</option>
          <option value={1.4}>Alta (festivos, turismo) ×1,4</option>
        </select>
      </label>
      <label>
        <span>Hora de inicio</span>
        <select value={config.horaInicio} onChange={(e) => onCambiar({ horaInicio: Number(e.target.value) })}>
          {HORAS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
        </select>
      </label>
      <p className="nota">Cambiar la hora de inicio reinicia la simulación.</p>
      <fieldset>
        <legend>Colorear vías por</legend>
        <label className="opcion">
          <input type="radio" name="colorPor" checked={colorPor === 'tipo'} onChange={() => onColorPor('tipo')} />
          Tipo de vía
        </label>
        <label className="opcion">
          <input type="radio" name="colorPor" checked={colorPor === 'congestion'} onChange={() => onColorPor('congestion')} />
          Congestión
        </label>
      </fieldset>
      <button type="button" onClick={onReiniciar}>Reiniciar simulación</button>
    </section>
  );
}
