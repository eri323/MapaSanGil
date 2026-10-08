import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarDatosRed } from './datos/cargarRed.js';
import { crearRed } from '../sim/red.js';
import { crearClienteSimulacion } from '../worker/clienteSimulacion.js';
import MapaSanGil from './mapa/MapaSanGil.jsx';
import Leyenda from './paneles/Leyenda.jsx';
import FichaVia from './paneles/FichaVia.jsx';
import BarraTiempo from './paneles/BarraTiempo.jsx';
import PanelTrafico from './paneles/PanelTrafico.jsx';
import PanelMetricas from './paneles/PanelMetricas.jsx';
import './estilos.css';

const CONFIG_INICIAL = { factor: 1, temporada: 1, horaInicio: 7 };
const SIN_VEHICULOS = { cantidad: 0, datos: new Float64Array(0), t: 0 };

export default function App() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [viaSeleccionada, setViaSeleccionada] = useState(null);
  const [vehiculos, setVehiculos] = useState(SIN_VEHICULOS);
  const [resumen, setResumen] = useState(null);
  const [congestion, setCongestion] = useState(() => new Map());
  const [corriendo, setCorriendo] = useState(false);
  const [velocidad, setVelocidad] = useState(5);
  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [colorPor, setColorPor] = useState('tipo');
  const [reinicios, setReinicios] = useState(0);
  const cliente = useRef(null);

  const red = useMemo(() => (datos ? crearRed(datos) : null), [datos]);

  useEffect(() => {
    cargarDatosRed().then(setDatos).catch((err) => setError(err.message));
  }, []);

  // Crea el worker; se vuelve a crear al reiniciar. La configuración se lee aquí,
  // por eso cambiar la hora de inicio exige reiniciar.
  useEffect(() => {
    if (!datos) return undefined;
    const c = crearClienteSimulacion((mensaje) => {
      if (mensaje.tipo === 'cuadro') {
        setVehiculos({ cantidad: mensaje.cantidad, datos: mensaje.datos, t: mensaje.t });
      } else if (mensaje.tipo === 'resumen') {
        setResumen(mensaje.resumen);
        setCongestion(new Map(mensaje.vias.map((x) => [x.viaId, x.ratio])));
      } else if (mensaje.tipo === 'error') {
        setError(mensaje.mensaje);
      }
    });
    c.iniciar(datos, { semilla: 1, demanda: config });
    cliente.current = c;
    setCorriendo(false);
    setVehiculos(SIN_VEHICULOS);
    return () => c.terminar();
  }, [datos, reinicios]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cliente.current?.reloj(corriendo, velocidad);
  }, [corriendo, velocidad, reinicios]);

  const cambiarDemanda = (parcial) => {
    setConfig((actual) => ({ ...actual, ...parcial }));
    if ('horaInicio' in parcial) setReinicios((n) => n + 1);
    else cliente.current?.demanda(parcial);
  };

  if (error) {
    return (
      <main className="pantalla-mensaje">
        <h1>No se pudo cargar el simulador</h1>
        <pre>{error}</pre>
      </main>
    );
  }
  if (!red) {
    return <main className="pantalla-mensaje"><p>Cargando la red vial de San Gil…</p></main>;
  }

  const via = viaSeleccionada ? red.vias.get(viaSeleccionada) : null;

  return (
    <div className="app">
      <header className="barra">
        <h1>Simulador de tráfico · San Gil</h1>
        <BarraTiempo
          t={vehiculos.t}
          horaInicio={config.horaInicio}
          corriendo={corriendo}
          velocidad={velocidad}
          onAlternar={() => setCorriendo((c) => !c)}
          onVelocidad={setVelocidad}
        />
      </header>
      <div className="contenido">
        <MapaSanGil
          red={red}
          vehiculos={vehiculos}
          colorPor={colorPor}
          congestion={congestion}
          viaSeleccionada={viaSeleccionada}
          onSeleccionarVia={setViaSeleccionada}
        />
        <aside className="lateral lateral-izq">
          <PanelTrafico
            config={config}
            onCambiar={cambiarDemanda}
            colorPor={colorPor}
            onColorPor={setColorPor}
            onReiniciar={() => setReinicios((n) => n + 1)}
          />
          <Leyenda colorPor={colorPor} />
        </aside>
        <aside className="lateral">
          {via && <FichaVia via={via} onCerrar={() => setViaSeleccionada(null)} />}
          <PanelMetricas resumen={resumen} onSeleccionarVia={setViaSeleccionada} />
        </aside>
        <footer className="atribucion">{red.meta.fuente}</footer>
      </div>
    </div>
  );
}
