export default function Confirmacion({ titulo, children, textoConfirmar = 'Aplicar de todas formas', onConfirmar, onCancelar }) {
  return (
    <div className="modal-fondo" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
      <div className="modal">
        <h2 id="modal-titulo">{titulo}</h2>
        <div className="modal-cuerpo">{children}</div>
        <div className="acciones">
          <button type="button" onClick={onCancelar}>Cancelar</button>
          <button type="button" className="principal" onClick={onConfirmar}>{textoConfirmar}</button>
        </div>
      </div>
    </div>
  );
}
