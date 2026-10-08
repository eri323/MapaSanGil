"""
Paso 1 — Descargar la red vial real de San Gil desde OpenStreetMap
y convertirla a una red SUMO lista para simular.

Salidas en data/:
    sangil.graphml      grafo de OSMnx (para analisis en Python/NetworkX)
    sangil.osm.xml      XML en formato OSM (entrada de netconvert)
    sangil.net.xml      red SUMO
    puentes.csv         inventario de puentes detectados

Uso:
    python src/01_download_network.py
    python src/01_download_network.py --actuated   # semaforos adaptativos
"""

import argparse
import csv
import os
import shutil
import subprocess
import sys
from pathlib import Path

import osmnx as ox

DATA = Path(__file__).resolve().parent.parent / "data"
PLACE = "San Gil, Santander, Colombia"

# Fallback si Nominatim no devuelve el poligono del municipio.
# Verifica estos limites en https://www.openstreetmap.org antes de confiar en ellos.
BBOX_FALLBACK = dict(north=6.5720, south=6.5380, east=-73.1180, west=-73.1500)


def descargar_grafo(usar_bbox: bool):
    if usar_bbox:
        print(f"Descargando por bounding box: {BBOX_FALLBACK}")
        return ox.graph_from_bbox(network_type="drive", **BBOX_FALLBACK)
    print(f"Descargando por lugar: {PLACE}")
    return ox.graph_from_place(PLACE, network_type="drive")


def inventario_puentes(G, salida: Path):
    """
    Lista las aristas etiquetadas como puente. Es el punto de partida para
    identificar el Rojas Pinilla y el Bernardo Gomez Silva por su ID de OSM.
    OJO: si un puente no esta etiquetado en OSM, no aparece aqui. Verifica
    contra el mapa y, si falta, corrigelo en OSM.
    """
    filas = []
    for u, v, k, d in G.edges(keys=True, data=True):
        if not d.get("bridge"):
            continue
        nombre = d.get("name", "")
        if isinstance(nombre, list):
            nombre = " | ".join(nombre)
        filas.append({
            "osmid": d.get("osmid"),
            "nombre": nombre,
            "highway": d.get("highway"),
            "carriles": d.get("lanes", ""),
            "sentido_unico": d.get("oneway", ""),
            "longitud_m": round(float(d.get("length", 0)), 1),
            "u": u, "v": v,
        })

    filas.sort(key=lambda r: -r["longitud_m"])
    with open(salida, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(filas[0].keys()) if filas else ["osmid"])
        w.writeheader()
        w.writerows(filas)

    print(f"\n{len(filas)} puentes detectados -> {salida}")
    for r in filas[:12]:
        print(f"  {r['longitud_m']:>7.1f} m  {r['nombre'] or '(sin nombre)'}")
    if not filas:
        print("  Ninguno. La red de San Gil en OSM probablemente no tiene "
              "etiquetas bridge=yes. Revisa y contribuye al mapa.")
    return filas


def guardar_osm_xml(G, salida: Path):
    """OSMnx 1.x expone save_graph_xml en el namespace raiz; 2.x en ox.io."""
    fn = getattr(ox, "save_graph_xml", None) or getattr(ox.io, "save_graph_xml")
    fn(G, filepath=str(salida))
    print(f"OSM XML -> {salida}")


def netconvert(entrada: Path, salida: Path, actuated: bool):
    if shutil.which("netconvert") is None:
        print("\nnetconvert no esta en el PATH. Instala SUMO y exporta SUMO_HOME.")
        print("   Debian/Ubuntu: sudo apt install sumo sumo-tools sumo-doc")
        return False

    cmd = [
        "netconvert",
        "--osm-files", str(entrada),
        "--output-file", str(salida),
        "--geometry.remove",          # simplifica geometria redundante
        "--roundabouts.guess",
        "--ramps.guess",
        "--junctions.join",           # une intersecciones partidas en varias
        "--tls.guess-signals",
        "--tls.discard-simple",
        "--tls.join",
        "--remove-edges.isolated",
        "--keep-edges.by-vclass", "passenger",
        "--osm.turn-lanes",
    ]
    if actuated:
        cmd += ["--tls.default-type", "actuated"]

    print("\n" + " ".join(cmd))
    r = subprocess.run(cmd)
    if r.returncode == 0:
        print(f"Red SUMO -> {salida}")
    return r.returncode == 0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--bbox", action="store_true",
                   help="usar bounding box en vez del poligono del municipio")
    p.add_argument("--actuated", action="store_true",
                   help="semaforos actuados (escenario 'senalizacion optimizada')")
    args = p.parse_args()

    DATA.mkdir(exist_ok=True)
    G = descargar_grafo(args.bbox)
    print(f"Grafo: {G.number_of_nodes()} nodos, {G.number_of_edges()} aristas")

    ox.save_graphml(G, DATA / "sangil.graphml")
    inventario_puentes(G, DATA / "puentes.csv")
    guardar_osm_xml(G, DATA / "sangil.osm.xml")

    nombre = "sangil_actuated.net.xml" if args.actuated else "sangil.net.xml"
    netconvert(DATA / "sangil.osm.xml", DATA / nombre, args.actuated)


if __name__ == "__main__":
    sys.exit(main())
