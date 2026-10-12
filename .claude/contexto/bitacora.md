# Bitácora

## 2026-10-08
- Brainstorming y spec aprobado.
- Plan de la etapa 1 escrito.
- Proyecto armado (Task 1).
- `npm run red`: 1620 nodos, 2155 vías, 8 tramos de puente, 1 pare; la
  Variante apareció en OSM (2 km en construcción).
- Mapa verificado en el navegador: tipos, flechas, puentes, Variante
  punteada, ficha, error sin red, ancho de celular.
- Etapa 1 completa en la rama `etapa-1`.
- Repo conectado a GitHub (eri323/MapaSanGil); `main` es la base.
- Hallazgos de la revisión resueltos con TDD (62 pruebas); puentes con nombre común.
- Nombres de los 5 puentes confirmados por el usuario; spec corregido.
- Etapa 2 completa: motor IDM + MOBIL + cruces + rutas + demanda en Web Worker; vehículos en el
  mapa. 158 pruebas. Cerrar el Rojas Pinilla: demora 62 s → 85 s.
- Datos de campo: plaza de mercado, salida a Charalá, Calle 12 (Cra 10 → Cra 11) habilitada.
- Etapa 3 completa: editor (vías, cruces, vías y puentes nuevos, Variante, restricción, doble
  calzada, deshacer) aplicado en vivo. 234 pruebas.
- Etapa 4 completa: escenarios, comparador (worker aparte, mapa de diferencias) y modo
  historia con comparación controlada. La historia se cumple: 67 → 90 → 82 → 57 → 57 s.

## 2026-10-12
- Etapa 5 completa: Cómo funciona, ajustes de la revisión, build en partes, guía de la demo.
  287 pruebas. Merge a `main` y push. Vercel: la conexión de Claude no pudo crear el proyecto (403);
  falta importarlo desde vercel.com/new.
- Camiones y buses nacionales ahora siempre por Avenida y Variante (antes tomaban atajos sin la restricción). 290 pruebas. Merge a `main`.
- La comparación de la historia guardada en el navegador quedó vieja: recalcularla antes de la demo.
