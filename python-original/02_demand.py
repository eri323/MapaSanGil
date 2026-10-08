"""
Paso 2 — Generar la demanda de trafico.

Tres flujos separados, porque se comportan distinto y esa separacion es
justamente lo que hace util el modelo:

    local     viajes internos del municipio       (fringe-factor bajo)
    pasante   viajes que solo atraviesan San Gil  (fringe-factor alto)
    pesado    tractomulas de la troncal           (vClass truck, 2.5 upc)

Los volumenes por defecto son SUPUESTOS. Sin aforos reales el modelo
compara escenarios entre si, pero no predice tiempos absolutos.
Cambia PERIODOS con tus conteos apenas los tengas.

Uso:
    python src/02_demand.py
    python src/02_demand.py --factor 1.4      # temporada turistica
    python src/02_demand.py --pesados 40      # 1 tractomula cada 40 s
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
HORA = 3600

# segundos entre vehiculos generados. Menor periodo = mas trafico.
# 3.6 s -> ~1000 veh/h.  Ajustar con aforos reales.
PERIODOS = {
    "local":   {"period": 3.6,  "fringe": 1.0,  "vclass": None},
    "pasante": {"period": 8.0,  "fringe": 50.0, "vclass": None},
    "pesado":  {"period": 30.0, "fringe": 90.0, "vclass": "truck"},
}


def tools_dir() -> Path:
    home = os.environ.get("SUMO_HOME")
    if not home:
        sys.exit("SUMO_HOME no esta definido. export SUMO_HOME=/usr/share/sumo")
    d = Path(home) / "tools"
    if not (d / "randomTrips.py").exists():
        sys.exit(f"No encuentro randomTrips.py en {d}")
    return d


def generar(nombre, cfg, net: Path, factor: float, fin: int, semilla: int):
    period = cfg["period"] / factor
    trips = DATA / f"{nombre}.trips.xml"
    rutas = DATA / f"{nombre}.rou.xml"

    cmd = [
        sys.executable, str(tools_dir() / "randomTrips.py"),
        "-n", str(net),
        "-o", str(trips),
        "-r", str(rutas),          # invoca duarouter y produce rutas validas
        "-b", "0", "-e", str(fin),
        "-p", f"{period:.3f}",
        "--fringe-factor", str(cfg["fringe"]),
        "--prefix", nombre[:3],
        "--seed", str(semilla),
        "--validate",
        "--remove-loops",
    ]
    if cfg["vclass"]:
        cmd += ["--vehicle-class", cfg["vclass"], "--vclass", cfg["vclass"]]

    print("\n" + " ".join(cmd))
    subprocess.run(cmd, check=True)
    print(f"  -> {rutas}")
    return rutas


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--net", default=str(DATA / "sangil.net.xml"))
    p.add_argument("--factor", type=float, default=1.0,
                   help="multiplicador global de demanda (1.4 = temporada alta)")
    p.add_argument("--pesados", type=float, default=None,
                   help="segundos entre tractomulas (menor = mas pesados)")
    p.add_argument("--fin", type=int, default=HORA, help="duracion en segundos")
    p.add_argument("--seed", type=int, default=42)
    args = p.parse_args()

    net = Path(args.net)
    if not net.exists():
        sys.exit(f"Falta {net}. Corre primero 01_download_network.py")

    if args.pesados:
        PERIODOS["pesado"]["period"] = args.pesados

    for i, (nombre, cfg) in enumerate(PERIODOS.items()):
        generar(nombre, cfg, net, args.factor, args.fin, args.seed + i)

    print("\nDemanda lista. Siguiente: python src/03_scenarios.py")


if __name__ == "__main__":
    sys.exit(main())
