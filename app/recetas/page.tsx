'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SearchableSelect from '@/components/SearchableSelect';
import { precioSugerido as precioSugeridoObjetivo, FC_OBJ, INC } from '@/lib/costeo';
import { BookOpen, DollarSign, CheckCircle, TriangleAlert, Tag, CalendarClock } from 'lucide-react';

type Receta = any;
type Subfamilia = { id: string; familia_id: string; nombre: string; tipo?: string; activo: any };
type Familia = { id: string; nombre: string; tipo?: string; activo: any };

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const fcPct = (n: number) => ((Number(n) || 0) * 100).toFixed(1) + '%';

// FC_OBJ, INC y precioSugeridoObjetivo provienen de la fuente unica (lib/costeo).

function semaforo(fc: number) {
  const v = Number(fc) || 0;
  if (v <= 0.33) return { color: '#16A34A', text: 'text-[#16A34A]', bg: 'bg-[#DCFCE7]', border: 'border-[#BBF7D0]', emoji: '🟢', label: 'Rentable' };
  if (v <= 0.35) return { color: '#F59E0B', text: 'text-[#B45309]', bg: 'bg-[#FEF3C7]', border: 'border-[#FDE68A]', emoji: '🟡', label: 'Vigilar' };
  return { color: '#DC2626', text: 'text-[#DC2626]', bg: 'bg-[#FEE2E2]', border: 'border-[#FECACA]', emoji: '🔴', label: 'Accion inmediata' };
}

function Semaforo({ fc }: { fc: number }) {
  const s = semaforo(fc);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.bg} ${s.text} ${s.border}`}
      title={`Food Cost ${fcPct(fc)} - ${s.label}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
      <span className="tabular-nums">{fcPct(fc)}</span>
      <span className="hidden opacity-90 sm:inline">· {s.label}</span>
    </span>
  );
}

export default function RecetarioClient() {
  const router = useRouter();
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [subfamilias, setSubfamilias] = useState<Subfamilia[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function toggleActivo(r: Receta) {
    const nuevo = !(r.activo === true || r.activo === 'TRUE' || r.activo === 'VERDADERO' || r.activo === '' || r.activo === undefined);
    setSavingId(r.id);
    setRecetas((prev) => prev.map((x) => (x.id === r.id ? { ...x, activo: nuevo } : x)));
    try {
      const res = await fetch('/api/recetas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, activo: nuevo }),
      });
      const j = await res.json();
      if (!j.ok) {
        const em = j.error && typeof j.error === 'object' ? (j.error.message || JSON.stringify(j.error)) : (j.error || 'No se pudo actualizar el estado');
        throw new Error(em);
      }
    } catch (e: any) {
      setRecetas((prev) => prev.map((x) => (x.id === r.id ? { ...x, activo: r.activo } : x)));
      setError(e?.message || 'Error al cambiar el estado');
    } finally {
      setSavingId(null);
    }
  }

  const [q, setQ] = useState('');
  const [famSel, setFamSel] = useState('');
  const [subSel, setSubSel] = useState('');
  const [fcSel, setFcSel] = useState('');
  const [estadoSel, setEstadoSel] = useState('activos');

  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        setLoading(true);
        const [rR, rS, rF] = await Promise.all([
          fetch('/api/recetas?all=true', { cache: 'no-store' }).then((r) => r.json()),
          fetch('/api/subfamilias', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] })),
          fetch('/api/familias', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] })),
        ]);
        if (cancel) return;
        setRecetas(Array.isArray(rR?.data) ? rR.data : []);
        setSubfamilias(Array.isArray(rS?.data) ? rS.data : []);
        setFamilias(Array.isArray(rF?.data) ? rF.data : []);
      } catch (e: any) {
        if (!cancel) setError(e?.message || 'Error al cargar');
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => { cancel = true; };
  }, []);

  const subMap = useMemo(() => new Map(subfamilias.map((s) => [s.id, s])), [subfamilias]);
  const famMap = useMemo(() => new Map(familias.map((f) => [f.id, f])), [familias]);

  const esReceta = (t?: string) => String(t || '').toLowerCase() === 'receta';
  const famRecetas = useMemo(
    () => familias.filter((f) => esReceta(f.tipo) || (!f.tipo && f.id !== 'FAM-000001')),
    [familias]
  );
  const subRecetas = useMemo(
    () => subfamilias.filter((s) => esReceta(s.tipo) || (!s.tipo && s.familia_id !== 'FAM-000001')),
    [subfamilias]
  );

  function subNombre(r: Receta) {
    const s = subMap.get(r.subfamilia_id);
    return s ? s.nombre : 'Sin clasificar';
  }
  function famNombre(r: Receta) {
    const s = subMap.get(r.subfamilia_id);
    const f = s ? famMap.get(s.familia_id) : null;
    return f ? f.nombre : 'General';
  }
  function esActivo(r: Receta) {
    return r.activo === true || r.activo === 'true' || r.activo === 'TRUE' || r.activo === 1;
  }

  const filtradas = useMemo(() => {
    return recetas.filter((r) => {
      if (q && !String(r.nombre || '').toLowerCase().includes(q.toLowerCase())) return false;
      if (subSel && r.subfamilia_id !== subSel) return false;
      if (famSel) {
        const s = subMap.get(r.subfamilia_id);
        if (!s || s.familia_id !== famSel) return false;
      }
      if (estadoSel === 'activos' && !esActivo(r)) return false;
      if (estadoSel === 'inactivos' && esActivo(r)) return false;
      const fc = Number(r.food_cost) || 0;
      if (fcSel === 'verde' && !(fc <= 0.33)) return false;
      if (fcSel === 'amarillo' && !(fc > 0.33 && fc <= 0.35)) return false;
      if (fcSel === 'rojo' && !(fc > 0.35)) return false;
      return true;
    });
  }, [recetas, q, subSel, famSel, estadoSel, fcSel, subMap]);

  const grupos = useMemo(() => {
    const map = new Map<string, Receta[]>();
    for (const r of filtradas) {
      const key = subNombre(r);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtradas, subMap]);

  const stats = useMemo(() => {
    const act = recetas.filter(esActivo);
    const n = act.length;
    const costoProm = n ? act.reduce((a, r) => a + (Number(r.costo_porcion) || 0), 0) / n : 0;
    const conFc = act.filter((r) => Number(r.food_cost) > 0);
    const fcProm = conFc.length ? conFc.reduce((a, r) => a + Number(r.food_cost), 0) / conFc.length : 0;
    const rentables = act.filter((r) => Number(r.food_cost) > 0 && Number(r.food_cost) <= 0.35).length;
    const fuera = act.filter((r) => Number(r.food_cost) > 0.35).length;
    const sinPrecio = act.filter((r) => !(Number(r.precio_real) > 0)).length;
    const hoy = new Date().toISOString().slice(0, 10);
    const actualizadasHoy = act.filter((r) => String(r.actualizado_en || '').slice(0, 10) === hoy).length;
    return { n, costoProm, fcProm, rentables, fuera, sinPrecio, actualizadasHoy };
  }, [recetas]);

  const familiasSidebar = useMemo(() => {
    const m = new Map<string, { fam: Familia | null; subs: Map<string, { sub: Subfamilia | null; count: number }> }>();
    for (const f of famRecetas) {
      m.set(f.id, { fam: f, subs: new Map() });
      for (const s of subRecetas.filter((x) => String(x.familia_id) === String(f.id))) {
        m.get(f.id)!.subs.set(s.id, { sub: s, count: 0 });
      }
    }
    for (const r of recetas.filter(esActivo)) {
      const s = subMap.get(r.subfamilia_id) || null;
      const f = s ? famMap.get(s.familia_id) || null : null;
      const fkey = f ? f.id : '__gen';
      if (!m.has(fkey)) m.set(fkey, { fam: f, subs: new Map() });
      const grp = m.get(fkey)!;
      const skey = s ? s.id : '__none';
      if (!grp.subs.has(skey)) grp.subs.set(skey, { sub: s, count: 0 });
      grp.subs.get(skey)!.count++;
    }
    return Array.from(m.values());
  }, [recetas, subMap, famMap, famRecetas, subRecetas]);

  return (
    <div className="app-shell flex min-h-screen gap-4">
      <aside className="hidden w-60 shrink-0 border-r border-salvia-100 bg-salvia-50/40 p-4 lg:block">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-salvia-500">Familias</h2>
        <button onClick={() => { setFamSel(''); setSubSel(''); }} className={`mb-1 block w-full rounded-md px-2 py-1.5 text-left text-sm ${!famSel ? 'bg-ambar-100 font-semibold text-ambar-800' : 'text-salvia-700 hover:bg-salvia-100'}`}>Todas las recetas</button>
        {familiasSidebar.map((g, i) => (
          <div key={i} className="mb-2">
            <button onClick={() => { setFamSel(g.fam ? g.fam.id : ''); setSubSel(''); }} className={`block w-full rounded-md px-2 py-1.5 text-left text-sm font-medium ${g.fam && famSel === g.fam.id ? 'bg-ambar-100 text-ambar-800' : 'text-salvia-800 hover:bg-salvia-100'}`}>
              {g.fam ? g.fam.nombre : 'General'}
            </button>
            <div className="ml-2 mt-0.5">
              {Array.from(g.subs.values()).map((sc, j) => (
                <button key={j} onClick={() => { setSubSel(sc.sub ? sc.sub.id : ''); setFamSel(g.fam ? g.fam.id : ''); }} className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${sc.sub && subSel === sc.sub.id ? 'bg-ambar-50 font-semibold text-ambar-700' : 'text-salvia-600 hover:bg-salvia-100'}`}>
                  <span>{sc.sub ? sc.sub.nombre : 'Sin clasificar'}</span>
                  <span className="text-salvia-400">{sc.count}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      <main className="min-w-0 flex-1 py-6 lg:pl-6">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-salvia-100 pb-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-salvia-400">GastroCore · Recetario</p>
            <h1 className="font-display text-[32px] font-bold leading-tight text-ambar-700">Recetario</h1>
            <p className="mt-1 text-[16px] text-salvia-600">Consulta y administra tus recetas por familia, con costeo en tiempo real.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/recetas/familias" className="btn-secondary">Familias</Link>
            <Link href="/recetas/resumen" className="btn-secondary">Panel ejecutivo</Link>
            <Link href="/recetas/nueva" className="btn-primary">+ Nueva receta</Link>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-5 md:grid-cols-4 xl:grid-cols-4">
          <Card label="Total recetas" value={String(stats.n)} tone="indigo" icon={<BookOpen size={18} strokeWidth={2} />} />
          <Card label="Costo promedio" value={money(stats.costoProm)} tone="blue" icon={<DollarSign size={18} strokeWidth={2} />} />
          <FoodCostCard fc={stats.fcProm} />
          <Card label="Rentables" value={String(stats.rentables)} tone="green" icon={<CheckCircle size={18} strokeWidth={2} />} />
          <Card label="Fuera de objetivo" value={String(stats.fuera)} tone="red" icon={<TriangleAlert size={18} strokeWidth={2} />} />
          <Card label="Sin precio" value={String(stats.sinPrecio)} tone="amber" icon={<Tag size={18} strokeWidth={2} />} />
          <Card label="Actualizadas hoy" value={String(stats.actualizadasHoy)} tone="neutral" icon={<CalendarClock size={18} strokeWidth={2} />} />
        </section>

        <section className="mb-6 flex flex-wrap items-center gap-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar receta..." className="min-w-[300px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-[15px] focus:border-ambar-400 focus:outline-none" />
          <div className="min-w-[250px] flex-1">
              <SearchableSelect
                value={famSel}
                onChange={(v) => { setFamSel(v); setSubSel(''); }}
                options={famRecetas.map((f) => ({ value: f.id, label: f.nombre }))}
                placeholder="Todas las familias"
                searchPlaceholder="Buscar familia…"
                clearLabel="Todas las familias"
              />
            </div>
          <div className="min-w-[250px] flex-1">
              <SearchableSelect
                value={subSel}
                onChange={(v) => setSubSel(v)}
                options={subRecetas.filter((s) => !famSel || String(s.familia_id) === String(famSel)).map((s) => ({ value: s.id, label: s.nombre }))}
                placeholder="Todas las subfamilias"
                searchPlaceholder="Buscar subfamilia…"
                clearLabel="Todas las subfamilias"
              />
            </div>
          <select value={fcSel} onChange={(e) => setFcSel(e.target.value)} className="min-w-[220px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-[15px]">
            <option value="">Food Cost: todos</option>
            <option value="verde">Verde (&le;33%)</option>
            <option value="amarillo">Amarillo (33-35%)</option>
            <option value="rojo">Rojo (&gt;35%)</option>
          </select>
          <select value={estadoSel} onChange={(e) => setEstadoSel(e.target.value)} className="min-w-[180px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-[15px]">
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </section>

        {loading ? (
          <p className="py-10 text-center text-salvia-500">Cargando recetas...</p>
        ) : error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : grupos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-salvia-200 p-10 text-center text-salvia-500">No hay recetas que coincidan con los filtros.</div>
        ) : (
          <div className="space-y-6">
            {grupos.map(([sub, items]) => (
              <div key={sub}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-salvia-700"><span>{sub}</span><span className="rounded-full bg-salvia-100 px-2 text-xs text-salvia-500">{items.length}</span></h3>
                <div className="card overflow-hidden">
                  <div className="erp-scroll">
                  <table className="erp-table recetas-table">
                    <thead>
                      <tr>
                        <th>Receta</th>
                        <th>Familia</th>
                        <th>Subfamilia</th>
                        <th className="!text-right">Costo porcion</th>
                        <th className="!text-right">Precio venta</th>
                        <th className="!text-right">Precio sugerido</th>
                        <th className="!text-center">Food Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => {
                        const fc = Number(r.food_cost);
                        const sinPrecio = !(Number(r.precio_real) > 0);
                        const sugerido = precioSugeridoObjetivo(Number(r.costo_porcion));
                        return (
                        <tr
                          key={r.id}
                          onClick={() => router.push(`/recetas/${r.id}`)}
                          className={esActivo(r) ? '' : 'bg-slate-50 text-slate-400 opacity-70'}
                        >
                          <td className="font-medium"><span className="text-[#2563EB]">{r.nombre}</span></td>
                          <td className="text-muted">{famNombre(r)}</td>
                          <td className="text-muted">{subNombre(r)}</td>
                          <td className="text-right fin-value">{money(Number(r.costo_porcion))}</td>
                          <td className="text-right fin-value">{Number(r.precio_real) > 0 ? money(Number(r.precio_real)) : <span className="text-[#B45309] font-medium">sin precio</span>}</td>
                          <td className="text-right fin-value">
                            {sinPrecio || !(fc > 0) ? (
                              <span className="text-xs text-slate-400">-</span>
                            ) : fc > 0.35 ? (
                              <span className="font-semibold text-[#DC2626]" title="El precio debe aumentar para cumplir el objetivo">{money(sugerido)}</span>
                            ) : fc <= 0.33 ? (
                              <span className="font-semibold text-[#B45309]" title="El precio podria disminuir">{money(sugerido)}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#16A34A]" title="El precio actual cumple el objetivo"><span className="h-2 w-2 rounded-full bg-[#16A34A]" />&#10003; Correcto</span>
                            )}
                          </td>
                          <td className="text-center">{fc > 0 ? <Semaforo fc={fc} /> : <span className="text-xs text-slate-400">-</span>}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const TONES: Record<string, { bg: string; ring: string; icon: string; val: string }> = {
  neutral: { bg: 'bg-white', ring: 'border-line', icon: 'bg-slate-100 text-slate-500', val: 'text-ink' },
  blue: { bg: 'bg-[#EFF6FF]', ring: 'border-[#DBEAFE]', icon: 'bg-[#DBEAFE] text-[#2563EB]', val: 'text-[#1E3A5F]' },
  indigo: { bg: 'bg-[#EEF2FF]', ring: 'border-[#E0E7FF]', icon: 'bg-[#E0E7FF] text-[#1E3A5F]', val: 'text-[#1E3A5F]' },
  green: { bg: 'bg-[#ECFDF5]', ring: 'border-[#D1FAE5]', icon: 'bg-[#DCFCE7] text-[#16A34A]', val: 'text-[#16A34A]' },
  amber: { bg: 'bg-[#FFFBEB]', ring: 'border-[#FEF3C7]', icon: 'bg-[#FEF3C7] text-[#B45309]', val: 'text-[#B45309]' },
  red: { bg: 'bg-[#FEF2F2]', ring: 'border-[#FEE2E2]', icon: 'bg-[#FEE2E2] text-[#DC2626]', val: 'text-[#DC2626]' },
};

function Card({ label, value, tone = 'neutral', icon }: { label: string; value: string; tone?: string; icon?: ReactNode }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <div className={`card-hover flex h-full flex-col justify-between rounded-xl border ${t.ring} ${t.bg} p-5 shadow-card`}>
      <div className="flex items-start justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">{label}</p>
        {icon && <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.icon}`}>{icon}</span>}
      </div>
      <p className={`mt-3 text-[34px] font-bold leading-none tabular-nums tracking-tight ${t.val}`}>{value}</p>
    </div>
  );
}

function FoodCostCard({ fc }: { fc: number }) {
  const pct = Math.max(0, Math.min(1, fc));
  const s = semaforo(fc);
  const color = fc <= 0.33 ? '#16A34A' : fc <= 0.35 ? '#F59E0B' : '#DC2626';
  const bg = fc <= 0.33 ? '#ECFDF5' : fc <= 0.35 ? '#FFFBEB' : '#FEF2F2';
  const ring = fc <= 0.33 ? '#D1FAE5' : fc <= 0.35 ? '#FEF3C7' : '#FEE2E2';
  return (
    <div className="card-hover rounded-xl border p-4 shadow-card sm:col-span-2" style={{ backgroundColor: bg, borderColor: ring }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Food Cost prom.</p>
        <span className="text-[11px] font-semibold" style={{ color }}>{s.label}</span>
      </div>
      <div className="mt-2 flex items-end gap-3">
        <p className="text-3xl font-bold tabular-nums tracking-tight" style={{ color }}>{fcPct(fc)}</p>
      </div>
      <div className="progress-track mt-3">
        <div className="progress-fill" style={{ width: `${(pct * 100).toFixed(0)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
