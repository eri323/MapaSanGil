import { formatearHora } from '../formato.js';

const VELOCIDADES = [1, 5, 20, 'max'];

export default function BarraTiempo({ t, horaInicio, corriendo, velocidad, onAlternar, onVelocidad }) {
  return (
    <div className="tiempo">
      <button type="button" className="principal" onClick={onAlternar}>
        {corriendo ? '⏸ Pausa' : '▶ Simular'}
      </button>
      <span className="reloj" aria-label="Hora simulada">{formatearHora(horaInicio, t)}</span>
      <div className="velocidades" role="group" aria-label="Velocidad de simulación">
        {VELOCIDADES.map((v) => (
          <button
            key={v}
            type="button"
            className={v === velocidad ? 'activa' : ''}
            onClick={() => onVelocidad(v)}
          >
            {v === 'max' ? 'Máx' : `×${v}`}
          </button>
        ))}
      </div>
    </div>
  );
}
