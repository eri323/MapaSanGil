import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatearDuracion } from '../formato.js';

// La gráfica muestra resultados controlados (misma duración y semillas para cada
// paso, calculados en segundo plano): en vivo, la demora sube con el tiempo
// mientras la red se llena y llega la hora pico, y no mostraría el efecto de
// cada cambio.
export default function BarraHistoria({ historia, indice, controlado, progreso, demoraAhora, onAnterior, onSiguiente, onSalir }) {
  const paso = historia.pasos[indice];
  const datos = historia.pasos.map((p, i) => ({
    paso: i + 1,
    titulo: p.titulo,
    demora: controlado ? Math.round(controlado.resultados[i]?.metricas.demoraMedia.media ?? 0) : 0,
  }));

  return (
    <section className="barra-historia" aria-live="polite">
      <div className="historia-texto">
        <span className="historia-paso">Paso {indice + 1} de {historia.pasos.length}</span>
        <h2>{paso.titulo}</h2>
        <p>{paso.nota}</p>
        <div className="acciones">
          <button type="button" onClick={onAnterior} disabled={indice === 0}>◀ Anterior</button>
          <button type="button" className="principal" onClick={onSiguiente} disabled={indice === historia.pasos.length - 1}>Siguiente ▶</button>
          <button type="button" onClick={onSalir}>Salir</button>
        </div>
        {Number.isFinite(demoraAhora) && <p className="nota">En vivo, demora de los últimos 10 min: {formatearDuracion(demoraAhora)}</p>}
      </div>
      <div className="historia-grafica">
        {controlado ? (
          <>
            <span>Demora media por paso ({Math.round(controlado.duracion / 60)} min simulados, {controlado.semillas.length} semillas)</span>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={datos} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="paso" fontSize={11} />
                <YAxis unit=" s" fontSize={11} width={44} />
                <Tooltip formatter={(v) => formatearDuracion(v)} labelFormatter={(p) => datos[p - 1]?.titulo} />
                <Bar dataKey="demora">
                  {datos.map((d, i) => <Cell key={d.paso} fill={i === indice ? '#1f6feb' : '#9aa5b1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div className="progreso">
            <span>Calculando la comparación controlada de los pasos…</span>
            <progress max={progreso.total || 1} value={progreso.hechos} />
            <span>{progreso.hechos} de {progreso.total} corridas</span>
          </div>
        )}
      </div>
    </section>
  );
}
