'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Insumo = { id: string; articulo: string; unidad: string; coste: number };
type Linea = { item_id: string; cantidad: number; merma_pct: number };

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export default function NuevaRecetaPage() {
  const router = useRouter();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [nombre, setNombre] = useState('');
  const [rendimiento, setRendimiento] = useState(1);
  const [mermaPct, setMermaPct] = useState(0);
  const [desvioPct, setDesvioPct] = useState(0);
  const [precioReal, setPrecioReal] = useState(0);
  const [margenObjetivo, setMargenObjetivo] = useState(0.3);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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

  const costeo = useMemo(() => {
    let subtotal = 0;
    const detalle = lineas.map((l) => {
      const ins = insumoPorId[l.item_id];
      const costoUnit = ins ? Number(ins.coste) : 0;
      const costoLinea = costoUnit * (Number(l.cantidad) || 0) * (1 + (Number(l.merma_pct) || 0) / 100);
      subtotal += costoLinea;
      return { nombre: ins ? ins.articulo : '(sin insumo)', costoLinea };
    });
    const costoTotal = subtotal * (1 + mermaPct / 100) * (1 + desvioPct / 100);
    const costoPorcion = costoTotal / (rendimiento || 1);
    const precioSugerido = margenObjetivo > 0 ? costoPorcion / margenObjetivo : 0;
    const foodCost = precioReal > 0 ? costoPorcion / precioReal : 0;
    return { detalle, costoTotal, costoPorcion, precioSugerido, foodCost };
  }, [lineas, insumoPorId, mermaPct, desvioPct, rendimiento, margenObjetivo, precioReal]);

  const addLinea = () => setLineas((p) => [...p, { item_id: '', cantidad: 1, merma_pct: 0 }]);
  const updLinea = (i: number, patch: Partial<Linea>) =>
    setLineas((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const delLinea = (i: number) => setLineas((p) => p.filter((_, idx) => idx !== i));

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    try {
      const payload = {
        nombre,
        rendimiento,
        merma_pct: mermaPct,
        desvio_pct: desvioPct,
        precio_real: precioReal,
        margen_objetivo: margenObjetivo,
        ingredientes: lineas.map((l, idx) => ({
          tipo_item: 'insumo',
          item_id: l.item_id,
          cantidad: l.cantidad,
          merma_pct: l.merma_pct,
          unidad_id: insumoPorId[l.item_id] ? insumoPorId[l.item_id].unidad : '',
          orden: idx + 1,
        })),
      };
      const res = await fetch('/api/recetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        router.push('/recetas');
      } else {
        setMsg(data.error || 'No se pudo guardar');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardando(false);
    }
  }

  const puedeGuardar = nombre.trim() !== '' && lineas.length > 0 && lineas.every((l) => l.item_id);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-ambar-700">Nueva receta</h1>
        <Link href="/recetas" className="text-sm text-salvia-700 hover:underline">Volver</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-salvia-100 bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-salvia-700">Nombre</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                  className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-salvia-700">Rendimiento (porciones)</span>
                <input type="number" min={1} value={rendimiento} onChange={(e) => setRendimiento(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-salvia-700">Merma global (%)</span>
                <input type="number" value={mermaPct} onChange={(e) => setMermaPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-salvia-700">Desvio mercancia (%)</span>
                <input type="number" value={desvioPct} onChange={(e) => setDesvioPct(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-salvia-100 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-salvia-800">Ingredientes</h2>
              <button onClick={addLinea} className="btn-secondary text-xs">+ Agregar</button>
            </div>
            <div className="space-y-2">
              {lineas.map((l, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select value={l.item_id} onChange={(e) => updLinea(i, { item_id: e.target.value })}
                    className="flex-1 min-w-[180px] rounded-md border border-salvia-200 px-2 py-1.5 text-sm">
                    <option value="">Selecciona insumo...</option>
                    {insumos.map((ins) => (
                      <option key={ins.id} value={ins.id}>{ins.articulo}</option>
                    ))}
                  </select>
                  <input type="number" value={l.cantidad} onChange={(e) => updLinea(i, { cantidad: Number(e.target.value) })}
                    className="w-20 rounded-md border border-salvia-200 px-2 py-1.5 text-sm" placeholder="Cant." />
                  <input type="number" value={l.merma_pct} onChange={(e) => updLinea(i, { merma_pct: Number(e.target.value) })}
                    className="w-20 rounded-md border border-salvia-200 px-2 py-1.5 text-sm" placeholder="Merma%" />
                  <span className="w-24 text-right font-mono text-xs text-ambar-700">{money(costeo.detalle[i]?.costoLinea || 0)}</span>
                  <button onClick={() => delLinea(i)} className="text-salvia-400 hover:text-ambar-600">x</button>
                </div>
              ))}
              {lineas.length === 0 && (
                <p className="text-sm text-salvia-500">Agrega al menos un ingrediente.</p>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="ticket-panel">
            <p className="mb-2 text-center font-semibold uppercase tracking-wide text-ambar-700">Costeo</p>
            {costeo.detalle.map((d, i) => (
              <div key={i} className="ticket-row">
                <span className="truncate pr-2">{d.nombre}</span>
                <span>{money(d.costoLinea)}</span>
              </div>
            ))}
            <div className="ticket-row"><span>Costo total</span><span>{money(costeo.costoTotal)}</span></div>
            <div className="ticket-row"><span>Costo x porcion</span><span>{money(costeo.costoPorcion)}</span></div>
            <div className="ticket-row"><span>Precio sugerido</span><span>{money(costeo.precioSugerido)}</span></div>
            <div className="ticket-total"><span>Food cost</span><span>{(costeo.foodCost * 100).toFixed(1)}%</span></div>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-salvia-700">Food cost objetivo</span>
            <input type="number" step="0.01" value={margenObjetivo} onChange={(e) => setMargenObjetivo(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-salvia-700">Precio real de venta</span>
            <input type="number" value={precioReal} onChange={(e) => setPrecioReal(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-salvia-200 px-3 py-2 text-sm" />
          </label>

          {msg && <p className="text-sm text-ambar-700">{msg}</p>}
          <button onClick={guardar} disabled={!puedeGuardar || guardando}
            className="btn-primary w-full disabled:opacity-50">
            {guardando ? 'Guardando...' : 'Guardar receta'}
          </button>
        </aside>
      </div>
    </main>
  );
}
