import { formatearDuracion } from '../formato.js';

export default function PanelMetricas({ resumen, onSeleccionarVia }) {
  if (!resumen) return null;
  const filas = [
    ['Vehículos en la vía', resumen.enRed],
    ['Detenidos o en cola', resumen.enCola],
    ['Esperando para entrar', resumen.pendientes],
    ['Viajes completados', resumen.viajesCompletados],
    ['Tiempo medio de viaje', formatearDuracion(resumen.tiempoMedio)],
    ['Demora media', formatearDuracion(resumen.demoraMedia)],
    ['Bloqueos', resumen.bloqueos],
    ['Viajes imposibles', resumen.viajesImposibles],
  ];

  return (
    <section className="panel metricas">
      <h2>Métricas</h2>
      {resumen.t === 0 && <p className="nota">La simulación arranca en pausa: dale ▶ Simular.</p>}
      <dl>
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta}>
            <dt>{etiqueta}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
      {resumen.cuellos.length > 0 && (
        <>
          <h3>Cuellos de botella ahora</h3>
          <ol className="cuellos">
            {resumen.cuellos.map((c) => (
              <li key={c.viaId}>
                <button type="button" onClick={() => onSeleccionarVia(c.viaId)}>
                  {c.nombre}
                  <span>{Math.round(c.ratio * 100)} % de su velocidad · {c.vehiculos} veh.</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
      {resumen.avisos.length > 0 && (
        <p className="aviso">{resumen.avisos.join(' · ')}</p>
      )}
    </section>
  );
}
