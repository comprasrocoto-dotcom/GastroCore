'use client';

import { useMemo, useState } from 'react';
import type { AnalyticsData, SimulacionResult } from '@/lib/api/gastrocore';

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const pct = (n: number) => (n >= 0 ? '+' : '') + (n || 0).toFixed(1) + '%';

const fechaCorta = (v: string) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
};

function BarraVar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
  const color = value >= 0 ? 'bg-red-500' : 'bg-green-500';
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div className={'h-2 rounded-full ' + color} style={{ width: w + '%' }} />
    </div>
  );
}

function LineChart({ points, label, color = '#B45309' }: { points: { x: string; y: number }[]; label: string; color?: string }) {
  if (!points.length) {
    return <p className="py-8 text-center text-sm text-muted">Sin datos históricos todavía. Genera snapshots semanales.</p>;
  }
  const w = 560, h = 180, pad = 30;
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((p.y - minY) / rangeY) * (h - pad * 2);
    return { x, y };
  });
  const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c.x.toFixed(1) + ' ' + c.y.toFixed(1)).join(' ');
  return (
    <svg viewBox={'0 0 ' + w + ' ' + h} className="w-full" role="img" aria-label={label}>
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#E5E7EB" />
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={3} fill={color} />
          <text x={c.x} y={h - pad + 14} fontSize={9} textAnchor="middle" fill="#94A3B8">{fechaCorta(points[i].x)}</text>
        </g>
      ))}
      <text x={pad} y={pad - 10} fontSize={10} fill="#64748B">{label}</text>
    </svg>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (!data.length) return <p className="py-6 text-center text-sm text-muted">Sin variaciones por familia.</p>;
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="w-32 shrink-0 truncate text-xs text-ink" title={d.label}>{d.label}</span>
          <div className="flex-1"><BarraVar value={d.value} max={max} /></div>
          <span className={'w-16 shrink-0 text-right text-xs font-semibold ' + (d.value >= 0 ? 'text-red-600' : 'text-green-700')}>{pct(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

function Simulador({ insumos }: { insumos: { id: string; articulo: string; coste: number }[] }) {
  const [insumoId, setInsumoId] = useState('');
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<SimulacionResult | null>(null);

  const insumoSel = insumos.find((i) => i.id === insumoId);

  const simular = async () => {
    setError(null);
    setRes(null);
    if (!insumoId) { setError('Selecciona un insumo.'); return; }
    const np = Number(nuevoPrecio);
    if (Number.isNaN(np) || np < 0) { setError('Ingresa un precio válido.'); return; }
    setCargando(true);
    try {
      const r = await fetch('/api/analytics/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insumo_id: insumoId, nuevo_precio: np }),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error || 'No se pudo simular.'); return; }
      setRes(j.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al simular.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-display text-lg font-bold text-ambar-700">🧪 Simular impacto</h2>
        <span className="chip bg-slate-100 text-slate-600">Solo consulta</span>
      </div>
      <p className="mb-4 text-xs text-salvia-700">Prueba un nuevo precio sin guardarlo. Verás qué recetas se afectan, el nuevo Food Cost y el precio de venta sugerido.</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-salvia-700">Insumo</span>
          <select value={insumoId} onChange={(e) => { setInsumoId(e.target.value); const it = insumos.find((x) => x.id === e.target.value); setNuevoPrecio(it ? String(it.coste) : ''); }}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]">
            <option value="">Selecciona un insumo...</option>
            {insumos.map((i) => (<option key={i.id} value={i.id}>{i.articulo}</option>))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-salvia-700">Nuevo precio</span>
          <input type="number" min="0" step="any" value={nuevoPrecio} onChange={(e) => setNuevoPrecio(e.target.value)}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]" />
        </label>
      </div>

      {insumoSel && (
        <p className="mt-2 text-xs text-muted">Precio actual: {money(insumoSel.coste)}</p>
      )}

      <button onClick={simular} disabled={cargando}
        className="mt-3 rounded-lg bg-ambar-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ambar-700 disabled:opacity-50">
        {cargando ? 'Calculando...' : 'Simular impacto'}
      </button>

      {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {res && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-sm">
            <span className="font-semibold">{res.articulo}</span>: {money(res.precio_actual)} → {money(res.nuevo_precio)}{' '}
            <span className={res.variacion_pct >= 0 ? 'text-red-600' : 'text-green-700'}>({pct(res.variacion_pct)})</span>
          </p>
          {res.recetas.length === 0 ? (
            <p className="text-sm text-muted">Este insumo no se usa en ninguna receta.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="erp-table text-xs">
                <thead>
                  <tr>
                    <th>Receta</th>
                    <th className="!text-right">Costo actual</th>
                    <th className="!text-right">Costo nuevo</th>
                    <th className="!text-right">Incremento</th>
                    <th className="!text-right">Nuevo Food Cost</th>
                    <th className="!text-right">Precio sug.</th>
                  </tr>
                </thead>
                <tbody>
                  {res.recetas.map((r) => (
                    <tr key={r.receta_id}>
                      <td className="font-medium">{r.nombre}</td>
                      <td className="text-right">{money(r.costo_actual)}</td>
                      <td className="text-right">{money(r.costo_nuevo)}</td>
                      <td className="text-right text-red-600">+{money(r.incremento)}</td>
                      <td className={'text-right font-semibold ' + (r.fuera_objetivo ? 'text-red-600' : 'text-green-700')}>{(r.food_cost_nuevo * 100).toFixed(1)}%</td>
                      <td className="text-right">{money(r.precio_sugerido_nuevo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnalisisDashboard({ analytics, insumos }: { analytics: AnalyticsData; insumos: { id: string; articulo: string; coste: number }[] }) {
  const [tab, setTab] = useState<'resumen' | 'impacto' | 'simular'>('resumen');
  const ind = analytics.indicadores;
  const maxAum = useMemo(() => Math.max(...analytics.top_aumentos.map((t) => Math.abs(t.variacion_pct)), 1), [analytics]);
  const maxRed = useMemo(() => Math.max(...analytics.top_reducciones.map((t) => Math.abs(t.variacion_pct)), 1), [analytics]);

  const alertaColor = (n: string) => (n === 'rojo' ? 'border-red-200 bg-red-50 text-red-700' : n === 'amarillo' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700');
  const alertaIcono = (n: string) => (n === 'rojo' ? '🔴' : n === 'amarillo' ? '🟡' : '🟢');

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-salvia-600">Insumo más inflacionario</p>
          {ind.insumo_mas_inflacionario ? (
            <>
              <p className="mt-1 truncate font-semibold text-ink" title={ind.insumo_mas_inflacionario.articulo}>🥑 {ind.insumo_mas_inflacionario.articulo}</p>
              <p className="text-2xl font-bold text-red-600">{pct(ind.insumo_mas_inflacionario.variacion_pct)}</p>
            </>
          ) : <p className="mt-1 text-muted">—</p>}
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-salvia-600">Receta más afectada</p>
          {ind.receta_mas_afectada ? (
            <>
              <p className="mt-1 truncate font-semibold text-ink" title={ind.receta_mas_afectada.receta}>🍽️ {ind.receta_mas_afectada.receta}</p>
              <p className="text-2xl font-bold text-red-600">+{money(ind.receta_mas_afectada.incremento_costo)}</p>
            </>
          ) : <p className="mt-1 text-muted">—</p>}
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-salvia-600">Variación promedio de costos</p>
          <p className={'mt-1 text-3xl font-bold ' + (ind.variacion_promedio >= 0 ? 'text-red-600' : 'text-green-700')}>{pct(ind.variacion_promedio)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-salvia-600">Recetas fuera de objetivo</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{ind.recetas_fuera_objetivo} recetas</p>
          <p className="text-xs text-muted">Food Cost &gt; {analytics.food_cost_objetivo}%</p>
        </div>
      </section>

      {analytics.alertas.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-bold text-ambar-700">🔔 Alertas automáticas</h2>
          <ul className="space-y-2">
            {analytics.alertas.map((a, i) => (
              <li key={i} className={'flex items-center gap-2 rounded-md border px-3 py-2 text-sm ' + alertaColor(a.nivel)}>
                <span>{alertaIcono(a.nivel)}</span><span>{a.mensaje}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2 border-b border-line">
        {([['resumen', 'Variación de costos'], ['impacto', 'Impacto en el menú'], ['simular', 'Simulación']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={'px-4 py-2 text-sm font-medium ' + (tab === k ? 'border-b-2 border-ambar-600 text-ambar-700' : 'text-muted hover:text-ink')}>{l}</button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h3 className="mb-3 font-semibold text-ink">Top 10 insumos con mayor aumento</h3>
              {analytics.top_aumentos.length === 0 ? <p className="text-sm text-muted">Sin aumentos registrados.</p> : (
                <div className="space-y-3">
                  {analytics.top_aumentos.map((t) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-sm text-ink" title={t.articulo}>🔴 {t.articulo}</span>
                      <div className="flex-1"><BarraVar value={t.variacion_pct} max={maxAum} /></div>
                      <span className="w-16 shrink-0 text-right text-sm font-semibold text-red-600">{pct(t.variacion_pct)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="card p-5">
              <h3 className="mb-3 font-semibold text-ink">Top 10 insumos con mayor reducción</h3>
              {analytics.top_reducciones.length === 0 ? <p className="text-sm text-muted">Sin reducciones registradas.</p> : (
                <div className="space-y-3">
                  {analytics.top_reducciones.map((t) => (
                    <div key={t.id} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-sm text-ink" title={t.articulo}>🟢 {t.articulo}</span>
                      <div className="flex-1"><BarraVar value={t.variacion_pct} max={maxRed} /></div>
                      <span className="w-16 shrink-0 text-right text-sm font-semibold text-green-700">{pct(t.variacion_pct)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h3 className="mb-3 font-semibold text-ink">Variación por familia</h3>
              <BarChart data={analytics.variacion_familia.map((f) => ({ label: f.familia, value: f.variacion_pct }))} />
            </section>
            <section className="card p-5">
              <h3 className="mb-3 font-semibold text-ink">Evolución semanal del costo promedio</h3>
              <LineChart points={analytics.evolucion_costo.map((e) => ({ x: e.fecha, y: e.costo_promedio }))} label="Costo promedio" />
              <p className="mt-2 text-center text-xs text-muted">Food Cost promedio actual del menú: <span className="font-semibold text-ink">{analytics.food_cost_promedio.toFixed(1)}%</span></p>
            </section>
          </div>
        </div>
      )}

      {tab === 'impacto' && (
        <section className="card p-5">
          <h3 className="mb-1 font-semibold text-ink">Impacto en el menú</h3>
          <p className="mb-3 text-xs text-salvia-700">Recetas afectadas por la variación de precios, ordenadas de mayor a menor impacto.</p>
          {analytics.impacto_menu.length === 0 ? <p className="text-sm text-muted">Aún no hay impacto calculado.</p> : (
            <div className="overflow-x-auto">
              <table className="erp-table text-sm">
                <thead>
                  <tr>
                    <th>Receta</th>
                    <th>Insumo afectado</th>
                    <th className="!text-right">Variación insumo</th>
                    <th className="!text-right">Incremento del costo</th>
                    <th className="!text-right">Nuevo Food Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.impacto_menu.map((x, i) => (
                    <tr key={x.receta_id + '-' + x.insumo_id + '-' + i}>
                      <td className="font-medium">{x.receta}</td>
                      <td>{x.insumo}</td>
                      <td className={'text-right ' + (x.variacion_pct >= 0 ? 'text-red-600' : 'text-green-700')}>{pct(x.variacion_pct)}</td>
                      <td className="text-right font-semibold text-red-600">+{money(x.incremento_costo)}</td>
                      <td className={'text-right font-semibold ' + (x.fuera_objetivo ? 'text-red-600' : 'text-green-700')}>{(x.food_cost * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'simular' && <Simulador insumos={insumos} />}
    </div>
  );
}
