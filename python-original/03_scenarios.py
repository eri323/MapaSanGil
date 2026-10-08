"""
Paso 3 — Construir escenarios y correr la simulacion.

Escenarios:
    base        red actual tal como esta en OSM
    obra_rp     Rojas Pinilla cerrado (o a un carril)
    variante    se agrega la Variante como arista nueva
    actuated    semaforos actuados (requiere 01 con --actuated)

El cierre no se hace borrando la arista: se colocan <rerouter> en las
aristas aguas arriba, que es como SUMO modela un desvio real. Los
conductores encuentran el cierre y buscan otra ruta, igual que en la calle.

Uso:
    python src/03_scenarios.py --list-edges "Rojas"
    python src/03_scenarios.py --scenario base
    python src/03_scenarios.py --scenario obra_rp --closed-edge <EDGE_ID>
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
OUT = Path(__file__).resolve().parent.parent / "resultados"

if os.environ.get("SUMO_HOME"):
    sys.path.append(str(Path(os.environ["SUMO_HOME"]) / "tools"))
import sumolib  # noqa: E402


def listar_aristas(net_file: Path, patron: str):
    """Encuentra el ID interno de SUMO a partir del nombre de la calle."""
    net = sumolib.net.readNet(str(net_file))
    patron = patron.lower()
    hallados = []
    for e in net.getEdges():
        nombre = (e.getName() or "")
        if patron in nombre.lower() or patron in e.getID().lower():
            hallados.append((e.getID(), nombre, round(e.getLength(), 1),
                             e.getLaneNumber()))
    if not hallados:
        print(f"Nada coincide con '{patron}'. "
              f"Prueba con parte del nombre o revisa data/puentes.csv")
    for eid, nombre, largo, carriles in hallados:
        print(f"  {eid:<24} {largo:>7.1f} m  {carriles} carril(es)  {nombre}")
    return hallados


def aristas_aguas_arriba(net, edge_id: str, profundidad: int = 3):
    """Aristas desde las que un conductor aun puede desviarse antes del cierre."""
    objetivo = net.getEdge(edge_id)
    vistas, frontera = set(), [objetivo]
    for _ in range(profundidad):
        siguiente = []
        for e in frontera:
            for entrante in e.getIncoming():
                eid = entrante.getID()
                if eid not in vistas and eid != edge_id:
                    vistas.add(eid)
                    siguiente.append(entrante)
        frontera = siguiente
    return sorted(vistas)


def escribir_cierre(net_file: Path, edge_id: str, salida: Path,
                    inicio: int, fin: int):
    net = sumolib.net.readNet(str(net_file))
    upstream = aristas_aguas_arriba(net, edge_id)
    if not upstream:
        sys.exit(f"No hay aristas aguas arriba de {edge_id}; revisa el ID.")

    with open(salida, "w", encoding="utf-8") as f:
        f.write("<additional>\n")
        f.write(f'  <rerouter id="cierre_{edge_id}" edges="{" ".join(upstream)}">\n')
        f.write(f'    <interval begin="{inicio}" end="{fin}">\n')
        f.write(f'      <closingReroute id="{edge_id}" disallow="all"/>\n')
        f.write("    </interval>\n  </rerouter>\n</additional>\n")
    print(f"Cierre de {edge_id} con {len(upstream)} rerouters -> {salida}")


def escribir_medicion(salida: Path, periodo: int = 300):
    with open(salida, "w", encoding="utf-8") as f:
        f.write("<additional>\n")
        f.write(f'  <edgeData id="flujos" file="edgedata.xml" '
                f'period="{periodo}" excludeEmpty="true"/>\n')
        f.write("</additional>\n")
    print(f"Medicion por arista -> {salida}")


def escribir_sumocfg(cfg: Path, net: Path, rutas, adicionales, fin: int):
    r = ",".join(str(x.name) for x in rutas)
    a = ",".join(str(x.name) for x in adicionales)
    cfg.write_text(f"""<configuration>
  <input>
    <net-file value="{net.name}"/>
    <route-files value="{r}"/>
    <additional-files value="{a}"/>
  </input>
  <time><begin value="0"/><end value="{fin}"/></time>
  <processing>
    <time-to-teleport value="300"/>
    <lateral-resolution value="0.8"/>
  </processing>
  <report><no-step-log value="true"/><duration-log.statistics value="true"/></report>
</configuration>
""", encoding="utf-8")
    print(f"Config -> {cfg}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--net", default=str(DATA / "sangil.net.xml"))
    p.add_argument("--list-edges", help="buscar el ID de una calle por nombre")
    p.add_argument("--scenario", default="base",
                   choices=["base", "obra_rp", "variante", "actuated"])
    p.add_argument("--closed-edge", help="ID de la arista a cerrar")
    p.add_argument("--fin", type=int, default=3600)
    p.add_argument("--gui", action="store_true", help="correr con sumo-gui")
    args = p.parse_args()

    net = Path(args.net)
    if not net.exists():
        sys.exit(f"Falta {net}. Corre primero 01_download_network.py")

    if args.list_edges:
        listar_aristas(net, args.list_edges)
        return 0

    esc = args.scenario
    dir_esc = OUT / esc
    dir_esc.mkdir(parents=True, exist_ok=True)

    rutas = [DATA / f"{n}.rou.xml" for n in ("local", "pasante", "pesado")]
    faltan = [r for r in rutas if not r.exists()]
    if faltan:
        sys.exit(f"Faltan rutas: {faltan}. Corre 02_demand.py")

    adicionales = [dir_esc / "medicion.add.xml"]
    escribir_medicion(adicionales[0])

    if esc == "obra_rp":
        if not args.closed_edge:
            sys.exit("obra_rp necesita --closed-edge. "
                     "Encuentra el ID con --list-edges Rojas")
        cierre = dir_esc / "cierre.add.xml"
        escribir_cierre(net, args.closed_edge, cierre, 0, args.fin)
        adicionales.append(cierre)

    # copiar entradas al directorio del escenario para que el cfg sea portable
    import shutil
    shutil.copy(net, dir_esc / net.name)
    for r in rutas:
        shutil.copy(r, dir_esc / r.name)

    cfg = dir_esc / "sim.sumocfg"
    escribir_sumocfg(cfg, net, rutas, adicionales, args.fin)

    binario = "sumo-gui" if args.gui else "sumo"
    cmd = [binario, "-c", cfg.name,
           "--tripinfo-output", "tripinfo.xml",
           "--summary-output", "summary.xml"]
    print("\n" + " ".join(cmd) + f"   (cwd={dir_esc})")
    subprocess.run(cmd, cwd=dir_esc, check=False)
    print(f"\nResultados en {dir_esc}. Siguiente: python src/04_analyze.py")


if __name__ == "__main__":
    sys.exit(main())
