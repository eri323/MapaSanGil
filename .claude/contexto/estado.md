# Estado del proyecto

**Etapa actual:** 5 de 5 terminada — proyecto listo para la demo
**En línea:** https://mapa-san-gil.vercel.app (Vercel, proyecto `mapa-san-gil`; cada push a `main` publica)
**Plan activo:** ninguno
**Rama base:** `main` (GitHub: eri323/MapaSanGil); trabajo en ramas que salen de `main`

## Hecho
- Etapa 5 completa (rama `etapa-5`, en `main`): pestaña "Cómo funciona" armada desde las constantes
  del motor; vehículos que no pueden entrar cuentan como bloqueo; el worker se pausa ante un error;
  sin viajes completados se muestra "—"; el pare sobrevive a invertir una vía; nombres de escenario
  sin choques; build en partes; guía de la demo en `docs/guia-demo.md`. 287 pruebas.
- Etapa 4 completa: escenarios (guardar/cargar/exportar/importar, precargados), comparador
  en worker aparte (promedio y rango, gráfica, mapa de diferencias) y modo historia.
  Historia "Cómo mejora" medida en condiciones controladas (30 min × 2 semillas):
  hoy 67 s → temporada alta 90 s → + puente 82 s → + Variante con restricción 57 s →
  + vías arregladas 57 s (casi sin efecto con el supuesto de la Carrera 1ª).
- Etapa 3 completa (rama `etapa-3`): editor en vivo — vías (cerrar, sentido, estado,
  superficie, velocidad, carriles), cruces (pare por acceso, prioridad, sin señal, semáforo),
  vías y puentes nuevos (detecta el Fonce), tramos de Variante, terminar obra, restricción de
  pesados con casco de 1,3 km, doble calzada en Avenida/Variante, deshacer/rehacer con
  autoguardado y aviso de partes aisladas. En el navegador: cerrar el Rojas Pinilla vuelve
  el puente de la Calle 15 el cuello de botella (demora 49 s → 1 min 26 s).
- Etapa 2 completa (rama `etapa-2`): motor IDM + MOBIL + cruces (pare por acceso, prioridad,
  glorieta, derecha, cortesía) + rutas con tiempos medidos + demanda por flujos, en Web Worker;
  vehículos en el mapa, reloj, controles y métricas en vivo. 15 min de hora pico se simulan en
  3,3 s. Cerrar el Rojas Pinilla sube la demora media de 62 s a 85 s (+37 %).
- Spec aprobado.
- Etapa 1 completa: red de San Gil descargada de OSM (1620 cruces, 2155 vías,
  1,1 MB), convertida a grafo y dibujada por tipo de vía, con flechas de
  sentido, puentes, pares y fichas de solo lectura.

## Sigue
- Antes de la demo: abrir la historia "Cómo mejora San Gil" en el navegador de la presentación para
  recalcular la comparación (cambió con el arreglo de pesados).
- Ensayar la demo con `docs/guia-demo.md`; cargar la lista real de vías con huecos cuando esté.

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
- Lista real de vías con huecos/destapadas (hoy la Carrera 1ª es un SUPUESTO en `scripts/datos/correccionesCampo.js`).
- Confirmar o redibujar el trazado de la Variante y la ubicación del puente propuesto.
- Trazar en el editor los tramos que faltan de la Variante (OSM solo trae 2 km con los extremos sueltos).
- Lista de campo: vías con huecos, destapadas, sentidos únicos y pares reales.
