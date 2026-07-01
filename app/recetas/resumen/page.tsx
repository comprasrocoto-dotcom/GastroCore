'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fcPct = (n: number) => ((Number(n) || 0) * 100).toFixed(1) + '%';

function sem(fc: number) {
  const v = Number(fc) || 0;
  if (v <= 0.35) return { dot: 'bg-emerald-500', text: 'text-emerald-700', emoji: 'Optimo' };
  if (v <= 0.4) return { dot: 'bg-amber-400', text: 'text-amber-700', emoji: 'Alerta' };
  return { dot: 'bg-red-500', text: 'text-red-700', emoji: 'Critico' };
}

type Sort = 'food_cost' | 'costo' | 'precio' | 'rentabilidad' | 'familia';

export default function ResumenClient() {
  const [recetas, setRecetas] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [fams, setFams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>('food_cost');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [r, s, f] = await Promise.all([
          fetch('/api/recetas', { cache: 'no-store' }).then((x) => x.json()),
          fetch('/api/subfamilias', { cache: 'no-store' }).then((x) => x.json()).catch(() => ({ data: [] })),
          fetch('/api/familias', { cache: 'no-store' }).then((x) => x.json()).catch(() => ({ data: [] })),
        ]);
        if (cancel) return;
        setRecetas(Array.isArray(r?.data) ? r.data : []);
        setSubs(Array.isArray(s?.data) ? s.data : []);
        setFams(Array.isArray(f?.data) ? f.data : []);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const subMap = useMemo(() => new Map(subs.map((s) => [s.id, s])), [subs]);
  const famMap = useMemo(() => new Map(fams.map((f) => [f.id, f])), [fams]);
  const esActivo = (r: any) => r.activo === true || r.activo === 'true' || r.activo === 'TRUE' || r.activo === 1;
  const familiaDe = (r: any) => {
    const s = subMap.get(r.subfamilia_id);
    const f = s ? famMap.get(s.familia_id) : null;
    return f ? f.nombre : 'General';
  };

  const activos = useMemo(() => recetas.filter(esActivo), [recetas]);

  const rows = useMemo(() => {
    const arr = activos.map((r) => {
      const costo = Number(r.costo_porcion) || 0;
      const precio = Number(r.precio_real) || 0;
      const fc = precio > 0 ? costo / precio : Number(r.food_cost) || 0;
      const rent = precio > 0 ? precio - costo : 0;
      return { r, familia: familiaDe(r), costo, precio, fc, rent };
    });
    arr.sort((a, b) => {
      let c = 0;
      if (sort === 'food_cost') c = a.fc - b.fc;
      else if (sort === 'costo') c = a.costo - b.costo;
      else if (sort === 'precio') c = a.precio - b.precio;
      else if (sort === 'rentabilidad') c = a.rent - b.rent;
      else if (sort === 'familia') c = a.familia.localeCompare(b.familia);
      return dir === 'asc' ? c : -c;
    });
    return arr;
  }, [activos, sort, dir, subMap, famMap]);

  const porFamilia = useMemo(() => {
    const m = new Map<string, { suma: number; n: number }>();
    for (const x of rows) {
      if (!(x.fc > 0)) continue;
      if (!m.has(x.familia)) m.set(x.familia, { suma: 0, n: 0 });
      const g = m.get(x.familia)!;
      g.suma += x.fc; g.n++;
    }
    return Array.from(m.entries()).map(([fam, v]) => ({ fam, prom: v.suma / v.n })).sort((a, b) => b.prom - a.prom);
  }, [rows]);

  const topRentables = useMemo(() => [...rows].filter((x) => x.precio > 0).sort((a, b) => b.rent - a.rent).slice(0, 10), [rows]);
  const topFoodCost = useMemo(() => [...rows].filter((x) => x.fc > 0).sort((a, b) => b.fc - a.fc).slice(0, 10), [rows]);
  const utilidadTotal = useMemo(() => rows.reduce((a, x) => a + (x.rent > 0 ? x.rent : 0), 0), [rows]);
  const maxRent = topRentables[0]?.rent || 1;
  const maxFc = topFoodCost[0]?.fc || 1;

  function th(label: string, key: Sort) {
    const active = sort === key;
    return (
      <th className="px-3 py-2 font-medium">
        <button onClick={() => { if (active) setDir(dir === 'asc' ? 'desc' : 'asc'); else { setSort(key); setDir('desc'); } }} className={`inline-flex items-center gap-1 ${active ? 'text-ambar-700' : 'text-salvia-600 hover:text-salvia-800'}`}>
          {label}<span className="text-[10px]">{active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</span>
        </button>
      </th>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ambar-700">Resumen de Costos</h1>
          <p className="text-sm text-salvia-600">Tablero ejecutivo del costeo de recetas, sincronizado con la base.</p>
        </div>
        <Link href="/recetas" className="btn-secondary">Volver al recetario</Link>
      </header>

      {loading ? (
        <p className="py-10 text-center text-salvia-500">Cargando tablero...</p>
      ) : (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label="Recetas activas" value={String(activos.length)} tone="blue" icon="📘" />
            <Card label="Food Cost promedio" value={fcPct(rows.filter((x) => x.fc > 0).reduce((a, x, _, arr) => a + x.fc / arr.length, 0))} tone="green" icon="📊" />
            <Card label="Utilidad potencial" value={money(utilidadTotal)} tone="green" icon="💰" />
            <Card label="Fuera de objetivo" value={String(rows.filter((x) => x.fc > 0.35).length)} tone="red" icon="⚠" />
          </section>

          <section className="mb-6 grid gap-6 lg:grid-cols-3">
            <Panel title="Food Cost promedio por familia">
              {porFamilia.length === 0 ? <Empty /> : porFamilia.map((x) => (
                <BarRow key={x.fam} label={x.fam} valueLabel={fcPct(x.prom)} pct={Math.min(100, (x.prom / 0.6) * 100)} color={sem(x.prom).dot} />
              ))}
            </Panel>
            <Panel title="Top 10 recetas mas rentables">
              {topRentables.length === 0 ? <Empty /> : topRentables.map((x) => (
                <BarRow key={x.r.id} label={x.r.nombre} valueLabel={money(x.rent)} pct={Math.min(100, (x.rent / maxRent) * 100)} color="bg-emerald-500" />
              ))}
            </Panel>
            <Panel title="Top 10 mayor Food Cost">
              {topFoodCost.length === 0 ? <Empty /> : topFoodCost.map((x) => (
                <BarRow key={x.r.id} label={x.r.nombre} valueLabel={fcPct(x.fc)} pct={Math.min(100, (x.fc / maxFc) * 100)} color={sem(x.fc).dot} />
              ))}
            </Panel>
          </section>

          <section className="card">
            <div className="border-b border-salvia-100 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Detalle por receta</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-salvia-50 text-left text-salvia-600">
                    <th className="px-3 py-2 font-medium">Receta</th>
                    {th('Familia', 'familia')}
                    {th('Costo plato', 'costo')}
                    {th('Precio venta', 'precio')}
                    {th('Food Cost', 'food_cost')}
                    {th('Rentabilidad', 'rentabilidad')}
                    <th className="px-3 py-2 text-center font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.r.id} className="border-t border-salvia-50 hover:bg-ambar-50/40">
                      <td className="px-3 py-2 font-medium"><Link href={`/recetas/${x.r.id}`} className="text-ambar-700 hover:underline">{x.r.nombre}</Link></td>
                      <td className="px-3 py-2 text-salvia-600">{x.familia}</td>
                      <td className="px-3 py-2 text-right font-mono">{money(x.costo)}</td>
                      <td className="px-3 py-2 text-right font-mono">{x.precio > 0 ? money(x.precio) : <span className="text-amber-500">-</span>}</td>
                      <td className="px-3 py-2 text-right"><span className={`inline-flex items-center gap-1.5 font-mono ${sem(x.fc).text}`}><span className={`h-2 w-2 rounded-full ${sem(x.fc).dot}`} />{x.fc > 0 ? fcPct(x.fc) : '-'}</span></td>
                      <td className="px-3 py-2 text-right font-mono">{x.precio > 0 ? money(x.rent) : '-'}</td>
                      <td className="px-3 py-2 text-center text-xs">{sem(x.fc).emoji}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

const RTONES: Record<string, { bg: string; ring: string; icon: string; val: string }> = {
  neutral: { bg: 'bg-white', ring: 'border-line', icon: 'bg-slate-100 text-slate-500', val: 'text-ink' },
  blue: { bg: 'bg-[#EFF6FF]', ring: 'border-[#DBEAFE]', icon: 'bg-[#DBEAFE] text-[#2563EB]', val: 'text-[#1E3A5F]' },
  green: { bg: 'bg-[#ECFDF5]', ring: 'border-[#D1FAE5]', icon: 'bg-[#DCFCE7] text-[#16A34A]', val: 'text-[#16A34A]' },
  red: { bg: 'bg-[#FEF2F2]', ring: 'border-[#FEE2E2]', icon: 'bg-[#FEE2E2] text-[#DC2626]', val: 'text-[#DC2626]' },
};

function Card({ label, value, tone = 'neutral', icon }: { label: string; value: string; tone?: string; icon?: string }) {
  const t = RTONES[tone] || RTONES.neutral;
  return (
    <div className={`card-hover rounded-xl border ${t.ring} ${t.bg} p-4 shadow-card`}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
        {icon && <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${t.icon}`}>{icon}</span>}
      </div>
      <p className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${t.val}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-semibold text-salvia-700">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function BarRow({ label, valueLabel, pct, color }: { label: string; valueLabel: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="truncate pr-2 text-salvia-700">{label}</span>
        <span className="font-mono text-salvia-500">{valueLabel}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-salvia-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-salvia-400">Sin datos suficientes.</p>;
}
