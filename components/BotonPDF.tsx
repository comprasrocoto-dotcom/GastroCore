'use client';
/** v11.1 — PDF DE OBRA (descarga real, no impresión): banda de color con el
 *  nombre, resumen, tabla de ingredientes con cebra, ficha técnica en texto
 *  y pie con paginación. Un solo componente para recetas y subrecetas:
 *  bebe del recurso /api/exportacion (todo unido, ya probado). */
import { useState } from 'react';

type Linea = { item: string; tipo: string; cantidad: number; unidad: string; merma_pct: number; costo_unitario: number; costo_linea: number };
type Item = { id: string; nombre: string; referencia: string; familia?: string; rendimiento: number; unidad_rendimiento?: string; costo_total: number; costo_unitario?: number; food_cost?: number; precio_real?: number; ingredientes: Linea[]; ficha: { preparacion: string; uso: string; notas: string } | null };

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO');

export function BotonPDF({ id, tipo }: { id: string; tipo: 'receta' | 'subreceta' }) {
  const [trabajando, setTrabajando] = useState(false);

  async function descargar() {
    if (trabajando) return;
    setTrabajando(true);
    try {
      const r = await fetch('/api/exportacion', { cache: 'no-store' }).then((x) => x.json());
      if (!r.ok) throw new Error('No se pudo leer la información');
      const it: Item | undefined = (tipo === 'receta' ? r.data.recetas : r.data.subrecetas).find((x: Item) => String(x.id) === String(id));
      if (!it) throw new Error('No se encontró la preparación');
      const negocio: string = r.data.negocio || 'GastroCore';

      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const color: [number, number, number] = tipo === 'subreceta' ? [180, 83, 9] : [30, 58, 95];
      const gris: [number, number, number] = [100, 116, 139];

      // ── banda de título ──
      doc.setFillColor(...color);
      doc.rect(0, 0, 210, 26, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(it.nombre, 14, 12, { maxWidth: 150 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text([it.referencia, it.familia, tipo === 'subreceta' ? 'SUBRECETA' : 'RECETA'].filter(Boolean).join('   ·   '), 14, 20);
      doc.setFontSize(8);
      doc.text(negocio, 196, 12, { align: 'right' });

      // ── resumen ──
      doc.setTextColor(...gris);
      doc.setFontSize(9);
      const resumen = tipo === 'subreceta'
        ? `Rinde ${it.rendimiento.toLocaleString('es-CO')} ${it.unidad_rendimiento || ''}    ·    Costo total ${money(it.costo_total)}    ·    Costo por ${it.unidad_rendimiento || 'unidad'} ${'$' + (it.costo_unitario || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })}`
        : `${it.rendimiento} porción(es)    ·    Costo del plato ${money(it.costo_total)}    ·    Precio real ${it.precio_real ? money(it.precio_real) : 'sin precio'}    ·    Food Cost ${it.food_cost ? (it.food_cost * 100).toFixed(1) + '%' : '—'}`;
      doc.text(resumen, 14, 33);

      // ── tabla de ingredientes ──
      autoTable(doc, {
        startY: 38,
        head: [['Ingrediente', 'Tipo', 'Cantidad', 'Unidad', '% Merma', 'Costo unit.', 'Costo línea']],
        body: it.ingredientes.map((g) => [g.item, g.tipo, g.cantidad.toLocaleString('es-CO'), g.unidad, g.merma_pct ? g.merma_pct + '%' : '', money(g.costo_unitario), money(g.costo_linea)]),
        theme: 'plain',
        headStyles: { fillColor: color, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 2: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
        styles: { lineColor: [226, 232, 240], lineWidth: 0.1, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });

      // ── ficha técnica ──
      let y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || 60) + 10;
      if (it.ficha && (it.ficha.preparacion || it.ficha.uso || it.ficha.notas)) {
        const secciones: [string, string][] = [['PREPARACIÓN', it.ficha.preparacion], ['USO / MONTAJE', it.ficha.uso], ['NOTAS', it.ficha.notas]];
        secciones.filter(([, v]) => v).forEach(([titulo, texto]) => {
          const lineas = doc.splitTextToSize(texto, 182);
          if (y + lineas.length * 4.4 + 12 > 282) { doc.addPage(); y = 20; }
          doc.setTextColor(...color);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.text(titulo, 14, y);
          doc.setDrawColor(...color);
          doc.setLineWidth(0.4);
          doc.line(14, y + 1.3, 196, y + 1.3);
          y += 6;
          doc.setTextColor(51, 65, 85);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.text(lineas, 14, y);
          y += lineas.length * 4.4 + 7;
        });
      }

      // ── pie con paginación ──
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7.5);
        doc.text(negocio + '  ·  ' + new Date().toLocaleDateString('es-CO'), 14, 291);
        doc.text('Página ' + p + ' de ' + total, 196, 291, { align: 'right' });
      }
      doc.save(it.nombre.replace(/[\\/:*?"<>|]/g, '') + '.pdf');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'No se pudo generar el PDF');
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <button onClick={descargar} disabled={trabajando} className="btn-secondary no-imprimir disabled:opacity-50" title="Descargar esta preparación en PDF">
      {trabajando ? 'Generando…' : '⬇️ PDF'}
    </button>
  );
}
