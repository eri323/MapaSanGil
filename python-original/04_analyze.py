"""
Paso 4 — Comparar escenarios.

Lee tripinfo.xml y edgedata.xml de cada escenario en resultados/ y produce
una tabla comparable mas el ranking de aristas saturadas (los cuellos de
botella reales, no los que uno supone).

Metricas:
    viajes            vehiculos que completaron su viaje
    duracion_med      tiempo medio de viaje (s)
    demora_med        timeLoss medio: segundos perdidos vs viaje libre (s)
    demora_total_vh   demora agregada en vehiculo-hora
    teleports         sintoma de gridlock: SUMO tuvo que teletransportar
                      vehiculos atascados. Si sube mucho, el escenario colapso.

Uso:
    python src/04_analyze.py
    python src/04_analyze.py --top 15
"""

import argparse
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "resultados"


def leer_tripinfo(path: Path):
    if not path.exists():
        return None
    dur, loss, espera = [], [], []
    for _, elem in ET.iterparse(path, events=("end",)):
        if elem.tag != "tripinfo":
            continue
        dur.append(float(elem.get("duration", 0)))
        loss.append(float(elem.get("timeLoss", 0)))
        espera.append(float(elem.get("waitingTime", 0)))
        elem.clear()
    if not dur:
        return None
    return {
        "viajes": len(dur),
        "duracion_med": sum(dur) / len(dur),
        "demora_med": sum(loss) / len(loss),
        "demora_total_vh": sum(loss) / 3600.0,
        "espera_med": sum(espera) / len(espera),
    }


def leer_teleports(path: Path):
    if not path.exists():
        return 0
    total = 0
    for _, elem in ET.iterparse(path, events=("end",)):
        if elem.tag == "step":
            total = max(total, int(elem.get("teleports", 0)))
            elem.clear()
    return total


def leer_edgedata(path: Path, top: int):
    """Aristas ordenadas por densidad media: el ranking de cuellos de botella."""
    if not path.exists():
        return []
    acum = {}
    for _, elem in ET.iterparse(path, events=("end",)):
        if elem.tag != "edge":
            continue
        eid = elem.get("id")
        dens = float(elem.get("density", 0))
        ocup = float(elem.get("occupancy", 0))
        vel = float(elem.get("speed", 0) or 0)
        d = acum.setdefault(eid, {"dens": [], "ocup": [], "vel": []})
        d["dens"].append(dens)
        d["ocup"].append(ocup)
        d["vel"].append(vel)
        elem.clear()
    filas = []
    for eid, d in acum.items():
        n = len(d["dens"])
        filas.append((eid, sum(d["dens"]) / n, sum(d["ocup"]) / n,
                      sum(d["vel"]) / n))
    filas.sort(key=lambda r: -r[1])
    return filas[:top]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--top", type=int, default=10)
    args = p.parse_args()

    if not OUT.exists():
        sys.exit(f"No existe {OUT}. Corre 03_scenarios.py primero.")

    escenarios = sorted(d for d in OUT.iterdir() if d.is_dir())
    if not escenarios:
        sys.exit("No hay escenarios simulados todavia.")

    print(f"\n{'escenario':<12} {'viajes':>7} {'dur.med':>9} {'demora.med':>11} "
          f"{'demora.tot':>11} {'teleports':>10}")
    print("-" * 64)

    base = None
    for d in escenarios:
        m = leer_tripinfo(d / "tripinfo.xml")
        if not m:
            print(f"{d.name:<12}  (sin tripinfo.xml)")
            continue
        m["teleports"] = leer_teleports(d / "summary.xml")
        if d.name == "base":
            base = m
        print(f"{d.name:<12} {m['viajes']:>7} {m['duracion_med']:>8.0f}s "
              f"{m['demora_med']:>10.0f}s {m['demora_total_vh']:>10.1f}h "
              f"{m['teleports']:>10}")

    if base:
        print("\nVariacion de demora total frente al escenario base:")
        for d in escenarios:
            if d.name == "base":
                continue
            m = leer_tripinfo(d / "tripinfo.xml")
            if not m or base["demora_total_vh"] == 0:
                continue
            delta = (m["demora_total_vh"] / base["demora_total_vh"] - 1) * 100
            signo = "+" if delta >= 0 else ""
            print(f"  {d.name:<12} {signo}{delta:.1f} %")

    for d in escenarios:
        filas = leer_edgedata(d / "edgedata.xml", args.top)
        if not filas:
            continue
        print(f"\nCuellos de botella en '{d.name}' (por densidad media):")
        print(f"  {'arista':<24} {'dens veh/km':>12} {'ocupacion':>10} {'vel m/s':>9}")
        for eid, dens, ocup, vel in filas:
            print(f"  {eid:<24} {dens:>12.1f} {ocup:>9.1f}% {vel:>9.1f}")

    print("\nRecordatorio: sin aforos reales estas cifras solo sirven para "
          "comparar escenarios entre si, no como pronostico.")


if __name__ == "__main__":
    sys.exit(main())
