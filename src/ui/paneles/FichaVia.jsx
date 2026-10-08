import {
  ETIQUETA_TIPO, ESTADOS, SUPERFICIES, ETIQUETA_ESTADO, ETIQUETA_SUPERFICIE,
} from '../../sim/tipos.js';

const VELOCIDADES = [10, 20, 30, 40, 50, 60, 80];

export default function FichaVia({ via, onCambio, onCerrar }) {
  const nombre = via.nombrePuente ?? (via.nombre || '(vía sin nombre)');
  const cambiar = (propiedades, descripcion) => onCambio({ tipo: 'via', viaId: via.id, propiedades }, `${nombre}: ${descripcion}`);
  const velocidades = VELOCIDADES.includes(via.velocidadMax) ? VELOCIDADES : [...VELOCIDADES, via.velocidadMax].sort((a, b) => a - b);

  return (
    <section className="panel ficha">
      <header>
        <div>
          <h2>{nombre}</h2>
          <p className="subtitulo">
            {ETIQUETA_TIPO[via.tipo]} · {via.longitud} m{via.esPuente ? ' · puente' : ''}
            {via.dobleCalzada ? ' · doble calzada' : ''}
          </p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar ficha">×</button>
      </header>

      <div className="acciones">
        <button type="button" onClick={() => cambiar({ abierta: !via.abierta }, via.abierta ? 'cerrada' : 'abierta')}>
          {via.abierta ? 'Cerrar vía' : 'Abrir vía'}
        </button>
        {via.enConstruccion && (
          <button type="button" className="principal" onClick={() => onCambio({ tipo: 'terminarObra', viaIds: [via.id] }, `${nombre}: obra terminada`)}>
            Terminar obra
          </button>
        )}
      </div>
      {!via.abierta && <p className="aviso">Cerrada: ningún vehículo pasa por aquí.</p>}
      {via.enConstruccion && <p className="aviso">En construcción: todavía no se puede usar.</p>}

      <div className="campos">
        <label>
          <span>Sentido</span>
          <select value={via.sentido} onChange={(e) => cambiar({ sentido: e.target.value }, e.target.value === 'ambos' ? 'doble sentido' : 'un sentido')}>
            <option value="ambos">Doble sentido</option>
            <option value="adelante">Un sentido</option>
          </select>
        </label>
        {via.sentido === 'adelante' && (
          <button type="button" onClick={() => onCambio({ tipo: 'invertirVia', viaId: via.id }, `${nombre}: sentido invertido`)}>
            ⇄ Invertir sentido
          </button>
        )}
        <label>
          <span>Estado</span>
          <select value={via.estado} onChange={(e) => cambiar({ estado: e.target.value }, `estado ${ETIQUETA_ESTADO[e.target.value].toLowerCase()}`)}>
            {ESTADOS.map((x) => <option key={x} value={x}>{ETIQUETA_ESTADO[x]}</option>)}
          </select>
        </label>
        <label>
          <span>Superficie</span>
          <select value={via.superficie} onChange={(e) => cambiar({ superficie: e.target.value }, ETIQUETA_SUPERFICIE[e.target.value].toLowerCase())}>
            {SUPERFICIES.map((x) => <option key={x} value={x}>{ETIQUETA_SUPERFICIE[x]}</option>)}
          </select>
        </label>
        <label>
          <span>Velocidad máxima</span>
          <select value={via.velocidadMax} onChange={(e) => cambiar({ velocidadMax: Number(e.target.value) }, `${e.target.value} km/h`)}>
            {velocidades.map((x) => <option key={x} value={x}>{x} km/h</option>)}
          </select>
        </label>
        <label>
          <span>Carriles por sentido</span>
          <select value={via.carrilesPorSentido} onChange={(e) => cambiar({ carrilesPorSentido: Number(e.target.value) }, `${e.target.value} carril(es) por sentido`)}>
            {[1, 2, 3].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>

      {via.osmId && (
        <a href={`https://www.openstreetmap.org/way/${via.osmId}`} target="_blank" rel="noreferrer">Ver en OpenStreetMap</a>
      )}
    </section>
  );
}
