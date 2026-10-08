# Simulador de tráfico · San Gil

Mapa de San Gil (Santander) con tráfico simulado. Permite editar la red vial
para comparar cómo mejora o empeora el tráfico con distintos cambios.

## Correr en local

Requiere Node 20 o superior.

    npm install
    npm run dev

Abre la dirección que muestra la terminal (normalmente http://localhost:5173).

## Otros comandos

- `npm test` — pruebas del motor de simulación
- `npm run build` — build de producción en `dist/`
- `npm run red` — vuelve a descargar la red vial de OpenStreetMap

## Datos

La red vial proviene de OpenStreetMap, © colaboradores de OSM, bajo licencia
ODbL.

La base original en Python con SUMO está en `python-original/`.
