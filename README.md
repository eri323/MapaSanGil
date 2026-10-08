# Simulador de tráfico · San Gil

Mapa de San Gil (Santander) con tráfico simulado. Permite editar la red vial
para comparar cómo mejora o empeora el tráfico con distintos cambios.

## Correr en local

Requiere Node 20 o superior.

    npm install
    npm run dev

Abre la dirección que muestra la terminal (normalmente http://localhost:5173).

## Usar el simulador

1. Dale **▶ Simular** en la barra superior. El reloj arranca a las 07:00.
2. Cambia la velocidad con ×1, ×5, ×20 o Máx.
3. En el panel **Tráfico** ajusta la cantidad de vehículos, la temporada y la hora de inicio.
4. Activa **Colorear vías por: Congestión** para ver dónde se forman las colas.
5. El panel **Métricas** muestra tiempo de viaje, demora, bloqueos y los cuellos de botella del momento.

El modelo no está calibrado con aforos: sirve para comparar escenarios entre sí,
no para predecir tiempos exactos.

### Editar la red

- **Clic en una vía**: cerrarla o abrirla, cambiar sentido, estado, superficie, velocidad y carriles.
- **Clic en un cruce** (punto gris): pare, prioridad, sin señal o semáforo.
- **＋ Vía o puente nuevo**: marca el trazado en el mapa. Si cruza el río, queda como puente.
- **Variante**: traza los tramos que faltan hasta la Avenida y dale "Terminar la Variante".
  Con la restricción activa, los pesados de paso dejan de cruzar el centro.
- **Deshacer / Rehacer** con los botones o Ctrl+Z / Ctrl+Y. Los cambios se guardan en el navegador.

### Escenarios, comparador e historia

- **Escenarios**: guarda el estado actual con un nombre, cárgalo después, descárgalo como
  archivo o importa uno. Hay escenarios precargados (temporada alta, obra en el Rojas
  Pinilla, Variante terminada, puente nuevo propuesto).
- **Comparar**: escoge dos o más escenarios; corren sin dibujar con la misma duración y
  varias semillas. Ves promedio y rango de cada métrica, la gráfica de demora y un mapa de
  dónde mejoró o empeoró el tráfico.
- **Historia**: la demo de clase paso a paso. Avanza con ▶ o las flechas del teclado; cada
  paso aplica sus cambios sobre la simulación en curso. La gráfica muestra la comparación
  controlada de los pasos (30 min simulados, 2 semillas), calculada al empezar.

La Variante y el puente propuesto de los precargados usan trazados aproximados.

## Otros comandos

- `npm test` — pruebas del motor de simulación
- `npm run build` — build de producción en `dist/`
- `npm run red` — vuelve a descargar la red vial de OpenStreetMap

## Datos

La red vial proviene de OpenStreetMap, © colaboradores de OSM, bajo licencia
ODbL.

La base original en Python con SUMO está en `python-original/`.
