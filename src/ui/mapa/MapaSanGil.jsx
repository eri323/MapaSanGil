import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { PathLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  colorVia, anchoVia, flechasDeVias, COLOR_PUENTE, COLOR_PARE, COLOR_SELECCION,
} from './estilosVia.js';

const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron';
const VISTA_INICIAL = { longitude: -73.134, latitude: 6.555, zoom: 14.5, pitch: 0, bearing: 0 };
const PUNTEADO = new PathStyleExtension({ dash: true });

export default function MapaSanGil({ red, viaSeleccionada, onSeleccionarVia }) {
  const vias = useMemo(() => [...red.vias.values()], [red]);
  const puentes = useMemo(() => vias.filter((v) => v.esPuente), [vias]);
  const flechas = useMemo(() => flechasDeVias(vias), [vias]);
  const pares = useMemo(() => [...red.nodos.values()].filter((n) => n.control === 'pare'), [red]);

  const capas = [
    new PathLayer({
      id: 'puentes',
      data: puentes,
      getPath: (v) => v.geometria,
      getColor: COLOR_PUENTE,
      getWidth: (v) => anchoVia(v) + 6,
      widthUnits: 'pixels',
      capRounded: true,
    }),
    new PathLayer({
      id: 'vias',
      data: vias,
      getPath: (v) => v.geometria,
      getColor: (v) => (v.id === viaSeleccionada ? COLOR_SELECCION : colorVia(v)),
      getWidth: anchoVia,
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      pickable: true,
      getDashArray: (v) => (v.enConstruccion ? [4, 3] : [0, 0]),
      dashJustified: true,
      extensions: [PUNTEADO],
      updateTriggers: { getColor: viaSeleccionada },
    }),
    new TextLayer({
      id: 'flechas',
      data: flechas,
      getPosition: (f) => f.posicion,
      getText: () => '▶',
      getAngle: (f) => f.angulo,
      getSize: 16,
      getColor: [30, 40, 50],
      fontFamily: 'Arial, sans-serif',
      characterSet: ['▶'],
      outlineWidth: 2,
      outlineColor: [255, 255, 255],
      fontSettings: { sdf: true },
    }),
    new ScatterplotLayer({
      id: 'pares',
      data: pares,
      getPosition: (n) => [n.lon, n.lat],
      getRadius: 5,
      radiusUnits: 'pixels',
      getFillColor: COLOR_PARE,
      getLineColor: [255, 255, 255],
      stroked: true,
      lineWidthMinPixels: 1.5,
    }),
  ];

  return (
    <DeckGL
      initialViewState={VISTA_INICIAL}
      controller
      layers={capas}
      onClick={(info) => onSeleccionarVia(info.object?.id ?? null)}
      getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
    >
      <Map mapStyle={ESTILO_MAPA} />
    </DeckGL>
  );
}
