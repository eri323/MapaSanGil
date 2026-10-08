# Estado del proyecto

**Etapa actual:** 2 de 5 terminada — sigue la etapa 3 (editor), 1 – 9 nov 2026
**Plan activo:** ninguno; falta escribir el de la etapa 3
**Rama base:** `main` (GitHub: eri323/MapaSanGil); trabajo en ramas que salen de `main`

## Hecho
- Etapa 2 completa (rama `etapa-2`): motor IDM + MOBIL + cruces (pare por acceso, prioridad,
  glorieta, derecha, cortesía) + rutas con tiempos medidos + demanda por flujos, en Web Worker;
  vehículos en el mapa, reloj, controles y métricas en vivo. 15 min de hora pico se simulan en
  3,3 s. Cerrar el Rojas Pinilla sube la demora media de 62 s a 85 s (+37 %).
- Spec aprobado.
- Etapa 1 completa: red de San Gil descargada de OSM (1620 cruces, 2155 vías,
  1,1 MB), convertida a grafo y dibujada por tipo de vía, con flechas de
  sentido, puentes, pares y fichas de solo lectura.

## Sigue
- Escribir el plan de la etapa 3 (editor de vías y cruces, terminar la Variante, restricción
  de pesados de paso, vías y puentes nuevos).

## Revisión de la etapa 1: resuelta (rama fix/hallazgos-etapa-1)
- Velocidad 0 de OSM se ignora; validación de ids únicos, longitud, velocidad, carriles y
  vías de un nodo a sí mismo; índice `entrantes`; `componentePrincipal` (ida y vuelta).
- Pares por acceso (`accesosConPare`) y nunca en el cruce de salida; respeta `direction`.
- Lazos se parten en vez de perderse; tramos < 0,5 m unen nodos; glorieta con oneway=no.
- URL de datos relativa a la base de la app.
- Pendiente para la etapa 2: el motor debe leer `accesosConPare` (control por acceso).

## Puentes (confirmados por el usuario; nombres en `scripts/datos/puentes.js`)
| Way OSM | Nombre común | Nota |
|---|---|---|
| 24670013 | Rojas Pinilla / Hoja de Tabaco (Avenida) | la estructura es el way 1303782686 (man_made=bridge) |
| 507730974 | Calle 15 | en OSM "La Sagrada Familia" |
| 93347221 | Carrera 1ª | en OSM "Bernardo Gómez Silva" |
| 401818497 | Bella Isla | |
| 401818499 | Salida a Mogotes (Guasca) | |

## Hallazgos de la red real
- Variante en OSM: way 1271241090, unos 2 km en obra; sus extremos quedan fuera del
  componente principal mientras esté en construcción (esperado).
- La doble calzada frente al Terminal sale como dos vías de un sentido paralelas.
- Solo 1 pare en OSM; el resto llega con la lista de campo.
- El área descargada incluye vías rurales (251 km de doble sentido).

## Bloqueos / pendientes del usuario
- Lista de campo: vías con huecos, destapadas, sentidos únicos y pares reales.
