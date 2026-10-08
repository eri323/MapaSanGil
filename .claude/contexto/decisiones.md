# Decisiones

| Fecha | Decisión | Por qué |
|---|---|---|
| 2026-10-08 | JavaScript con React + Vite + MapLibre + deck.gl; sin TypeScript | Lenguaje asignado por el profe; TypeScript podría objetarse |
| 2026-10-08 | Motor microscópico (IDM + MOBIL + Dijkstra con tiempos medidos) en Web Worker | "Lo más real posible"; los vehículos descubren solos las vías arregladas |
| 2026-10-08 | Sin servidor; red de OSM pre-procesada dentro del repo | Corre local con npm y en Vercel igual; la demo no depende de internet |
| 2026-10-08 | San Gil no tiene semáforos: cruces con pare, prioridad o sin señal | Dato de campo del usuario; el semáforo es solo una intervención |
| 2026-10-08 | Sin costos en pesos | El objetivo es ver si el tráfico mejora o empeora, no evaluar inversión |
| 2026-10-08 | Doble calzada como intervención solo en Avenida Nacional y Variante | Indicación del usuario |
| 2026-10-08 | Con la Variante terminada se activa la restricción de pesados de paso (interruptor) | Permite comparar Variante con y sin obligar su uso |
| 2026-10-08 | Dos terminales: Terminal de Transporte (buses nacionales) y Terminalito (intermunicipales) | Dato de campo del usuario |
| 2026-10-08 | Datos de campo: arrancar con OSM + supuestos y corregir en el editor | No frenar el desarrollo esperando la lista |
| 2026-10-08 | Un plan por etapa | La forma real de los datos de OSM condiciona el motor |
| 2026-10-08 | `main` es la rama base; cada trabajo sale en su propia rama | Indicación del usuario |
| 2026-10-08 | Nombres comunes de puentes en `scripts/datos/puentes.js`, por id de OSM | OSM usa otros nombres; manda el conocimiento de campo |
| 2026-10-08 | El pare se guarda por acceso (`accesosConPare`), no solo por cruce | Un pare detiene a quien llega por esa vía, no a todo el cruce |
| 2026-10-08 | Parámetros IDM por tipo de vehículo en `src/sim/vehiculos.js` | Supuestos razonables; se documentan en "Cómo funciona" |
| 2026-10-08 | Estado de la vía multiplica la velocidad deseada (huecos ×0,5, regular ×0,8, destapado ×0,6, adoquín ×0,85) | Es lo que hace que los carros "descubran" una vía arreglada |
| 2026-10-08 | Volúmenes base: 1000 locales, 300 de paso, 120 pesados, 20 buses nacionales, 10 de paso y 30 intermunicipales por hora | Supuestos sin aforos; sirven para comparar escenarios |
| 2026-10-08 | Vehículo quieto más de 180 s se retira y cuenta como bloqueo | Equivale al teleport de SUMO; métrica de colapso |
| 2026-10-08 | Salidas del municipio declaradas a mano en `src/escenarios/zonas.js` | La detección automática daba 40 caminos rurales sin nombre |
| 2026-10-08 | Restricción de pesados de paso se implementa en la etapa 3 | Va con "terminar la Variante" |
| 2026-10-08 | Correcciones de campo sobre OSM en `scripts/datos/correccionesCampo.js`, aplicadas al generar la red | Datos que OSM no tiene; el editor (etapa 3) servirá para cambios de escenario |
| 2026-10-08 | Calle 12 entre Carreras 10 y 11 habilitada, un sentido hacia la Carrera 11 | Dato de campo del usuario; en OSM figura peatonal |
| 2026-10-08 | Plaza de mercado = Mercado cubierto (OSM node 5478495523); salida a Charalá agregada | Confirmado por el usuario |
| 2026-10-08 | Las ediciones son cambios (datos) aplicados sobre la red base; historial con deshacer/rehacer autoguardado en el navegador | Se pueden reproducir, guardar como escenario (etapa 4) y deshacer |
| 2026-10-08 | Un cambio que aísla zonas o salidas, o más de 20 cruces, pide confirmación | Spec §8 |
| 2026-10-08 | Al editar en vivo, los vehículos en arcos que cambiaron se retiran y se cuentan | Evita vehículos en vías que ya no existen o van al revés |
| 2026-10-08 | La Variante de OSM no conecta: el usuario traza los tramos que faltan con la herramienta de vía nueva | OSM solo trae 2 km con extremos sueltos; no hay trazado georreferenciado confiable |
| 2026-10-08 | Restricción de pesados: flujos pesado y busPaso solo por Avenida/Variante fuera de un casco de 1,3 km; si no hay ruta, pasan por el centro | Spec §5; evita viajes imposibles mientras la Variante no conecte |
| 2026-10-08 | Doble calzada: 2 carriles por sentido en toda la Avenida o toda la Variante | Indicación del usuario |
| 2026-10-08 | Escenario = cambios + demanda + restricción; precargados construidos desde la red base | Reproducibles y comparables |
| 2026-10-08 | Carrera 1ª destapada y con huecos como SUPUESTO de campo | La base Python preguntaba si "pavimentada alcanza como vía alterna"; OSM casi no trae estado |
| 2026-10-08 | Variante precargada: une el extremo occidental con la Avenida hacia Socorro y el oriental con la Avenida hacia Bucaramanga, en cruces de ida y vuelta, rodeando el casco | Trazado aproximado; el tramo de OSM está todo al noroccidente |
| 2026-10-08 | Puente propuesto: ≤160 m entre orillas, ≥300 m de los puentes existentes, el más cercano al centro | Ubicación aproximada para la historia; el usuario puede cambiarla |
| 2026-10-08 | Comparador en un worker aparte, misma duración y semillas 1..N, promedio y rango | Spec §7: "¿y si fue suerte?" sin congelar la simulación en vivo |
| 2026-10-08 | La gráfica de la historia usa una comparación controlada de los pasos, no la demora en vivo | En vivo la demora sube con el tiempo (red llenándose, hora pico) y no muestra el efecto de cada cambio |
