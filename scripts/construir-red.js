// Descarga la red vial de San Gil desde Overpass (OpenStreetMap), la convierte
// al formato del modelo y la guarda en public/data/red-sangil.json.
//
// Uso:
//   npm run red              usa la copia en scripts/cache/ si existe
//   npm run red -- --fresca  vuelve a descargar desde Overpass

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { osmARed } from './lib/osmARed.js';
import { validarRed, crearRed, componentePrincipal } from '../src/sim/red.js';
import { ETIQUETA_TIPO } from '../src/sim/tipos.js';
import { NOMBRES_PUENTES } from './datos/puentes.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(RAIZ, 'scripts', 'cache', 'overpass-sangil.json');
const SALIDA = join(RAIZ, 'public', 'data', 'red-sangil.json');

// Área un poco más amplia que el casco urbano para incluir la Variante y las
// salidas a otros municipios. Verifica estos límites en openstreetmap.org.
const BBOX = { sur: 6.525, oeste: -73.16, norte: 6.585, este: -73.105 };

const SERVIDORES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const CONSULTA = `
[out:json][timeout:120];
(
  way["highway"~"^(trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|construction)$"]
    (${BBOX.sur},${BBOX.oeste},${BBOX.norte},${BBOX.este});
);
(._;>;);
out body;
`;

async function descargar() {
  for (const url of SERVIDORES) {
    try {
      console.log(`Descargando desde ${url} ...`);
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'MapaSangil/0.1 (proyecto universitario)',
        },
        body: `data=${encodeURIComponent(CONSULTA)}`,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      console.warn(`  falló: ${err.message}`);
    }
  }
  throw new Error('Ningún servidor de Overpass respondió. Intenta de nuevo en unos minutos.');
}

async function obtenerOverpass(fresca) {
  if (!fresca && existsSync(CACHE)) {
    console.log(`Usando copia local ${CACHE}`);
    return JSON.parse(await readFile(CACHE, 'utf8'));
  }
  const datos = await descargar();
  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, JSON.stringify(datos));
  return datos;
}

function imprimirInventario({ nodos, vias, descartadas, pares }) {
  console.log(`\n${nodos.length} nodos, ${vias.length} vías (${descartadas} descartadas por estar aisladas)`);
  console.log(`${pares} cruces con pare según OSM\n`);

  const porTipo = {};
  for (const v of vias) porTipo[v.tipo] = (porTipo[v.tipo] ?? 0) + v.longitud;
  console.log('Kilómetros por tipo de vía:');
  for (const [tipo, metros] of Object.entries(porTipo)) {
    console.log(`  ${ETIQUETA_TIPO[tipo].padEnd(18)} ${(metros / 1000).toFixed(1)} km`);
  }

  const puentes = vias.filter((v) => v.esPuente).sort((a, b) => b.longitud - a.longitud);
  console.log(`\n${puentes.length} tramos de puente:`);
  for (const v of puentes.slice(0, 15)) {
    const comun = v.nombrePuente ? `  → ${v.nombrePuente}` : '';
    console.log(`  ${String(v.longitud).padStart(7)} m  ${v.nombre || '(sin nombre)'}  [way ${v.osmId}]${comun}`);
  }

  const obras = vias.filter((v) => v.enConstruccion);
  console.log(`\n${obras.length} tramos en construcción:`);
  for (const v of obras.slice(0, 15)) {
    console.log(`  ${String(v.longitud).padStart(7)} m  ${v.nombre || '(sin nombre)'}  [way ${v.osmId}]`);
  }
}

async function main() {
  const fresca = process.argv.includes('--fresca');
  const overpass = await obtenerOverpass(fresca);
  const resultado = osmARed(overpass, { nombresPuentes: NOMBRES_PUENTES });

  const archivo = {
    version: 1,
    generado: new Date().toISOString(),
    fuente: '© colaboradores de OpenStreetMap (ODbL)',
    bbox: BBOX,
    nodos: resultado.nodos,
    vias: resultado.vias,
  };
  const errores = validarRed(archivo);
  if (errores.length) {
    console.error('La red generada no es válida:\n- ' + errores.slice(0, 20).join('\n- '));
    process.exit(1);
  }

  await mkdir(dirname(SALIDA), { recursive: true });
  await writeFile(SALIDA, JSON.stringify(archivo));
  imprimirInventario(resultado);

  // Respetando sentidos, ¿desde cuántos cruces se puede ir y volver a todos los demás?
  const red = crearRed(archivo);
  const principal = componentePrincipal(red);
  const atrapados = [...red.nodos.keys()].filter((id) => !principal.has(id));
  console.log(`\nAlcance con sentidos: ${principal.size} de ${red.nodos.size} cruces se conectan ida y vuelta.`);
  if (atrapados.length) {
    console.log(`  ${atrapados.length} cruces quedan por fuera (se entra y no se sale, o al revés):`);
    for (const id of atrapados.slice(0, 10)) {
      const n = red.nodos.get(id);
      console.log(`    ${id}  https://www.openstreetmap.org/node/${id.slice(1)}  (${n.lat.toFixed(5)}, ${n.lon.toFixed(5)})`);
    }
  }
  console.log(`\nRed -> ${SALIDA}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
