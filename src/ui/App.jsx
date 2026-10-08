import { useEffect, useMemo, useRef, useState } from 'react';
import { cargarDatosRed } from './datos/cargarRed.js';
import { cargarRios } from './datos/cargarRios.js';
import { crearRed } from '../sim/red.js';
import { prepararGeometria } from '../sim/geometriaArcos.js';
import { arcosEnCasco, rodeaElCasco } from '../sim/restriccion.js';
import { aplicarCambio } from '../escenarios/cambios.js';
import { activos } from '../escenarios/historial.js';
import {
  crearEscenario, exportarEscenario, importarEscenario, nombreArchivo,
  leerEscenarios, guardarEscenario, borrarEscenario, CLAVE_ESCENARIOS, esEstadoConocido,
} from '../escenarios/escenario.js';
import { construirPrecargados } from '../escenarios/precargados.js';
import { diferenciasPorVia } from '../escenarios/comparar.js';
import { CASCO_URBANO, SALIDAS } from '../escenarios/zonas.js';
import { crearClienteSimulacion } from '../worker/clienteSimulacion.js';
import { crearClienteComparador } from '../worker/clienteComparador.js';
import { useEdicion } from './edicion/useEdicion.js';
import {
  crearDibujo, agregarPunto, quitarUltimo, cambiarAtributos, cambioDeDibujo, siguienteIdVia,
} from './edicion/dibujo.js';
import { descargarTexto } from './descargar.js';
import MapaSanGil from './mapa/MapaSanGil.jsx';
import Leyenda from './paneles/Leyenda.jsx';
import FichaVia from './paneles/FichaVia.jsx';
import FichaCruce from './paneles/FichaCruce.jsx';
import BarraTiempo from './paneles/BarraTiempo.jsx';
import PanelTrafico from './paneles/PanelTrafico.jsx';
import PanelMetricas from './paneles/PanelMetricas.jsx';
import PanelObras from './paneles/PanelObras.jsx';
import PanelDibujo from './paneles/PanelDibujo.jsx';
import PanelEscenarios from './paneles/PanelEscenarios.jsx';
import PanelComparador from './paneles/PanelComparador.jsx';
import ResultadosComparacion from './paneles/ResultadosComparacion.jsx';
import PanelHistoria from './paneles/PanelHistoria.jsx';
import BarraHistoria from './paneles/BarraHistoria.jsx';
import Confirmacion from './paneles/Confirmacion.jsx';
import './estilos.css';

const CONFIG_INICIAL = { factor: 1, temporada: 1, horaInicio: 7 };
const SIN_VEHICULOS = { cantidad: 0, datos: new Float64Array(0), t: 0 };
const NOMBRE_AUTOGUARDADO = 'Mis cambios (guardado automático)';

// La gráfica de la historia solo necesita las métricas; las vías ocupan mucho.
const soloMetricas = (r) => ({ ...r, resultados: r.resultados.map(({ nombre, metricas }) => ({ nombre, metricas })) });

const PESTANAS = [['editar', 'Editar'], ['escenarios', 'Escenarios'], ['comparar', 'Comparar'], ['historia', 'Historia']];

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
    mensaje: 'La Variante todavía no conecta Socorro con Bucaramanga: traza los tramos que faltan hasta la Avenida, o carga el escenario precargado.',
  };
}

// Solo los campos de texto se quedan con los atajos; casillas y botones de opción no.
const escribiendo = () => {
  const el = document.activeElement;
  return el?.tagName === 'TEXTAREA' || (el?.tagName === 'INPUT' && ['text', 'number', 'search'].includes(el.type));
};

function leerGuardados() {
  try { return leerEscenarios(localStorage.getItem(CLAVE_ESCENARIOS)); } catch { return []; }
}

export default function App() {
  const [base, setBase] = useState(null);
  const [rios, setRios] = useState(null);
  const [error, setError] = useState(null);
  const edicion = useEdicion(base);
  const { datos } = edicion;
  const [seleccion, setSeleccion] = useState(null);
  const [modo, setModo] = useState('ver');
  const [dibujo, setDibujo] = useState(null);
  const [pestana, setPestana] = useState('editar');
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
  const [guardados, setGuardados] = useState(leerGuardados);
  const [comparacion, setComparacion] = useState(null);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 });
  const [comparando, setComparando] = useState(false);
  const [diferenciasDe, setDiferenciasDe] = useState(null);
  const [historia, setHistoria] = useState(null); // { historia, indice, controlado }
  const [progresoHistoria, setProgresoHistoria] = useState({ hechos: 0, total: 0 });
  const comparadorHistoria = useRef(null); // worker aparte para la comparación controlada de la historia
  const pedidoHistoria = useRef(null); // { nombre, clave } de la historia que se está calculando
  const cliente = useRef(null);
  const comparador = useRef(null);
  const datosEnviados = useRef(null);

  const red = useMemo(() => (datos ? crearRed(datos) : null), [datos]);
  const variante = useMemo(() => (datos ? estadoDeLaVariante(datos) : null), [datos]);
  const precargados = useMemo(() => (base && rios ? construirPrecargados(base, rios) : null), [base, rios]);
  const todosLosEscenarios = useMemo(() => [...(precargados?.escenarios ?? []), ...guardados], [precargados, guardados]);
  const escenariosConocidos = useMemo(
    () => [...todosLosEscenarios, ...(precargados?.historias ?? []).flatMap((h) => h.pasos.map((p) => p.escenario))],
    [todosLosEscenarios, precargados],
  );
  const diferencias = useMemo(() => {
    if (!comparacion || !diferenciasDe) return null;
    const otro = comparacion.resultados.find((r) => r.nombre === diferenciasDe);
    return otro ? diferenciasPorVia(comparacion.resultados[0], otro) : null;
  }, [comparacion, diferenciasDe]);

  useEffect(() => {
    cargarDatosRed().then(setBase).catch((err) => setError(err.message));
    cargarRios().then(setRios);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CLAVE_ESCENARIOS, JSON.stringify(guardados)); } catch { /* sin almacenamiento */ }
  }, [guardados]);

  // Worker del comparador: uno para toda la sesión.
  useEffect(() => {
    const c = crearClienteComparador((mensaje) => {
      if (mensaje.tipo === 'progreso') setProgreso({ hechos: mensaje.hechos, total: mensaje.total });
      else if (mensaje.tipo === 'resultado') { setComparacion(mensaje.resultado); setComparando(false); setDiferenciasDe(null); }
      else if (mensaje.tipo === 'error') { edicion.mostrarError(`El comparador falló: ${mensaje.mensaje}`); setComparando(false); }
    });
    // Cada resultado de la historia se guarda con la clave y el nombre del pedido
    // que lo originó, no con los de la historia que esté abierta al llegar.
    const ch = crearClienteComparador((mensaje) => {
      const pedido = pedidoHistoria.current;
      if (!pedido) return;
      if (mensaje.tipo === 'progreso') {
        setProgresoHistoria({ hechos: mensaje.hechos, total: mensaje.total });
      } else if (mensaje.tipo === 'resultado') {
        const controlado = soloMetricas(mensaje.resultado);
        try { localStorage.setItem(pedido.clave, JSON.stringify(controlado)); } catch { /* sin almacenamiento */ }
        setHistoria((h) => (h && h.historia.nombre === pedido.nombre ? { ...h, controlado } : h));
        pedidoHistoria.current = null;
      } else if (mensaje.tipo === 'error') {
        edicion.mostrarError(`No se pudo calcular la comparación de la historia: ${mensaje.mensaje}`);
        pedidoHistoria.current = null;
      }
    });
    comparador.current = c;
    comparadorHistoria.current = ch;
    return () => { c.terminar(); ch.terminar(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Worker de la simulación: se crea cuando la red está lista y en cada reinicio.
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
        edicion.mostrarError(`La simulación reportó un error: ${mensaje.mensaje}`);
      }
    });
    c.iniciar(datos, { semilla: 1, demanda: config, restriccionPesados: restriccion });
    datosEnviados.current = datos;
    cliente.current = c;
    setCorriendo(false);
    setVehiculos(SIN_VEHICULOS);
    return () => c.terminar();
  }, [listo, reinicios]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!datos || !cliente.current || datos === datosEnviados.current) return;
    cliente.current.red(datos);
    datosEnviados.current = datos;
  }, [datos]);

  useEffect(() => { cliente.current?.reloj(corriendo, velocidad); }, [corriendo, velocidad, reinicios]);
  useEffect(() => { cliente.current?.restriccion(restriccion); }, [restriccion]);

  // Carga un escenario sobre la simulación en curso. La hora de inicio solo
  // cambia (y reinicia) si se pide, para no reiniciar en mitad de una historia.
  const aplicarEscenarioEnVivo = (escenario, { permitirReinicio = true } = {}) => {
    // Si hay ediciones propias que no son de ningún escenario, se guardan antes de reemplazarlas.
    const actuales = edicion.historial.entradas.slice(0, edicion.historial.indice);
    const guardarAntes = !esEstadoConocido(actuales, escenariosConocidos);
    if (guardarAntes) setGuardados((l) => guardarEscenario(l, escenarioActual(NOMBRE_AUTOGUARDADO)));
    if (!edicion.cargar(escenario.entradas)) return false;
    if (guardarAntes) edicion.mostrarError(`Tus cambios se guardaron en «${NOMBRE_AUTOGUARDADO}» (pestaña Escenarios) antes de cargar «${escenario.nombre}».`);
    const reiniciar = permitirReinicio && escenario.demanda.horaInicio !== config.horaInicio;
    const demanda = permitirReinicio ? escenario.demanda : { ...escenario.demanda, horaInicio: config.horaInicio };
    setConfig(demanda);
    setRestriccion(escenario.restriccionPesados);
    if (reiniciar) setReinicios((n) => n + 1);
    else cliente.current?.demanda({ factor: demanda.factor, temporada: demanda.temporada });
    setSeleccion(null);
    return true;
  };

  const escenarioActual = (nombre) => crearEscenario({
    nombre, entradas: edicion.historial.entradas.slice(0, edicion.historial.indice), demanda: config, restriccionPesados: restriccion,
  });

  const irAPaso = (indice) => {
    if (!historia) return;
    const i = Math.min(Math.max(indice, 0), historia.historia.pasos.length - 1);
    if (i === historia.indice) return;
    aplicarEscenarioEnVivo(historia.historia.pasos[i].escenario, { permitirReinicio: false });
    setHistoria((h) => (h ? { ...h, indice: i } : h));
  };

  // Los resultados controlados de una historia se guardan por red, para no recalcularlos.
  const claveControlado = (h) => `mapa-sangil:historia:v1:${h.nombre}:${base?.generado}`;

  const salirHistoria = () => {
    comparadorHistoria.current?.cancelar();
    pedidoHistoria.current = null;
    setHistoria(null);
  };

  const empezarHistoria = (h) => {
    const clave = claveControlado(h);
    let controlado = null;
    try { controlado = JSON.parse(localStorage.getItem(clave)); } catch { controlado = null; }
    comparadorHistoria.current.cancelar();
    pedidoHistoria.current = null;
    if (!controlado || controlado.resultados?.length !== h.pasos.length) {
      controlado = null;
      pedidoHistoria.current = { nombre: h.nombre, clave };
      setProgresoHistoria({ hechos: 0, total: h.pasos.length * 2 });
      comparadorHistoria.current.comparar(base, h.pasos.map((p) => p.escenario), { duracion: 1800, semillas: [1, 2] });
    }
    setHistoria({ historia: h, indice: 0, controlado });
    aplicarEscenarioEnVivo(h.pasos[0].escenario, { permitirReinicio: false });
    setColorPor('congestion');
    setCorriendo(true);
  };

  const iniciarDibujo = (preset) => { setDibujo(crearDibujo(preset)); setModo('dibujar'); setSeleccion(null); };
  const cancelarDibujo = () => { setDibujo(null); setModo('ver'); };
  const terminarDibujo = () => {
    try {
      const cambio = cambioDeDibujo(dibujo, siguienteIdVia(datos), rios ?? []);
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
      if (escribiendo() || edicion.pendiente || confirmarDescartar) return;
      if (historia && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        irAPaso(historia.indice + (e.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); edicion.deshacer(); }
      else if (ctrl && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); edicion.rehacer(); }
      else if (e.key === 'Escape') {
        if (modo === 'dibujar') cancelarDibujo();
        else if (historia) salirHistoria();
        else setSeleccion(null);
      }
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
  const colorEfectivo = diferencias ? 'diferencia' : colorPor;

  let panelPrincipal;
  if (modo === 'dibujar') {
    panelPrincipal = (
      <PanelDibujo
        dibujo={dibujo}
        rios={rios ?? []}
        onAtributos={(parcial) => setDibujo((d) => cambiarAtributos(d, parcial))}
        onQuitarUltimo={() => setDibujo(quitarUltimo)}
        onTerminar={terminarDibujo}
        onCancelar={cancelarDibujo}
      />
    );
  } else if (pestana === 'escenarios') {
    panelPrincipal = (
      <PanelEscenarios
        guardados={guardados}
        precargados={precargados?.escenarios ?? []}
        onGuardar={(nombre) => setGuardados((l) => guardarEscenario(l, escenarioActual(nombre)))}
        onCargar={(e) => aplicarEscenarioEnVivo(e)}
        onBorrar={(nombre) => setGuardados((l) => borrarEscenario(l, nombre))}
        onExportar={(e) => descargarTexto(nombreArchivo(e), exportarEscenario(e))}
        onImportar={(texto) => {
          try {
            const e = importarEscenario(texto, base);
            setGuardados((l) => guardarEscenario(l, e));
          } catch (err) {
            edicion.mostrarError(err.message);
          }
        }}
      />
    );
  } else if (pestana === 'comparar') {
    panelPrincipal = (
      <PanelComparador
        escenarios={todosLosEscenarios}
        progreso={progreso}
        corriendo={comparando}
        onComparar={(escenarios, opciones) => {
          setComparando(true);
          setProgreso({ hechos: 0, total: escenarios.length * opciones.semillas.length });
          comparador.current.comparar(base, escenarios, opciones);
        }}
        onCancelar={() => { comparador.current.cancelar(); setComparando(false); }}
      />
    );
  } else if (pestana === 'historia') {
    panelPrincipal = <PanelHistoria historias={precargados?.historias ?? []} onEmpezar={empezarHistoria} />;
  } else {
    panelPrincipal = (
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
    );
  }

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
          colorPor={colorEfectivo}
          congestion={congestion}
          diferencias={diferencias}
          seleccion={seleccion}
          onSeleccionar={setSeleccion}
          modo={modo}
          dibujo={dibujo}
          onClicMapa={(coordenada) => setDibujo((d) => agregarPunto(d, red, coordenada))}
          casco={restriccion ? CASCO_URBANO : null}
        />
        {historia && (
          <BarraHistoria
            historia={historia.historia}
            indice={historia.indice}
            controlado={historia.controlado}
            progreso={progresoHistoria}
            demoraAhora={resumen?.demoraReciente}
            onAnterior={() => irAPaso(historia.indice - 1)}
            onSiguiente={() => irAPaso(historia.indice + 1)}
            onSalir={salirHistoria}
          />
        )}
        <aside className="lateral lateral-izq">
          {modo !== 'dibujar' && (
            <nav className="pestanas" aria-label="Secciones">
              {PESTANAS.map(([id, texto]) => (
                <button key={id} type="button" className={pestana === id ? 'activa' : ''} onClick={() => setPestana(id)}>{texto}</button>
              ))}
            </nav>
          )}
          {panelPrincipal}
          <PanelTrafico
            config={config}
            onCambiar={cambiarDemanda}
            colorPor={colorPor}
            onColorPor={(c) => { setColorPor(c); setDiferenciasDe(null); }}
            onReiniciar={() => setReinicios((n) => n + 1)}
          />
          <Leyenda colorPor={colorEfectivo} />
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
        {comparacion && (
          <ResultadosComparacion
            comparacion={comparacion}
            red={red}
            diferenciasDe={diferenciasDe}
            onVerDiferencias={setDiferenciasDe}
            onCerrar={() => { setComparacion(null); setDiferenciasDe(null); }}
          />
        )}
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
