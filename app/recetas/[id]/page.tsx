import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getReceta, getSubfamilias, getFamilias } from '@/lib/api/gastrocore';
import { foodCost as calcFoodCost, precioSugerido as calcPrecioSugerido, utilidad as calcUtilidad, margenBruto as calcMargenBruto } from '@/lib/costeo';

export const dynamic = 'force-dynamic';

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0);
const money2 = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(Number(n) || 0);
const fcPct = (n: number) => ((Number(n) || 0) * 100).toFixed(2) + '%';
const num = (n: number, d = 1) => (Number(n) || 0).toFixed(d);

function fecha(s?: string) {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

function semaforo(fc: number) {
  const v = Number(fc) || 0;
  if (v <= 0.33) return { hex: '#16A34A', color: 'bg-[#16A34A]', text: 'text-[#16A34A]', bg: 'bg-[#DCFCE7]', border: 'border-[#BBF7D0]', label: 'Rentable' };
  if (v <= 0.35) return { hex: '#F59E0B', color: 'bg-[#F59E0B]', text: 'text-[#B45309]', bg: 'bg-[#FEF3C7]', border: 'border-[#FDE68A]', label: 'En limite' };
  return { hex: '#DC2626', color: 'bg-[#DC2626]', text: 'text-[#DC2626]', bg: 'bg-[#FEE2E2]', border: 'border-[#FECACA]', label: 'Critico' };
}

export default async function RecetaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [receta, subfamilias, familias] = await Promise.all([
    getReceta(id),
    getSubfamilias().catch(() => []),
    getFamilias().catch(() => []),
  ]);
  if (!receta) notFound();

  const sub = subfamilias.find((s: any) => s.id === receta.subfamilia_id);
  const fam = sub ? familias.find((f: any) => f.id === sub.familia_id) : null;
  const ingredientes = receta.ingredientes || [];

  const rendimiento = Number(receta.rendimiento) || 1;
  const desvioPct = Number(receta.desvio_pct) || 0;
  const costoIngredientes = ingredientes.reduce((a: number, g: any) => a + (Number(g.costo_linea) || 0), 0);
  const costoMerma = ingredientes.reduce((a: number, g: any) => {
    const base = (Number(g.cantidad) || 0) * (Number(g.costo_unitario) || 0);
    const conMerma = Number(g.costo_linea) || 0;
    return a + Math.max(0, conMerma - base);
  }, 0);
  const desvioValor = costoIngredientes * (desvioPct / 100);
  const costoFinal = Number(receta.costo_total) || costoIngredientes + desvioValor;
  const costoPorcion = Number(receta.costo_porcion) || costoFinal / rendimiento;
  const precioReal = Number(receta.precio_real) || 0;
  const precioSugerido = Number(receta.precio_sugerido) || 0;
  const _mo = Number(receta.margen_objetivo) || 0;
  const margenObj = _mo > 1 ? _mo / 100 : _mo;
  // Fuente unica de verdad (lib/costeo): Food Cost = costo / precio base sin impuesto.
  const foodCost = precioReal > 0 ? calcFoodCost(costoPorcion, precioReal) : Number(receta.food_cost) || 0;
  const utilidad = calcUtilidad(precioReal, costoPorcion);
  const margenBruto = calcMargenBruto(precioReal, costoPorcion);
  const s = semaforo(foodCost);

  return (
    <main className="mx-auto w-[95%] max-w-[1800px] px-4 py-6 lg:px-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-salvia-500">
        <Link href="/recetas" className="hover:text-ambar-700">Recetario</Link>
        <span>/</span>
        <span className="text-salvia-700">{receta.nombre}</span>
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-[34px] leading-tight font-bold text-ambar-700">{receta.nombre}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${s.bg} ${s.text} ${s.border}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
              Food Cost {fcPct(foodCost)} - {s.label}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-salvia-500">{receta.id}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/recetas" className="btn-secondary">Volver</Link>
          <Link href={`/recetas/nueva?edit=${receta.id}`} className="btn-primary">Editar receta</Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[72fr_28fr]">
        <div className="min-w-0 space-y-6">
          <section className="rounded-lg border border-salvia-100 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Informacion general</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm lg:grid-cols-3 xl:grid-cols-4">
              <Info label="Codigo" value={receta.id} mono />
              <Info label="Familia" value={fam ? fam.nombre : 'General'} />
              <Info label="Subfamilia" value={sub ? sub.nombre : 'Sin clasificar'} />
              <Info label="Rendimiento" value={`${num(rendimiento, 0)} porciones`} />
              <Info label="Creada" value={fecha(receta.creado_en)} />
              <Info label="Actualizada" value={fecha(receta.actualizado_en)} />
            </dl>
          </section>

          <section className="rounded-lg border border-salvia-100 bg-white p-0 overflow-hidden">
            <h2 className="border-b border-salvia-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Ingredientes ({ingredientes.length})</h2>
            <div className="overflow-x-auto">
              <table className="erp-table w-full table-fixed">
                <thead>
                  <tr>
                    <th className="w-[35%]">Insumo</th>
                    <th className="w-[10%]">Unidad</th>
                    <th className="w-[10%] !text-right">Cantidad</th>
                    <th className="w-[9%] !text-right">% Merma</th>
                    <th className="w-[10%] !text-right">Cant. real</th>
                    <th className="w-[12%] !text-right">Costo unit.</th>
                    <th className="w-[14%] !text-right">Costo total</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientes.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-salvia-400">Esta receta no tiene ingredientes registrados.</td></tr>
                  ) : ingredientes.map((g: any, i: number) => {
                    const cant = Number(g.cantidad) || 0;
                    const merma = Number(g.merma_pct) || 0;
                    const real = cant * (1 + merma / 100);
                    return (
                      <tr key={g.id || i} className="border-t border-salvia-50">
                        <td className="px-3 py-3 font-medium text-salvia-800 whitespace-normal break-words leading-snug">{g.nombre_item || g.item_id}</td>
                        <td className="px-3 py-2 text-salvia-600">{g.unidad_id}</td>
                        <td className="px-3 py-2 text-right font-mono">{num(cant, 2)}</td>
                        <td className="px-3 py-2 text-right font-mono">{num(merma, 1)}%</td>
                        <td className="px-3 py-2 text-right font-mono text-ambar-700">{num(real, 2)}</td>
                        <td className="px-3 py-2 text-right font-mono">{money2(Number(g.costo_unitario))}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">{money2(Number(g.costo_linea))}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {ingredientes.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-salvia-200 bg-salvia-50 font-semibold">
                      <td className="px-3 py-2" colSpan={6}>Costo de ingredientes</td>
                      <td className="px-3 py-2 text-right font-mono">{money2(costoIngredientes)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-salvia-100 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-salvia-500">Historial</h2>
              <div className="flex items-center gap-2">
                <a href={`/api/recetas/pdf?id=${receta.id}`} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-3 !py-1.5 !text-xs">📄 Descargar PDF</a>
                <Link href={`/recetas/${receta.id}/trazabilidad`} className="btn-primary !px-3 !py-1.5 !text-xs">📋 Ver trazabilidad completa</Link>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Info label="Creada por" value={receta.creado_por || 'Sistema'} />
              <Info label="Fecha de creacion" value={fecha(receta.creado_en)} />
              <Info label="Ultima modificacion" value={fecha(receta.actualizado_en)} />
              <Info label="Modificada por" value={receta.actualizado_por || 'Sistema'} />
            </dl>
          </section>
        </div>

        <aside className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="card-hover rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] p-4 shadow-card">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Costo del plato</p>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#DBEAFE] text-sm text-[#2563EB]">{'\uD83D\uDCB0'}</span>
              </div>
              <p className="mt-2 text-[30px] leading-tight font-bold tabular-nums tracking-tight text-[#1E3A5F]">{money(costoFinal)}</p>
            </div>
            <div className="card-hover rounded-xl border border-[#D1FAE5] bg-[#ECFDF5] p-4 shadow-card">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Precio sugerido</p>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#DCFCE7] text-sm text-[#16A34A]">{'\uD83C\uDFF7'}</span>
              </div>
              <p className="mt-2 text-[30px] leading-tight font-bold tabular-nums tracking-tight text-[#16A34A]">{money(precioSugerido)}</p>
            </div>
            <div className="card-hover rounded-xl border border-[#E0E7FF] bg-[#EEF2FF] p-4 shadow-card">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Precio real</p>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E0E7FF] text-sm text-[#1E3A5F]">{'\uD83D\uDCB5'}</span>
              </div>
              <p className="mt-2 text-[30px] leading-tight font-bold tabular-nums tracking-tight text-[#1E3A5F]">{precioReal > 0 ? money(precioReal) : 'Sin precio'}</p>
            </div>
            <div className={`card-hover rounded-xl border p-4 shadow-card ${utilidad > 0 ? 'border-[#D1FAE5] bg-[#DCFCE7]' : 'border-[#FEE2E2] bg-[#FEF2F2]'}`}>
              <div className="flex items-center justify-between">
                <p className="eyebrow">Utilidad</p>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${utilidad > 0 ? 'bg-[#BBF7D0] text-[#16A34A]' : 'bg-[#FECACA] text-[#DC2626]'}`}>{'\uD83D\uDCC8'}</span>
              </div>
              <p className={`mt-2 text-[30px] leading-tight font-bold tabular-nums tracking-tight ${utilidad > 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{money(utilidad)}</p>
            </div>
          </div>
          <section className={`card-hover rounded-xl border p-5 ${s.border} ${s.bg}`}>
            <div className="flex items-center justify-between">
              <p className="eyebrow">Food Cost real</p>
              <span className={`chip ${s.bg} ${s.text}`}>{s.label}</span>
            </div>
            <p className={`mt-3 text-[42px] leading-none font-bold tabular-nums tracking-tight ${s.text}`}>{fcPct(foodCost)}</p>
            <div className="progress-track mt-4">
              <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, foodCost * 100)).toFixed(0)}%`, backgroundColor: s.hex }} />
            </div>
            <p className="mt-2 text-xs text-muted">Objetivo {fcPct(margenObj)}</p>
          </section>

          <section className="rounded-lg border border-salvia-100 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Resumen de costos</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Costo de ingredientes" value={money2(costoIngredientes)} />
              <Row label="Costo por merma" value={money2(costoMerma)} />
              <Row label="Desvio de mercancia" value={`${num(desvioPct, 1)}%`} sub={money2(desvioValor)} />
              <Row label="Costo total del plato" value={money(costoFinal)} strong />
              <div className="my-2 border-t border-salvia-100" />
              <Row label="Food Cost objetivo" value={fcPct(margenObj)} />
              <Row label="Precio sugerido" value={money(precioSugerido)} />
              <Row label="Precio real de venta" value={precioReal > 0 ? money(precioReal) : 'Sin precio'} />
              <Row label="Food Cost real" value={fcPct(foodCost)} accent={s.text} strong />
              <div className="my-2 border-t border-salvia-100" />
              <Row label="Utilidad" value={money(utilidad)} accent={utilidad > 0 ? 'text-emerald-700' : 'text-red-700'} />
              <Row label="Margen bruto" value={fcPct(margenBruto)} accent="text-emerald-700" />
              <Row label="Rentabilidad" value={foodCost > 0 && foodCost <= 0.35 ? 'Rentable' : precioReal > 0 ? 'Revisar precio' : 'Sin precio'} accent={s.text} />
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-salvia-400">{label}</dt>
      <dd className={`mt-0.5 text-salvia-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}

function Row({ label, value, sub, strong, accent }: { label: string; value: string; sub?: string; strong?: boolean; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-salvia-600">{label}</span>
      <span className="text-right">
        <span className={`font-mono ${strong ? 'font-bold' : ''} ${accent || 'text-salvia-800'}`}>{value}</span>
        {sub ? <span className="ml-2 font-mono text-xs text-salvia-400">{sub}</span> : null}
      </span>
    </div>
  );
}
