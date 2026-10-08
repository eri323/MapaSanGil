import { TIPOS_VIA, ETIQUETA_TIPO } from '../../sim/tipos.js';
import { TIPOS_VEHICULO, ETIQUETA_VEHICULO } from '../../sim/vehiculos.js';
import {
  COLOR_TIPO, COLOR_PUENTE, COLOR_PARE, COLOR_CERRADA, COLOR_SEMAFORO,
} from '../mapa/estilosVia.js';
import { COLOR_VEHICULO, ESCALA_CONGESTION } from '../mapa/estilosVehiculo.js';

const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

export default function Leyenda({ colorPor }) {
  return (
    <section className="panel leyenda">
      <h2>{colorPor === 'congestion' ? 'Congestión' : 'Tipos de vía'}</h2>
      <ul>
        {colorPor === 'congestion'
          ? ESCALA_CONGESTION.map(({ etiqueta, color }) => (
            <li key={etiqueta}><span className="muestra-linea" style={{ background: rgb(color) }} />{etiqueta}</li>
          ))
          : TIPOS_VIA.map((tipo) => (
            <li key={tipo}><span className="muestra-linea" style={{ background: rgb(COLOR_TIPO[tipo]) }} />{ETIQUETA_TIPO[tipo]}</li>
          ))}
        <li><span className="muestra-linea doble" />Doble calzada</li>
        <li><span className="muestra-linea" style={{ background: rgb(COLOR_PUENTE) }} />Puente</li>
        <li><span className="muestra-linea punteada" />En construcción</li>
        <li><span className="muestra-linea punteada gris" style={{ '--color': rgb(COLOR_CERRADA) }} />Cerrada</li>
        <li><span className="muestra-punto" style={{ background: rgb(COLOR_PARE) }} />Pare</li>
        <li><span className="muestra-punto" style={{ background: rgb(COLOR_SEMAFORO) }} />Semáforo</li>
        <li><span className="muestra-flecha">▶</span>Sentido de circulación</li>
      </ul>
      <h3>Vehículos</h3>
      <ul>
        {TIPOS_VEHICULO.map((tipo) => (
          <li key={tipo}><span className="muestra-punto" style={{ background: rgb(COLOR_VEHICULO[tipo]) }} />{ETIQUETA_VEHICULO[tipo]}</li>
        ))}
      </ul>
    </section>
  );
}
