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

## Otros comandos

- `npm test` — pruebas del motor de simulación
- `npm run build` — build de producción en `dist/`
- `npm run red` — vuelve a descargar la red vial de OpenStreetMap

## Datos

La red vial proviene de OpenStreetMap, © colaboradores de OSM, bajo licencia
ODbL.

La base original en Python con SUMO está en `python-original/`.
