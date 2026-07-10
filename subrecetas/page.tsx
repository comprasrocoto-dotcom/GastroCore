'use client';
import { fetchEnCola } from '@/lib/colaGuardado';
import { useRol } from '@/lib/useRol';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Sub = {
  id: string;
  nombre: string;
  subfamilia_id?: string;
  rendimiento?: number;
  unidad_rendimiento_id?: string;
  costo_total?: number;
  costo_unitario?: number;
  activo?: boolean | string;
  actualizado_en?: string;
};

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const num = (n: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n || 0);
const esActivo = (v: unknown) => v === true || v === 'TRUE' || v === 'true';

export default function SubrecetasPage() {
  const { puedeEditarRecetas } = useRol();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [puenteando, setPuenteando] = useState<string | null>(null);
  const [verInactivas, setVerInactivas] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/subrecetas?all=true', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSubs(Array.isArray(d.data) ? d.data : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtradas = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return subs.filter((s) => {
      if (!verInactivas && !esActivo(s.activo)) return false;
      if (nq && !(s.nombre || '').toLowerCase().includes(nq)) return false;
      return true;
    });
  }, [subs, q, verInactivas]);

  async function actualizarMaestro(s: any) {
    const va = Number(s.insumo_coste) || 0;
    const viene = Number(s.costo_unitario) || 0;
    if (!window.confirm('¿Actualizar el costeo del insumo ' + (s.insumo_articulo || s.insumo_referencia) + '?\n$' +
      va.toLocaleString('es-CO', { maximumFractionDigits: 2 }) + ' → $' + viene.toLocaleString('es-CO', { maximumFractionDigits: 2 }) +
      '\n(queda en el historial y recalcula las recetas que lo usan)')) return;
    setPuenteando(s.id);
    try {
      const r = await fetchEnCola('/api/subrecetas/actualizar-insumo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo actualizar');
      setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, insumo_coste: viene, desactualizada: false } : x)));
      if (j.data?.recetas_recalculadas) alert('Insumo actualizado. ' + j.data.recetas_recalculadas);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error inesperado');
    } finally {
      setPuenteando(null);
    }
  }

  const totalActivas = subs.filter((s) => esActivo(s.activo)).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ambar-700">Subrecetas · Preparaciones base</h1>
          <p className="text-xs text-salvia-500">Preparaciones que se costean como una receta y se usan como insumo en otras recetas.</p>
        </div>
        {puedeEditarRecetas && <Link href="/subrecetas/nueva" className="rounded-lg bg-ambar-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ambar-700">+ Nueva subreceta</Link>}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-salvia-500">Total subrecetas</p>
          <p className="mt-1 text-2xl font-bold text-ink">{totalActivas}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-salvia-500">Costo prom. por unidad</p>
          <p className="mt-1 text-2xl font-bold text-ink">{money(filtradas.length ? filtradas.reduce((a, s) => a + (Number(s.costo_unitario) || 0), 0) / filtradas.length : 0)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-salvia-500">Mostrando</p>
          <p className="mt-1 text-2xl font-bold text-ink">{filtradas.length}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar subreceta…"
          className="w-64 rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-[#2563EB] focus:outline-none" />
        <label className="flex items-center gap-2 text-sm text-salvia-600">
          <input type="checkbox" checked={verInactivas} onChange={(e) => setVerInactivas(e.target.checked)} />
          Ver inactivas
        </label>
      </div>

      {loading ? (
        <p className="py-10 text-center text-salvia-500">Cargando…</p>
      ) : filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line py-12 text-center text-salvia-500">
          No hay subrecetas todavía. Crea la primera con “+ Nueva subreceta”.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-left text-[11px] uppercase tracking-wide text-salvia-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Maestro (Insumos)</th>
                <th className="px-4 py-2 text-right">Rendimiento</th>
                <th className="px-4 py-2 text-right">Costo total</th>
                <th className="px-4 py-2 text-right">Costo x unidad</th>
                <th className="px-4 py-2 text-center">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((s) => (
                <tr key={s.id} className="border-t border-line hover:bg-[#F8FAFC]">
                  <td className="px-4 py-2 font-medium text-ink">🥣 {s.nombre}<span className="ml-2 text-[11px] text-salvia-400">{s.id}</span></td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-[11px] text-salvia-600">{(s as any).insumo_referencia || '—'}</span>
                    {(s as any).desactualizada ? (
                      <button onClick={() => actualizarMaestro(s)} disabled={puenteando === s.id}
                        title={'Insumo: ' + money(Number((s as any).insumo_coste) || 0) + ' · Calculado: ' + money(Number(s.costo_unitario) || 0)}
                        className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50">
                        {puenteando === s.id ? '…' : '⇪ Desactualizado — actualizar'}
                      </button>
                    ) : (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">✓ al día</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">{num(Number(s.rendimiento) || 0)} {s.unidad_rendimiento_id || ''}</td>
                  <td className="px-4 py-2 text-right">{money(Number(s.costo_total) || 0)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-[#1E3A5F]">{money(Number(s.costo_unitario) || 0)}</td>
                  <td className="px-4 py-2 text-center">
                    {esActivo(s.activo)
                      ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Activa</span>
                      : <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">Inactiva</span>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {puedeEditarRecetas && <Link href={`/subrecetas/nueva?edit=${s.id}`} className="text-xs font-medium text-ambar-600 hover:underline">Editar</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
