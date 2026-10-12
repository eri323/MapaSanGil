import { useMemo } from 'react';
import { construirContenido } from './contenido.js';

export default function ComoFunciona({ red, onCerrar }) {
  const { secciones } = useMemo(() => construirContenido({ vias: red?.vias.size, cruces: red?.nodos.size }), [red]);
  return (
    <div className="como-funciona" role="dialog" aria-modal="true" aria-labelledby="como-funciona-titulo">
      <div className="como-funciona-contenido">
        <header>
          <h1 id="como-funciona-titulo">Cómo funciona el simulador</h1>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">×</button>
        </header>
        <nav className="indice" aria-label="Secciones">
          {secciones.map((s) => <a key={s.id} href={`#cf-${s.id}`}>{s.titulo}</a>)}
        </nav>
        {secciones.map((s) => (
          <section key={s.id} id={`cf-${s.id}`}>
            <h2>{s.titulo}</h2>
            {s.texto.map((p) => <p key={p}>{p}</p>)}
            {s.formula && <pre className="formula">{s.formula}</pre>}
            {s.lista && <ul>{s.lista.map((x) => <li key={x}>{x}</li>)}</ul>}
            {s.tabla && (
              <div className="tabla-scroll">
                <table>
                  <thead><tr>{s.tabla.columnas.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {s.tabla.filas.map((fila) => (
                      <tr key={fila[0]}>{fila.map((celda, i) => <td key={`${fila[0]}-${i}`}>{celda}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
