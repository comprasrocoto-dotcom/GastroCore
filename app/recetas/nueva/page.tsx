'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

type Insumo = { id: string; articulo: string; unidad: string; coste: number };
type Linea = { item_id: string; unidad: string; cantidad: number; merma_pct: number };

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const pct = (n: number) => (n || 0).toFixed(2) + '%';
const num = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n || 0);

const UNIDADES = ['GRAMOS', 'KILOS', 'ML', 'LITROS', 'ONZA', 'COPA', 'UNIDADES'];

function NuevaRecetaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const modoEdicion = !!editId;

  useEffect(() => {
    if (!editId) return;
    let cancel = false;
    (async () => {
      try {
        const r = await fetch(`/api/recetas?id=${editId}`, { cache: 'no-store' });
        const j = await r.json();
        const rec = j?.data;
        if (cancel || !rec) return;
        setNombre(rec.nombre || '');
        setRendimiento(Number(rec.rendimiento) || 1);
        setDesvioPct(Number(rec.desvio_pct) || 0);
        setPrecioReal(Number(rec.precio_real) || 0);
        setFoodCostObjetivo(Number(rec.margen_objetivo) || 0.3);
        const ings = Array.isArray(rec.ingredientes) ? rec.ingredientes : [];
        if (ings.length) {
          setLineas(ings.map((g: any) => ({
            item_id: g.item_id || '',
            unidad: g.unidad_id || '',
            cantidad: Number(g.cantidad) || 0,
            merma_pct: Number(g.merma_pct) || 0,
          })));
        }
      } catch {}
    })();
    return () => { cancel = true; };
  }, [editId]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [nombre, setNombre] = useState('');
  const [rendimiento, setRendimiento] = useState(1);
  const [desvioPct, setDesvioPct] = useState(0);
  const [precioReal, setPrecioReal] = useState(0);
  const [foodCostObjetivo, setFoodCostObjetivo] = useState(0.3);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/insumos')
      .then((r) => r.json())
      .then((d) => { if (d.ok) setInsumos(d.data); })
      .catch(() => {});
  }, []);

  const insumoPorId = useMemo(() => {
    const m: Record<string, Insumo> = {};
    insumos.forEach((i) => (m[i.id] = i));
    return m;
  }, [insumos]);

  const filas = useMemo(() => {
    return lineas.map((l) => {
      const ins = insumoPorId[l.item_id];
      const costoUnit = ins ? Number(ins.coste) : 0;
      const cantReal = (Number(l.cantidad) || 0) * (1 + (Number(l.merma_pct) || 0) / 100);
      const costoTotal = costoUnit * cantReal;
      return { ins, costoUnit, cantReal, costoTotal };
    });
  }, [lineas, insumoPorId]);

  const costeo = useMemo(() => {
    const costoIngredientes = filas.reduce((s, f) => s + f.costoTotal, 0);
    const desvio = costoIngredientes * (desvioPct / 100);
    const costoFinal = costoIngredientes + desvio;
    const costoPorcion = costoFinal / (rendimiento || 1);
    const precioSugerido = foodCostObjetivo > 0 ? costoPorcion / foodCostObjetivo : 0;
    const foodCostReal = precioReal > 0 ? (costoPorcion / precioReal) * 100 : 0;
    const utilidad = precioReal - costoPorcion;
    const margenBruto = precioReal > 0 ? (utilidad / precioReal) * 100 : 0;
    return { costoIngredientes, desvio, costoFinal, costoPorcion, precioSugerido, foodCostReal, utilidad, margenBruto };
  }, [filas, desvioPct, rendimiento, foodCostObjetivo, precioReal]);

  const addLinea = () =>
    setLineas((p) => [...p, { item_id: '', unidad: '', cantidad: 1, merma_pct: 0 }]);
  const updLinea = (i: number, patch: Partial<Linea>) =>
    setLineas((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const delLinea = (i: number) => setLineas((p) => p.filter((_, idx) => idx !== i));
  const dupLinea = (i: number) => setLineas((p) => { const c = { ...p[i] }; const n = [...p]; n.splice(i + 1, 0, c); return n; });

  const onInsumo = (i: number, id: string) => {
    const ins = insumoPorId[id];
    updLinea(i, { item_id: id, unidad: ins ? ins.unidad : '' });
  };

  function validar(): string[] {
    const e: string[] = [];
    if (nombre.trim() === '') e.push('El nombre de la receta es obligatorio.');
    if (!rendimiento || rendimiento < 1) e.push('El rendimiento debe ser al menos 1 porcion.');
    if (lineas.length === 0) e.push('Agrega al menos un ingrediente.');
    lineas.forEach((l, idx) => {
      const n = idx + 1;
      if (!l.item_id) e.push('Ingrediente ' + n + ': selecciona un insumo.');
      if (!l.unidad) e.push('Ingrediente ' + n + ': falta la unidad.');
      if (!l.cantidad || Number(l.cantidad) <= 0) e.push('Ingrediente ' + n + ': la cantidad debe ser mayor a 0.');
      if (Number(l.merma_pct) < 0) e.push('Ingrediente ' + n + ': la merma no puede ser negativa.');
      const ins = insumoPorId[l.item_id];
      if (ins && Number(ins.coste) < 0) e.push('Ingrediente ' + n + ': costo invalido.');
    });
    return e;
  }

  async function guardar() {
    const e = validar();
    setErrores(e);
    setMsg(null);
    if (e.length > 0) return;
    setGuardando(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        rendimiento,
        merma_pct: 0,
        desvio_pct: desvioPct,
        precio_real: precioReal,
        margen_objetivo: foodCostObjetivo,
        ingredientes: lineas.map((l, idx) => ({
          tipo_item: 'insumo',
          item_id: l.item_id,
          cantidad: Number(l.cantidad),
          merma_pct: Number(l.merma_pct),
          unidad_id: l.unidad,
          orden: idx + 1,
        })),
      };
      const res = await fetch('/api/recetas', {
        method: modoEdicion ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modoEdicion ? { id: editId, ...payload } : payload),
      });
      const data = await res.json();
      if (data.ok) {
        router.push('/recetas');
      } else {
        setMsg((data.error && data.error.message) || data.error || 'No se pudo guardar la receta.');
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error inesperado al guardar.');
    } finally {
      setGuardando(false);
    }
  }

  const fcBadge = (fc: number) =>
    fc <= 0 ? 'text-salvia-400' : fc <= foodCostObjetivo * 100 ? 'text-green-700' : fc <= 40 ? 'text-ambar-600' : 'text-red-600';

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ambar-700">{modoEdicion ? 'Editar receta' : 'Nueva receta'}</h1>
          <p className="text-xs text-salvia-500">Costeo por ingrediente con merma real, sincronizado con la base.</p>
        </div>
        <Link href="/recetas" className="text-sm text-salvia-700 hover:underline">Volver</Link>
      </div>

      <div className="mb-4 grid gap-3 rounded-lg border border-salvia-100 bg-white p-4 sm:grid-cols-3">
        <label className="block sm:col-span-1">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Nombre de la receta</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Ceviche clasico"
            className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Rendimiento (porciones)</span>
          <input type="number" min={1} value={rendimiento} onChange={(e) => setRendimiento(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Desvio mercancia (%)</span>
          <input type="number" step="0.1" value={desvioPct} onChange={(e) => setDesvioPct(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-salvia-100 bg-white">
          <div className="flex items-center justify-between border-b border-salvia-100 px-4 py-3">
            <h2 className="font-display text-base font-semibold text-salvia-800">Ingredientes</h2>
            <button onClick={addLinea} className="btn-primary text-xs">+ Agregar ingrediente</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-salvia-100 bg-salvia-50 text-left text-xs uppercase tracking-wide text-salvia-600">
                  <th className="px-3 py-2 font-medium">Insumo</th>
                  <th className="px-2 py-2 font-medium">Unidad</th>
                  <th className="px-2 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-2 py-2 text-right font-medium">% Merma</th>
                  <th className="px-2 py-2 text-right font-medium">Cant. real</th>
                  <th className="px-2 py-2 text-right font-medium">C. unitario</th>
                  <th className="px-2 py-2 text-right font-medium">C. total</th>
                  <th className="px-2 py-2 text-center font-medium">Accion</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i} className="border-b border-salvia-50 last:border-0">
                    <td className="px-3 py-2">
                      <select value={l.item_id} onChange={(e) => onInsumo(i, e.target.value)}
                        className="w-full min-w-[200px] rounded-md border border-salvia-200 px-2 py-1.5 text-sm focus:border-ambar-400 focus:outline-none">
                        <option value="">Selecciona insumo...</option>
                        {insumos.map((ins) => (
                          <option key={ins.id} value={ins.id}>{ins.articulo}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select value={l.unidad} onChange={(e) => updLinea(i, { unidad: e.target.value })}
                        className="w-24 rounded-md border border-salvia-200 px-2 py-1.5 text-sm focus:border-ambar-400 focus:outline-none">
                        <option value="">--</option>
                        {UNIDADES.map((u) => (<option key={u} value={u}>{u}</option>))}
                        {l.unidad && !UNIDADES.includes(l.unidad) && (<option value={l.unidad}>{l.unidad}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input type="number" min={0} value={l.cantidad} onChange={(e) => updLinea(i, { cantidad: Number(e.target.value) })}
                        className="w-20 rounded-md border border-salvia-200 px-2 py-1.5 text-right text-sm focus:border-ambar-400 focus:outline-none" />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input type="number" min={0} step="0.1" value={l.merma_pct} onChange={(e) => updLinea(i, { merma_pct: Number(e.target.value) })}
                        className="w-16 rounded-md border border-salvia-200 px-2 py-1.5 text-right text-sm focus:border-ambar-400 focus:outline-none" />
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-salvia-700">{num(filas[i]?.cantReal || 0)}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs text-salvia-700">{money(filas[i]?.costoUnit || 0)}</td>
                    <td className="px-2 py-2 text-right font-mono text-xs font-semibold text-ambar-700">{money(filas[i]?.costoTotal || 0)}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => dupLinea(i)} title="Duplicar" className="text-salvia-400 hover:text-salvia-700">&#10697;</button>
                        <button onClick={() => delLinea(i)} title="Eliminar" className="text-salvia-400 hover:text-red-600">&#10005;</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {lineas.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-salvia-400">Aun no hay ingredientes. Presiona + Agregar ingrediente para comenzar.</td></tr>
                )}
              </tbody>
              {lineas.length > 0 && (
                <tfoot>
                  <tr className="border-t border-salvia-100 bg-salvia-50">
                    <td colSpan={6} className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-salvia-600">Costo ingredientes</td>
                    <td className="px-2 py-2 text-right font-mono text-sm font-bold text-ambar-700">{money(costeo.costoIngredientes)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="ticket-panel">
            <p className="mb-2 text-center font-semibold uppercase tracking-wide text-ambar-700">Costeo</p>
            <div className="ticket-row"><span>Costo ingredientes</span><span>{money(costeo.costoIngredientes)}</span></div>
            <div className="ticket-row"><span>Desvio mercancia</span><span>{money(costeo.desvio)}</span></div>
            <div className="ticket-row"><span>Costo final</span><span>{money(costeo.costoFinal)}</span></div>
            <div className="ticket-row"><span>Costo x porcion</span><span>{money(costeo.costoPorcion)}</span></div>
            <div className="ticket-row"><span>Food cost objetivo</span><span>{pct(foodCostObjetivo * 100)}</span></div>
            <div className="ticket-row"><span>Precio sugerido</span><span>{money(costeo.precioSugerido)}</span></div>
            <div className="ticket-row"><span>Precio real</span><span>{money(precioReal)}</span></div>
            <div className="ticket-row"><span>Utilidad</span><span>{money(costeo.utilidad)}</span></div>
            <div className="ticket-row"><span>Margen bruto</span><span>{pct(costeo.margenBruto)}</span></div>
            <div className={'ticket-total ' + fcBadge(costeo.foodCostReal)}><span>Food cost real</span><span>{pct(costeo.foodCostReal)}</span></div>
          </div>

          <div className="rounded-lg border border-salvia-100 bg-white p-4 space-y-3">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Food cost objetivo</span>
              <input type="number" step="0.01" min={0} max={1} value={foodCostObjetivo} onChange={(e) => setFoodCostObjetivo(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
              <span className="text-[11px] text-salvia-400">Ej: 0.30 = 30%</span>
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Precio real de venta</span>
              <input type="number" min={0} value={precioReal} onChange={(e) => setPrecioReal(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
            </label>
          </div>

          {errores.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <p className="mb-1 font-semibold">Corrige lo siguiente:</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {errores.map((er, k) => (<li key={k}>{er}</li>))}
              </ul>
            </div>
          )}
          {msg && <p className="rounded-lg border border-ambar-200 bg-ambar-50 p-2 text-sm text-ambar-700">{msg}</p>}

          <button onClick={guardar} disabled={guardando} className="btn-primary w-full disabled:opacity-50">
            {guardando ? 'Guardando...' : modoEdicion ? 'Actualizar receta' : 'Guardar receta'}
          </button>
        </aside>
      </div>
    </main>
  );
}

export default function NuevaRecetaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-salvia-500">Cargando...</div>}>
      <NuevaRecetaInner />
    </Suspense>
  );
}
