# Estado del proyecto

**Etapa actual:** 1 de 5 terminada — sigue la etapa 2 (motor), 18 – 31 oct 2026
**Plan activo:** ninguno; falta escribir el de la etapa 2
**Rama base:** `main` (GitHub: eri323/MapaSanGil); trabajo en ramas que salen de `main`

## Hecho
- Spec aprobado.
- Etapa 1 completa: red de San Gil descargada de OSM (1620 cruces, 2155 vías,
  1,1 MB), convertida a grafo y dibujada por tipo de vía, con flechas de
  sentido, puentes, pares y fichas de solo lectura.

## Sigue
- Confirmar con el usuario el puente 93347221 y si Hoja de Tabaco = Rojas Pinilla.
- Escribir el plan de la etapa 2 (motor: vehículos, IDM, cruces, rutas, demanda).

## Revisión de la etapa 1: resuelta (rama fix/hallazgos-etapa-1)
- Velocidad 0 de OSM se ignora; validación de ids únicos, longitud, velocidad, carriles y
  vías de un nodo a sí mismo; índice `entrantes`; `componentePrincipal` (ida y vuelta).
- Pares por acceso (`accesosConPare`) y nunca en el cruce de salida; respeta `direction`.
- Lazos se parten en vez de perderse; tramos < 0,5 m unen nodos; glorieta con oneway=no.
- URL de datos relativa a la base de la app.
- Pendiente para la etapa 2: el motor debe leer `accesosConPare` (control por acceso).

## Puentes (nombres en `scripts/datos/puentes.js`)
| Way OSM | Nombre en OSM | Nombre común | Estado |
|---|---|---|---|
| 24670013 | Avenida Ragonessi | Hoja de Tabaco (Avenida) | confirmar si es el "Rojas Pinilla" de la base Python |
| 507730974 | Calle 15 (bridge:name La Sagrada Familia) | Puente de la Calle 15 | ok |
| 401818497 | Puente Bella Isla | Puente Bella Isla (el usuario lo asocia a Ragonessi) | ok |
| 401818499 | Transversal San Gil - Mogotes | Puente del Guasca | ok |
| 93347221 | Puente Bernardo Gómez Silva (al occidente) | ¿Carrera 1ª? | por confirmar |
- Solo 3 vías cruzan el trazado del Fonce en OSM: 93347221, 507730974, 24670013.
- La base Python decía que el Bernardo Gómez es el de la Cl 15; OSM lo pone al occidente.

## Hallazgos de la red real
- Variante en OSM: way 1271241090, unos 2 km en obra; sus extremos quedan fuera del
  componente principal mientras esté en construcción (esperado).
- La doble calzada frente al Terminal sale como dos vías de un sentido paralelas.
- Solo 1 pare en OSM; el resto llega con la lista de campo.
- El área descargada incluye vías rurales (251 km de doble sentido).

## Bloqueos / pendientes del usuario
- Lista de campo: vías con huecos, destapadas, sentidos únicos y pares reales.
