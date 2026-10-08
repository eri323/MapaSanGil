# Simulación de tráfico urbano — San Gil, Santander

Modelo microscópico de la movilidad de San Gil construido sobre la red vial
real de OpenStreetMap y simulado en SUMO, con foco en los cruces del río Fonce
como cuello de botella del sistema.

## El problema

El **puente Gustavo Rojas Pinilla** es el principal paso sobre el río Fonce en
la vía nacional que atraviesa el municipio. El respaldo urbano es el **puente
Bernardo Gómez Silva** (Cl 15). La solución estructural —la **Variante de San
Gil**, pensada para sacar el tráfico pesado del casco urbano— sigue sin
conectar.

Esto crea una dependencia de punto único: cuando el Rojas Pinilla se interviene,
todo el tráfico —incluido el pesado de la troncal— se vuelca sobre un puente
que no fue diseñado para eso.

Las preguntas que este modelo intenta responder:

1. ¿Cuánto se degrada el sistema si el Rojas Pinilla queda a un carril o cerrado?
2. ¿La carrera 1ª pavimentada alcanza como vía alterna, o solo mueve la cola?
3. ¿Cuánto libera la Variante, comparada con optimizar semáforos?
4. ¿Dónde están los cuellos de botella reales, más allá de los dos puentes?

## Requisitos

```bash
# SUMO
sudo apt install sumo sumo-tools sumo-doc
export SUMO_HOME=/usr/share/sumo        # agrégalo a tu ~/.bashrc

# Python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Uso

```bash
# 1. Descargar San Gil desde OSM y convertir a red SUMO
python src/01_download_network.py

# 2. Generar demanda (local + pasante + pesado)
python src/02_demand.py

# 3. Encontrar el ID interno del puente y correr escenarios
python src/03_scenarios.py --list-edges "Rojas"
python src/03_scenarios.py --scenario base
python src/03_scenarios.py --scenario obra_rp --closed-edge <EDGE_ID>

# 4. Comparar
python src/04_analyze.py
```

Para ver la simulación corriendo, agrega `--gui` al paso 3.

## Escenarios

| Escenario | Qué representa | Cómo se implementa |
|---|---|---|
| `base` | Situación actual | Red OSM tal cual |
| `obra_rp` | Rojas Pinilla en mantenimiento | `<rerouter>` con `closingReroute` aguas arriba |
| `actuated` | Semáforos adaptativos | `01_download_network.py --actuated` |
| `variante` | Variante operando | Aristas nuevas vía `netconvert` (ver abajo) |
| temporada alta | Turismo, festivos | `02_demand.py --factor 1.4` |

### Agregar la Variante

La Variante no está en OSM como vía transitable porque no lo es. Para simularla,
crea `data/variante.nod.xml` y `data/variante.edg.xml` con la geometría del
trazado y fusiónalos con la red existente:

```bash
netconvert -s data/sangil.net.xml \
           -n data/variante.nod.xml -e data/variante.edg.xml \
           -o data/sangil_variante.net.xml
```

Las coordenadas del trazado están en la ficha del proyecto de Santander
Competitivo (abscisado K0+000 a K9+500, con puente sobre el Fonce entre
K2+300 y K2+660). Georreferéncialas antes de usarlas.

## Limitaciones — léelas antes de citar cualquier número

Este modelo **no está calibrado**. Los volúmenes en `02_demand.py` son supuestos
razonables, no mediciones. Eso significa:

- Sirve para **comparar escenarios entre sí** ("cerrar el puente empeora la
  demora un X %").
- **No sirve** para predecir tiempos de viaje absolutos ni para sustentar
  una decisión de inversión.

Riesgos adicionales que debes verificar:

- **Completitud de OSM.** En municipios pequeños de Colombia es común que
  falten sentidos únicos (`oneway`), semáforos (`highway=traffic_signals`),
  restricciones de giro y número de carriles. Cada dato faltante mete un
  sesgo. Revisa la zona en openstreetmap.org y corrige lo que veas mal — eres
  de San Gil, tienes conocimiento de campo que ningún mapeador remoto tiene.
- **Motos.** San Gil tiene una participación de motocicletas muy superior a la
  que asume cualquier modelo por defecto. Su comportamiento (filtrado entre
  carriles, aceptación de brechas cortas) cambia la capacidad efectiva. SUMO
  lo modela con `--lateral-resolution` y un `vType` de vClass `motorcycle`;
  hay que agregarlo y parametrizarlo.
- **Tráfico inducido.** Si la Variante mejora los tiempos, aparecen viajes que
  hoy no se hacen. Un modelo de asignación de una sola hora no lo captura.

## Cómo calibrarlo

En orden de valor por esfuerzo:

1. **Aforos direccionales clasificados** en ambos puentes: 3 días típicos
   (mar–jue) más 1 festivo, en hora pico AM y PM, separando auto / moto /
   bus / camión. Se puede hacer con video y conteo manual; es el dato que
   convierte esto en algo defendible.
2. **TPD del INVÍAS** en el corredor de la troncal, para separar el pasante
   del local.
3. **Tiempos de ciclo semafórico** reales en las aproximaciones a los puentes.
4. **Matriz origen–destino** aproximada: encuesta de placas en cordón, o
   datos agregados de telefonía si consigues acceso.

Criterio de validación: el modelo está calibrado cuando los flujos simulados
en las aristas aforadas quedan dentro de ±15 % de los conteos reales en al
menos el 85 % de los puntos (criterio GEH < 5, estándar en ingeniería de
tránsito).

## Estructura

```
sangil-traffic/
├── src/
│   ├── 01_download_network.py   OSM → red SUMO + inventario de puentes
│   ├── 02_demand.py             genera local / pasante / pesado
│   ├── 03_scenarios.py          cierres, medición, ejecución
│   └── 04_analyze.py            comparación entre escenarios
├── data/                        red y demanda generadas
└── resultados/<escenario>/      salidas de cada corrida
```

## Licencia de los datos

Los datos de la red provienen de OpenStreetMap, © colaboradores de OSM,
bajo Open Database License (ODbL). Cualquier publicación derivada debe
atribuirlo.
