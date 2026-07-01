'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SearchableSelect from '@/components/SearchableSelect';

type Receta = any;
type Subfamilia = { id: string; familia_id: string; nombre: string; tipo?: string; activo: any };
type Familia = { id: string; nombre: string; tipo?: string; activo: any };

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const fcPct = (n: number) => ((Number(n) || 0) * 100).toFixed(1) + '%';

const FC_OBJ = 0.35;

function semaforo(fc: number) {
  const v = Number(fc) || 0;
  if (v <= 0.35) return { color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Optimo' };
  if (v <= 0.40) return { color: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Alerta' };
  return { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Critico' };
}

function Semaforo({ fc }: { fc: number }) {
  const s = semaforo(fc);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`h-2 w-2 rounded-full ${s.color}`} />
      {fcPct(fc)}
    </span>
  );
}

export default function RecetarioClient() {
  const [recetas, setRecetas] = useState<Receta[]>([]);
  const [subfamilias, setSubfamilias] = useState<Subfamilia[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          fetch('/api/recetas', { cache: 'no-store' }).then((r) => r.json()),
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
      if (fcSel === 'verde' && !(fc <= 0.35)) return false;
      if (fcSel === 'amarillo' && !(fc > 0.35 && fc <= 0.40)) return false;
      if (fcSel === 'rojo' && !(fc > 0.40)) return false;
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
    <div className="flex min-h-screen">
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

      <main className="flex-1 px-4 py-6 lg:px-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ambar-700">Recetario</h1>
            <p className="text-sm text-salvia-600">Consulta y administra tus recetas por familia, con costeo en tiempo real.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/recetas/familias" className="rounded-md border border-salvia-200 px-3 py-2 text-sm font-medium text-salvia-700 hover:bg-salvia-50">Familias</Link>
            <Link href="/recetas/resumen" className="rounded-md border border-salvia-200 px-3 py-2 text-sm font-medium text-salvia-700 hover:bg-salvia-50">Panel ejecutivo</Link>
            <Link href="/recetas/nueva" className="btn-primary">+ Nueva receta</Link>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          <Card label="Total recetas" value={String(stats.n)} />
          <Card label="Costo prom." value={money(stats.costoProm)} />
          <Card label="Food Cost prom." value={fcPct(stats.fcProm)} accent={semaforo(stats.fcProm).text} />
          <Card label="Rentables" value={String(stats.rentables)} accent="text-emerald-700" />
          <Card label="Fuera de objetivo" value={String(stats.fuera)} accent="text-red-700" />
          <Card label="Sin precio" value={String(stats.sinPrecio)} accent="text-amber-700" />
          <Card label="Actualizadas hoy" value={String(stats.actualizadasHoy)} />
        </section>

        <section className="mb-4 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar receta..." className="w-56 rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-400 focus:outline-none" />
          <div className="w-44">
              <SearchableSelect
                value={famSel}
                onChange={(v) => { setFamSel(v); setSubSel(''); }}
                options={famRecetas.map((f) => ({ value: f.id, label: f.nombre }))}
                placeholder="Todas las familias"
                searchPlaceholder="Buscar familia…"
                clearLabel="Todas las familias"
              />
            </div>
          <div className="w-44">
              <SearchableSelect
                value={subSel}
                onChange={(v) => setSubSel(v)}
                options={subRecetas.filter((s) => !famSel || String(s.familia_id) === String(famSel)).map((s) => ({ value: s.id, label: s.nombre }))}
                placeholder="Todas las subfamilias"
                searchPlaceholder="Buscar subfamilia…"
                clearLabel="Todas las subfamilias"
              />
            </div>
          <select value={fcSel} onChange={(e) => setFcSel(e.target.value)} className="rounded-md border border-salvia-200 px-2 py-2 text-sm">
            <option value="">Food Cost: todos</option>
            <option value="verde">Verde (&lt;=35%)</option>
            <option value="amarillo">Amarillo (35-40%)</option>
            <option value="rojo">Rojo (&gt;40%)</option>
          </select>
          <select value={estadoSel} onChange={(e) => setEstadoSel(e.target.value)} className="rounded-md border border-salvia-200 px-2 py-2 text-sm">
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
                <div className="overflow-x-auto rounded-lg border border-salvia-100">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-salvia-50 text-left text-salvia-600">
                        <th className="px-3 py-2 font-medium">Receta</th>
                        <th className="px-3 py-2 font-medium">Codigo</th>
                        <th className="px-3 py-2 text-right font-medium">Costo porcion</th>
                        <th className="px-3 py-2 text-right font-medium">Precio venta</th>
                        <th className="px-3 py-2 text-center font-medium">Food Cost</th>
                        <th className="px-3 py-2 text-center font-medium">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => (
                        <tr key={r.id} className="border-t border-salvia-50 hover:bg-ambar-50/40">
                          <td className="px-3 py-2 font-medium"><Link href={`/recetas/${r.id}`} className="text-ambar-700 hover:underline">{r.nombre}</Link></td>
                          <td className="px-3 py-2 font-mono text-xs text-salvia-500">{r.id}</td>
                          <td className="px-3 py-2 text-right font-mono">{money(Number(r.costo_porcion))}</td>
                          <td className="px-3 py-2 text-right font-mono">{Number(r.precio_real) > 0 ? money(Number(r.precio_real)) : <span className="text-amber-500">sin precio</span>}</td>
                          <td className="px-3 py-2 text-center">{Number(r.food_cost) > 0 ? <Semaforo fc={Number(r.food_cost)} /> : <span className="text-xs text-salvia-400">-</span>}</td>
                          <td className="px-3 py-2 text-center">{esActivo(r) ? <span className="text-xs text-emerald-600">Activo</span> : <span className="text-xs text-salvia-400">Inactivo</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-salvia-100 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-salvia-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent || 'text-salvia-800'}`}>{value}</p>
    </div>
  );
}
