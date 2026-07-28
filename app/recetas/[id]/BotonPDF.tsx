'use client';
/** v11.0: descarga en PDF vía impresión nativa — tipografía perfecta,
 *  cero librerías. Los estilos @media print limpian la página. */
export function BotonPDF() {
  return (
    <button onClick={() => window.print()} className="btn-secondary no-imprimir" title="Descargar esta receta en PDF (Guardar como PDF)">
      ⬇️ PDF
    </button>
  );
}
