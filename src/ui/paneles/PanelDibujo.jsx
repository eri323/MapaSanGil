import { cruzaRio } from '../edicion/dibujo.js';

const QUE_ES = { nodo: 'un cruce existente', via: 'la mitad de una vía (se parte en dos)', libre: 'un punto suelto' };

export default function PanelDibujo({ dibujo, rios, onAtributos, onQuitarUltimo, onTerminar, onCancelar }) {
  const { puntos, atributos } = dibujo;
  const esPuente = cruzaRio(dibujo, rios);
  return (
    <section className="panel dibujo">
      <h2>{dibujo.preset === 'variante' ? 'Tramo de la Variante' : 'Vía o puente nuevo'}</h2>
      <p className="nota">
        Haz clic en el mapa para marcar el trazado. El primer y el último punto se pegan al cruce o a la vía más cercana.
      </p>
      <p>
        {puntos.length} punto(s)
        {puntos.length > 0 && <> · empieza en {QUE_ES[puntos[0].ajuste.tipo]}</>}
        {puntos.length > 1 && <> · termina en {QUE_ES[puntos.at(-1).ajuste.tipo]}</>}
      </p>
      {esPuente && <p className="aviso">Cruza el río: será un puente.</p>}
      <div className="campos">
        <label>
          <span>Nombre</span>
          <input type="text" value={atributos.nombre} onChange={(e) => onAtributos({ nombre: e.target.value })} />
        </label>
        <label>
          <span>Sentido</span>
          <select value={atributos.sentido} onChange={(e) => onAtributos({ sentido: e.target.value })}>
            <option value="ambos">Doble sentido</option>
            <option value="adelante">Un sentido (del primer al último punto)</option>
          </select>
        </label>
        <label>
          <span>Velocidad máxima</span>
          <select value={atributos.velocidadMax} onChange={(e) => onAtributos({ velocidadMax: Number(e.target.value) })}>
            {[20, 30, 40, 50, 60, 80].map((x) => <option key={x} value={x}>{x} km/h</option>)}
          </select>
        </label>
        <label>
          <span>Carriles por sentido</span>
          <select value={atributos.carrilesPorSentido} onChange={(e) => onAtributos({ carrilesPorSentido: Number(e.target.value) })}>
            {[1, 2].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <div className="acciones">
        <button type="button" className="principal" disabled={puntos.length < 2} onClick={onTerminar}>Crear vía</button>
        <button type="button" disabled={puntos.length === 0} onClick={onQuitarUltimo}>Quitar último punto</button>
        <button type="button" onClick={onCancelar}>Cancelar (Esc)</button>
      </div>
    </section>
  );
}
