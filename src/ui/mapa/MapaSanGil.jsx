import { useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { PathLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import MapaBase from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  colorVia, anchoVia, flechasDeVias, COLOR_PUENTE, COLOR_PARE, COLOR_SELECCION,
  COLOR_CERRADA, COLOR_SEMAFORO, COLOR_CRUCE, COLOR_DIBUJO, COLOR_AJUSTE, colorDiferencia,
} from './estilosVia.js';
import { COLOR_POR_INDICE, RADIO_POR_INDICE, colorCongestion } from './estilosVehiculo.js';
import { circulo } from './geometriaUi.js';
import { lineaDelDibujo } from '../edicion/dibujo.js';

const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/positron';
const VISTA_INICIAL = { longitude: -73.134, latitude: 6.555, zoom: 14.5, pitch: 0, bearing: 0 };
const PUNTEADO = new PathStyleExtension({ dash: true });

export default function MapaSanGil({
  red, vehiculos, colorPor, congestion, diferencias, seleccion, onSeleccionar, modo, dibujo, onClicMapa, casco,
}) {
  const vias = useMemo(() => [...red.vias.values()], [red]);
  const puentes = useMemo(() => vias.filter((v) => v.esPuente), [vias]);
  const doblesCalzadas = useMemo(() => vias.filter((v) => v.dobleCalzada), [vias]);
  const flechas = useMemo(() => flechasDeVias(vias.filter((v) => v.abierta)), [vias]);
  const etiquetasPuentes = useMemo(
    () => puentes
      .filter((v) => v.nombrePuente || v.nueva)
      .map((v) => ({
        texto: (v.nombrePuente ?? v.nombre).replace(/\s*\(.*\)$/, ''),
        posicion: v.geometria.length === 2
          ? [(v.geometria[0][0] + v.geometria[1][0]) / 2, (v.geometria[0][1] + v.geometria[1][1]) / 2]
          : v.geometria[Math.floor(v.geometria.length / 2)],
      })),
    [puentes],
  );
  const cruces = useMemo(() => {
    const grado = new Map();
    for (const v of vias) for (const n of [v.desde, v.hasta]) grado.set(n, (grado.get(n) ?? 0) + 1);
    return [...red.nodos.values()].filter((n) => grado.get(n.id) >= 3 || n.control !== 'sin_senal');
  }, [red, vias]);
  const pares = useMemo(() => cruces.filter((n) => n.control === 'pare'), [cruces]);
  const semaforos = useMemo(() => cruces.filter((n) => n.control === 'semaforo'), [cruces]);
  const anilloCasco = useMemo(() => (casco ? [{ path: circulo(casco.lon, casco.lat, casco.radio) }] : []), [casco]);

  const seleccionada = (tipo, id) => seleccion?.tipo === tipo && seleccion.id === id;
  const colorDeVia = (v) => {
    if (seleccionada('via', v.id)) return COLOR_SELECCION;
    if (!v.abierta) return COLOR_CERRADA;
    if (colorPor === 'diferencia') return colorDiferencia(diferencias?.get(v.id));
    return colorPor === 'congestion' ? colorCongestion(congestion.get(v.id)) : colorVia(v);
  };

  const { cantidad, datos } = vehiculos;
  const lineaDibujo = dibujo && dibujo.puntos.length ? lineaDelDibujo(dibujo) : [];

  const capas = [
    new PathLayer({
      id: 'casco', data: anilloCasco, getPath: (d) => d.path, getColor: [120, 120, 120, 160],
      getWidth: 2, widthUnits: 'pixels', getDashArray: [6, 4], extensions: [PUNTEADO],
    }),
    new PathLayer({
      id: 'puentes', data: puentes, getPath: (v) => v.geometria, getColor: COLOR_PUENTE,
      getWidth: (v) => anchoVia(v) + 6, widthUnits: 'pixels', capRounded: true,
    }),
    new PathLayer({
      id: 'vias',
      data: vias,
      getPath: (v) => v.geometria,
      getColor: colorDeVia,
      getWidth: anchoVia,
      widthUnits: 'pixels',
      capRounded: true,
      jointRounded: true,
      pickable: modo !== 'dibujar',
      getDashArray: (v) => (v.enConstruccion || !v.abierta ? [4, 3] : [0, 0]),
      dashJustified: true,
      extensions: [PUNTEADO],
      updateTriggers: { getColor: [seleccion, colorPor, congestion, diferencias] },
    }),
    new PathLayer({
      id: 'doble-calzada', data: doblesCalzadas, getPath: (v) => v.geometria,
      getColor: [255, 255, 255], getWidth: 1.5, widthUnits: 'pixels',
    }),
    new TextLayer({
      id: 'flechas', data: flechas, getPosition: (f) => f.posicion, getText: () => '▶', getAngle: (f) => f.angulo,
      getSize: 16, getColor: [30, 40, 50], fontFamily: 'Arial, sans-serif', characterSet: ['▶'],
      outlineWidth: 2, outlineColor: [255, 255, 255], fontSettings: { sdf: true },
    }),
    new ScatterplotLayer({
      id: 'cruces', data: cruces, getPosition: (n) => [n.lon, n.lat],
      getRadius: (n) => (seleccionada('cruce', n.id) ? 7 : 3.5), radiusUnits: 'meters', radiusMinPixels: 0, radiusMaxPixels: 8,
      getFillColor: (n) => (seleccionada('cruce', n.id) ? COLOR_SELECCION : COLOR_CRUCE),
      pickable: modo !== 'dibujar',
      updateTriggers: { getRadius: seleccion, getFillColor: seleccion },
    }),
    new ScatterplotLayer({
      id: 'vehiculos',
      data: { length: cantidad },
      getPosition: (_, { index }) => [datos[index * 3], datos[index * 3 + 1]],
      getFillColor: (_, { index }) => COLOR_POR_INDICE[datos[index * 3 + 2]],
      getRadius: (_, { index }) => RADIO_POR_INDICE[datos[index * 3 + 2]],
      radiusUnits: 'meters', radiusMinPixels: 3, radiusMaxPixels: 9,
      stroked: true, getLineColor: [255, 255, 255], lineWidthMinPixels: 0.5,
      updateTriggers: { getPosition: datos, getFillColor: datos, getRadius: datos },
    }),
    new TextLayer({
      id: 'nombres-puentes', data: etiquetasPuentes, getPosition: (e) => e.posicion, getText: (e) => e.texto,
      getSize: 12, getColor: [60, 45, 0], getPixelOffset: [0, -16],
      fontFamily: 'system-ui, Segoe UI, Arial, sans-serif', fontWeight: 600, fontSettings: { sdf: true },
      outlineWidth: 3, outlineColor: [255, 255, 255], characterSet: 'auto',
    }),
    new ScatterplotLayer({
      id: 'pares', data: pares, getPosition: (n) => [n.lon, n.lat], getRadius: 5, radiusUnits: 'pixels',
      getFillColor: COLOR_PARE, getLineColor: [255, 255, 255], stroked: true, lineWidthMinPixels: 1.5,
    }),
    new ScatterplotLayer({
      id: 'semaforos', data: semaforos, getPosition: (n) => [n.lon, n.lat], getRadius: 6, radiusUnits: 'pixels',
      getFillColor: COLOR_SEMAFORO, getLineColor: [20, 20, 20], stroked: true, lineWidthMinPixels: 2,
    }),
    new PathLayer({
      id: 'dibujo', data: lineaDibujo.length > 1 ? [{ path: lineaDibujo }] : [], getPath: (d) => d.path,
      getColor: COLOR_DIBUJO, getWidth: 5, widthUnits: 'pixels', getDashArray: [3, 2], extensions: [PUNTEADO],
    }),
    new ScatterplotLayer({
      id: 'puntos-dibujo',
      data: dibujo ? dibujo.puntos.map((p, i, todos) => ({ posicion: lineaDibujo[i], tipo: i === 0 || i === todos.length - 1 ? p.ajuste.tipo : 'libre' })) : [],
      getPosition: (p) => p.posicion, getRadius: 6, radiusUnits: 'pixels',
      getFillColor: (p) => COLOR_AJUSTE[p.tipo], getLineColor: [255, 255, 255], stroked: true, lineWidthMinPixels: 2,
    }),
  ];

  const alHacerClic = (info) => {
    if (modo === 'dibujar') {
      if (info.coordinate) onClicMapa(info.coordinate);
      return;
    }
    if (info.layer?.id === 'vias') onSeleccionar({ tipo: 'via', id: info.object.id });
    else if (info.layer?.id === 'cruces') onSeleccionar({ tipo: 'cruce', id: info.object.id });
    else onSeleccionar(null);
  };

  return (
    <DeckGL
      initialViewState={VISTA_INICIAL}
      controller={{ doubleClickZoom: modo !== 'dibujar' }}
      layers={capas}
      onClick={alHacerClic}
      getCursor={({ isHovering }) => {
        if (modo === 'dibujar') return 'crosshair';
        return isHovering ? 'pointer' : 'grab';
      }}
    >
      <MapaBase mapStyle={ESTILO_MAPA} />
    </DeckGL>
  );
}
