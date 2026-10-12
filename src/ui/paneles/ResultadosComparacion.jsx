import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { METRICAS_COMPARADAS, variacion } from '../../escenarios/comparar.js';
import { ETIQUETA_METRICA, formatearMetrica, formatearVariacion } from '../formato.js';

const COLORES = ['#1f6feb', '#d6453f', '#2ea043', '#8e44ad', '#e67e22', '#16a085'];

export default function ResultadosComparacion({ comparacion, red, onCerrar, onVerDiferencias, diferenciasDe }) {
  const { resultados, duracion, semillas } = comparacion;
  const [referencia] = resultados;
  const datosGrafica = referencia.serie.map((p, i) => {
    const fila = { minuto: Math.round(p.t / 60) };
    for (const r of resultados) {
      const v = r.serie[i]?.demoraReciente;
      fila[r.nombre] = Number.isFinite(v) ? Math.round(v) : null;
    }
    return fila;
  });

  return (
    <section className="panel resultados">
      <header>
        <div>
          <h2>Comparación</h2>
          <p className="subtitulo">{Math.round(duracion / 60)} min simulados · {semillas.length} semilla(s) · promedio (mínimo–máximo)</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar resultados">×</button>
      </header>

      <div className="tabla-scroll">
        <table>
          <thead>
            <tr>
              <th />
              {resultados.map((r, i) => <th key={r.nombre}>{r.nombre}{i === 0 && <em> (ref.)</em>}</th>)}
            </tr>
          </thead>
          <tbody>
            {METRICAS_COMPARADAS.map((m) => (
              <tr key={m}>
                <th>{ETIQUETA_METRICA[m]}</th>
                {resultados.map((r, i) => (
                  <td key={r.nombre}>
                    {formatearMetrica(m, r.metricas[m].media)}
                    <small> ({formatearMetrica(m, r.metricas[m].min)}–{formatearMetrica(m, r.metricas[m].max)})</small>
                    {i > 0 && <span className="variacion">{formatearVariacion(variacion(referencia, r, m))}</span>}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th>Pasos por puentes</th>
              {resultados.map((r) => <td key={r.nombre}>{r.usoClave?.puentes ?? '—'}</td>)}
            </tr>
            <tr>
              <th>Pasos por la Variante</th>
              {resultados.map((r) => <td key={r.nombre}>{r.usoClave?.variante ?? '—'}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      <h3>Demora de los últimos 10 min a lo largo de la corrida</h3>
      <div className="grafica">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={datosGrafica} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="minuto" unit=" min" fontSize={11} />
            <YAxis unit=" s" fontSize={11} width={52} />
            <Tooltip formatter={(v) => `${v} s`} labelFormatter={(m) => `Minuto ${m}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {resultados.map((r, i) => (
              <Line key={r.nombre} type="monotone" dataKey={r.nombre} stroke={COLORES[i % COLORES.length]} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="acciones">
        {resultados.slice(1).map((r) => (
          <button key={r.nombre} type="button" className={diferenciasDe === r.nombre ? 'activa' : ''} onClick={() => onVerDiferencias(r.nombre)}>
            Mapa: {r.nombre} vs. {referencia.nombre}
          </button>
        ))}
        {diferenciasDe && <button type="button" onClick={() => onVerDiferencias(null)}>Quitar mapa de diferencias</button>}
      </div>
      <p className="nota">Sin aforos reales, estos números sirven para comparar escenarios entre sí, no como pronóstico.</p>
    </section>
  );
}
