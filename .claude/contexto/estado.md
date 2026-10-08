# Estado del proyecto

**Etapa actual:** 1 de 5 terminada — sigue la etapa 2 (motor), 18 – 31 oct 2026
**Plan activo:** ninguno; falta escribir el de la etapa 2
**Rama:** `etapa-1` (pendiente de revisión con agentes y merge a `master`)

## Hecho
- Spec aprobado.
- Etapa 1 completa: red de San Gil descargada de OSM (1620 cruces, 2155 vías,
  1,1 MB), convertida a grafo y dibujada por tipo de vía, con flechas de
  sentido, puentes, pares y fichas de solo lectura.

## Sigue
- Revisión de la rama `etapa-1` con agentes (pedido por el usuario).
- Escribir el plan de la etapa 2 (motor: vehículos, IDM, cruces, rutas, demanda).
- Revisar con el usuario qué vías salieron mal clasificadas en OSM.

## Hallazgos de la red real (para confirmar con el usuario)
- La Variante SÍ está en OSM como obra: way 1271241090, unos 2 km.
- El puente Rojas Pinilla no aparece con ese nombre. Candidato: puente de
  la "Avenida Ragonessi" (way 24670013, 46 m, sobre la Avenida).
- Puente Bernardo Gómez Silva: way 93347221 (88 m).
- La doble calzada frente al Terminal sale como dos vías de un sentido
  paralelas (OSM no trae la etiqueta de doble calzada).
- Solo 1 pare en OSM; el resto llega con la lista de campo.
- El área descargada incluye vías rurales (251 km de doble sentido).

## Bloqueos / pendientes del usuario
- Lista de campo: vías con huecos, destapadas, sentidos únicos y pares reales.
