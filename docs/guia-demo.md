# Guía de la demo y la sustentación

## Antes de la clase

1. Abre el link publicado (README) en el computador de la presentación, con internet.
2. Ve a **Historia** y dale **Empezar** a "Cómo mejora San Gil". La primera vez calcula la
   comparación controlada de los pasos (unos minutos); queda guardada en ese navegador.
   Hazlo antes de clase para que en vivo salga al instante. Luego dale **Salir**.
3. Si vas a usar tus propios cambios (por ejemplo, tu trazado de la Variante), guárdalos como
   escenario y descárgalos (⬇) como respaldo.

## Guion (unos 10 minutos)

1. **El mapa** (1 min). San Gil real desde OpenStreetMap: tipos de vía, sentidos, los cinco
   puentes. "No hay semáforos: pares, prioridad y la regla de la derecha."
2. **El tráfico** (1 min). ▶ Simular a ×5. Colorear por congestión. Señalar los cuellos de
   botella en el panel.
3. **Un cambio en vivo** (1 min). Clic en el Puente Rojas Pinilla → Cerrar vía. La Calle 15 se
   vuelve el cuello de botella. Ctrl+Z para deshacer.
4. **La historia** (4 min). Historia → "Cómo mejora San Gil". Avanza con →:
   - Temporada alta: la demora sube.
   - Puente nuevo: baja un poco; el tráfico se reparte entre orillas.
   - Variante con restricción: baja fuerte; los camiones salen del centro.
   - Vías arregladas: casi no cambia → es un hallazgo (ver preguntas).
   La gráfica de barras es una comparación controlada, no la corrida en vivo.
5. **Cómo se llegó a los números** (2 min). Comparar → escoge dos escenarios: mismas semillas,
   promedio y rango. Mapa de diferencias en verde y rojo.
6. **Cómo funciona** (1 min). Abre la pestaña: IDM, MOBIL, Dijkstra, supuestos y limitaciones.

## Preguntas que pueden hacer

- **¿Estos tiempos son reales?** No: el modelo no está calibrado con aforos. Sirve para comparar
  escenarios entre sí con las mismas condiciones. Para calibrarlo harían falta conteos en los
  puentes (criterio GEH < 5).
- **¿Y si la diferencia fue suerte?** Cada escenario corre con varias semillas; si los rangos no
  se tocan, la diferencia no es casualidad.
- **¿Por qué arreglar vías casi no ayudó?** Con el supuesto actual (Carrera 1ª), arreglarla no
  atrae tráfico suficiente porque no está en las rutas más usadas. Con la lista real de vías en mal
  estado el resultado podría cambiar; también puede ser un hallazgo: no toda obra ayuda.
- **¿Cómo deciden la ruta los carros?** La más rápida según el tiempo que se está midiendo en cada
  vía; la recalculan cada 90 s, por eso "descubren" una vía arreglada poco a poco.
- **¿La Variante es la real?** El tramo en construcción sale de OpenStreetMap; los tramos que
  faltan son un trazado aproximado. Se puede redibujar en el editor.
- **¿Qué hizo la IA?** Ayudó a diseñar y escribir el código por etapas; las decisiones, los datos
  de campo y la validación de cada etapa quedaron documentados en `.claude/contexto/` y
  `docs/superpowers/`.
