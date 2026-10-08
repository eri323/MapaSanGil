import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarDatosRed } from './datos/cargarRed.js';
import { cargarRios } from './datos/cargarRios.js';
import { crearRed } from '../sim/red.js';
import { prepararGeometria } from '../sim/geometriaArcos.js';
import { arcosEnCasco, rodeaElCasco } from '../sim/restriccion.js';
import { aplicarCambio } from '../escenarios/cambios.js';
import { CASCO_URBANO, SALIDAS } from '../escenarios/zonas.js';
import { crearClienteSimulacion } from '../worker/clienteSimulacion.js';
import { useEdicion } from './edicion/useEdicion.js';
import {
  crearDibujo, agregarPunto, quitarUltimo, cambiarAtributos, cambioDeDibujo, siguienteIdVia,
} from './edicion/dibujo.js';
import MapaSanGil from './mapa/MapaSanGil.jsx';
import Leyenda from './paneles/Leyenda.jsx';
import FichaVia from './paneles/FichaVia.jsx';
import FichaCruce from './paneles/FichaCruce.jsx';
import BarraTiempo from './paneles/BarraTiempo.jsx';
import PanelTrafico from './paneles/PanelTrafico.jsx';
import PanelMetricas from './paneles/PanelMetricas.jsx';
import PanelObras from './paneles/PanelObras.jsx';
import PanelDibujo from './paneles/PanelDibujo.jsx';
import Confirmacion from './paneles/Confirmacion.jsx';
import './estilos.css';

const CONFIG_INICIAL = { factor: 1, temporada: 1, horaInicio: 7 };
const SIN_VEHICULOS = { cantidad: 0, datos: new Float64Array(0), t: 0 };

function conectaAlrededor(datos) {
  const red = crearRed(datos);
  const casco = arcosEnCasco(red, prepararGeometria(red), CASCO_URBANO);
  return rodeaElCasco(red, casco, SALIDAS.socorro.nodo, SALIDAS.bucaramanga.nodo);
}

function estadoDeLaVariante(datos) {
  const enObra = datos.vias.filter((v) => v.tipo === 'variante' && v.enConstruccion).map((v) => v.id);
  if (conectaAlrededor(datos)) {
    return { enObra, conecta: true, mensaje: 'La Variante rodea el centro: con la restricción activa, los pesados de paso la usan.' };
  }
  if (enObra.length && conectaAlrededor(aplicarCambio(datos, { tipo: 'terminarObra', viaIds: enObra }))) {
    return { enObra, conecta: false, mensaje: 'La Variante ya conecta Socorro con Bucaramanga: falta terminar la obra.' };
  }
  return {
    enObra,
    conecta: false,
    mensaje: 'La Variante todavía no conecta Socorro con Bucaramanga: traza los tramos que faltan hasta la Avenida.',
  };
}

// Solo los campos de texto se quedan con Ctrl+Z; casillas y botones de opción no.
const escribiendo = () => {
  const el = document.activeElement;
  return el?.tagName === 'TEXTAREA' || (el?.tagName === 'INPUT' && ['text', 'number', 'search'].includes(el.type));
};

export default function App() {
  const [base, setBase] = useState(null);
  const [rios, setRios] = useState([]);
  const [error, setError] = useState(null);
  const edicion = useEdicion(base);
  const { datos } = edicion;
  const [seleccion, setSeleccion] = useState(null);
  const [modo, setModo] = useState('ver');
  const [dibujo, setDibujo] = useState(null);
  const [vehiculos, setVehiculos] = useState(SIN_VEHICULOS);
  const [resumen, setResumen] = useState(null);
  const [congestion, setCongestion] = useState(() => new Map());
  const [corriendo, setCorriendo] = useState(false);
  const [velocidad, setVelocidad] = useState(5);
  const [config, setConfig] = useState(CONFIG_INICIAL);
  const [colorPor, setColorPor] = useState('tipo');
  const [restriccion, setRestriccion] = useState(false);
  const [reinicios, setReinicios] = useState(0);
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const cliente = useRef(null);
  const datosEnviados = useRef(null);

  const red = useMemo(() => (datos ? crearRed(datos) : null), [datos]);
  const variante = useMemo(() => (datos ? estadoDeLaVariante(datos) : null), [datos]);

  useEffect(() => {
    cargarDatosRed().then(setBase).catch((err) => setError(err.message));
    cargarRios().then(setRios);
  }, []);

  // Crea el worker cuando la red está lista y en cada reinicio.
  const listo = Boolean(datos);
  useEffect(() => {
    if (!listo) return undefined;
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
    c.iniciar(datos, { semilla: 1, demanda: config, restriccionPesados: restriccion });
    datosEnviados.current = datos;
    cliente.current = c;
    setCorriendo(false);
    setVehiculos(SIN_VEHICULOS);
    return () => c.terminar();
  }, [listo, reinicios]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cada edición se aplica en vivo sobre la simulación en curso.
  useEffect(() => {
    if (!datos || !cliente.current || datos === datosEnviados.current) return;
    cliente.current.red(datos);
    datosEnviados.current = datos;
  }, [datos]);

  useEffect(() => { cliente.current?.reloj(corriendo, velocidad); }, [corriendo, velocidad, reinicios]);
  useEffect(() => { cliente.current?.restriccion(restriccion); }, [restriccion]);

  const iniciarDibujo = (preset) => { setDibujo(crearDibujo(preset)); setModo('dibujar'); setSeleccion(null); };
  const cancelarDibujo = () => { setDibujo(null); setModo('ver'); };
  const terminarDibujo = () => {
    try {
      const cambio = cambioDeDibujo(dibujo, siguienteIdVia(datos), rios);
      let prefijo = cambio.atributos.esPuente ? 'Puente nuevo' : 'Vía nueva';
      if (dibujo.preset === 'variante') prefijo = cambio.atributos.esPuente ? 'Tramo de la Variante (con puente)' : 'Tramo de la Variante';
      const { nombre } = cambio.atributos;
      edicion.aplicar(cambio, nombre === prefijo ? prefijo : `${prefijo}: ${nombre}`);
      cancelarDibujo();
    } catch (err) {
      edicion.mostrarError(err.message);
    }
  };

  useEffect(() => {
    const alPresionar = (e) => {
      if (escribiendo()) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); edicion.deshacer(); }
      else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); edicion.rehacer(); }
      else if (e.key === 'Escape') { if (modo === 'dibujar') cancelarDibujo(); else setSeleccion(null); }
    };
    window.addEventListener('keydown', alPresionar);
    return () => window.removeEventListener('keydown', alPresionar);
  });

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

  const via = seleccion?.tipo === 'via' ? red.vias.get(seleccion.id) : null;
  const nodo = seleccion?.tipo === 'cruce' ? red.nodos.get(seleccion.id) : null;

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
          seleccion={seleccion}
          onSeleccionar={setSeleccion}
          modo={modo}
          dibujo={dibujo}
          onClicMapa={(coordenada) => setDibujo((d) => agregarPunto(d, red, coordenada))}
          casco={restriccion ? CASCO_URBANO : null}
        />
        <aside className="lateral lateral-izq">
          {modo === 'dibujar' ? (
            <PanelDibujo
              dibujo={dibujo}
              rios={rios}
              onAtributos={(parcial) => setDibujo((d) => cambiarAtributos(d, parcial))}
              onQuitarUltimo={() => setDibujo(quitarUltimo)}
              onTerminar={terminarDibujo}
              onCancelar={cancelarDibujo}
            />
          ) : (
            <PanelObras
              datos={datos}
              variante={variante}
              restriccion={restriccion}
              onRestriccion={setRestriccion}
              onCambio={edicion.aplicar}
              onIniciarDibujo={iniciarDibujo}
              historial={edicion.historial}
              puedeDeshacer={edicion.puedeDeshacer}
              puedeRehacer={edicion.puedeRehacer}
              onDeshacer={edicion.deshacer}
              onRehacer={edicion.rehacer}
              onDescartar={() => setConfirmarDescartar(true)}
            />
          )}
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
          {edicion.error && (
            <section className="panel aviso-error">
              <p>{edicion.error}</p>
              <button type="button" onClick={edicion.limpiarError}>Entendido</button>
            </section>
          )}
          {via && <FichaVia via={via} onCambio={edicion.aplicar} onCerrar={() => setSeleccion(null)} />}
          {nodo && <FichaCruce nodo={nodo} red={red} onCambio={edicion.aplicar} onCerrar={() => setSeleccion(null)} />}
          <PanelMetricas resumen={resumen} onSeleccionarVia={(id) => setSeleccion({ tipo: 'via', id })} />
        </aside>
        <footer className="atribucion">{red.meta.fuente}</footer>
      </div>

      {edicion.pendiente && (
        <Confirmacion titulo="Este cambio desconecta parte de la red" onConfirmar={edicion.confirmar} onCancelar={edicion.cancelar}>
          {edicion.pendiente.impacto.aisladas.length > 0 && (
            <p>Quedarían sin ida y vuelta: <strong>{edicion.pendiente.impacto.aisladas.join(', ')}</strong>.</p>
          )}
          <p>{edicion.pendiente.impacto.perdidos} cruces quedarían sin conexión de ida y vuelta con el resto.</p>
          <p className="nota">Los viajes que no tengan ruta se contarán como imposibles.</p>
        </Confirmacion>
      )}
      {confirmarDescartar && (
        <Confirmacion
          titulo="¿Descartar todos los cambios?"
          textoConfirmar="Descartar"
          onConfirmar={() => { edicion.descartarTodo(); setConfirmarDescartar(false); setSeleccion(null); }}
          onCancelar={() => setConfirmarDescartar(false)}
        >
          <p>Se vuelve a la red de OpenStreetMap con las correcciones de campo. Esto no se puede deshacer.</p>
        </Confirmacion>
      )}
    </div>
  );
}
