import { ETIQUETA_TIPO } from '../../sim/tipos.js';

const SUPERFICIE = { pavimento: 'Pavimento', adoquin: 'Adoquín', destapado: 'Destapada' };
const ESTADO = { bueno: 'Bueno', regular: 'Regular', huecos: 'Con huecos' };

export default function FichaVia({ via, onCerrar }) {
  const filas = [
    ['Tipo', ETIQUETA_TIPO[via.tipo]],
    ['Sentido', via.sentido === 'ambos' ? 'Doble' : 'Único'],
    ['Carriles por sentido', via.carrilesPorSentido],
    ['Superficie', SUPERFICIE[via.superficie]],
    ['Estado', ESTADO[via.estado]],
    ['Velocidad máxima', `${via.velocidadMax} km/h`],
    ['Longitud', `${via.longitud} m`],
    ['Puente', via.esPuente ? 'Sí' : 'No'],
    ['En construcción', via.enConstruccion ? 'Sí' : 'No'],
  ];

  return (
    <section className="panel ficha">
      <header>
        <div>
          <h2>{via.nombrePuente ?? (via.nombre || '(vía sin nombre)')}</h2>
          {via.nombrePuente && via.nombre && <p className="subtitulo">En OSM: {via.nombre}</p>}
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar ficha">×</button>
      </header>
      <dl>
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      <a href={`https://www.openstreetmap.org/way/${via.osmId}`} target="_blank" rel="noreferrer">
        Ver en OpenStreetMap
      </a>
      <p className="nota">La edición de vías llega en la etapa 3.</p>
    </section>
  );
}
