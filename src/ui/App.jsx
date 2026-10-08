import { useEffect, useState } from 'react';
import { cargarRed } from './datos/cargarRed.js';
import MapaSanGil from './mapa/MapaSanGil.jsx';
import Leyenda from './paneles/Leyenda.jsx';
import FichaVia from './paneles/FichaVia.jsx';
import './estilos.css';

export default function App() {
  const [red, setRed] = useState(null);
  const [error, setError] = useState(null);
  const [viaSeleccionada, setViaSeleccionada] = useState(null);

  useEffect(() => {
    cargarRed().then(setRed).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <main className="pantalla-mensaje">
        <h1>No se pudo cargar el mapa</h1>
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
        <span>{red.vias.size} vías · {red.nodos.size} cruces</span>
      </header>
      <div className="contenido">
        <MapaSanGil red={red} viaSeleccionada={viaSeleccionada} onSeleccionarVia={setViaSeleccionada} />
        <aside className="lateral">
          <Leyenda />
          {via && <FichaVia via={via} onCerrar={() => setViaSeleccionada(null)} />}
        </aside>
        <footer className="atribucion">{red.meta.fuente}</footer>
      </div>
    </div>
  );
}
