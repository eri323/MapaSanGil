import { TIPOS_VIA, ETIQUETA_TIPO } from '../../sim/tipos.js';
import { COLOR_TIPO, COLOR_PUENTE, COLOR_PARE } from '../mapa/estilosVia.js';

const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

export default function Leyenda() {
  return (
    <section className="panel leyenda">
      <h2>Tipos de vía</h2>
      <ul>
        {TIPOS_VIA.map((tipo) => (
          <li key={tipo}>
            <span className="muestra-linea" style={{ background: rgb(COLOR_TIPO[tipo]) }} />
            {ETIQUETA_TIPO[tipo]}
          </li>
        ))}
        <li>
          <span className="muestra-linea" style={{ background: rgb(COLOR_PUENTE) }} />
          Puente
        </li>
        <li>
          <span className="muestra-linea punteada" />
          En construcción
        </li>
        <li>
          <span className="muestra-punto" style={{ background: rgb(COLOR_PARE) }} />
          Pare
        </li>
        <li>
          <span className="muestra-flecha">▶</span>
          Sentido de circulación
        </li>
      </ul>
    </section>
  );
}
