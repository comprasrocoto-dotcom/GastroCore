'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import SearchableSelect from '@/components/SearchableSelect';

type Familia = { id: string; nombre: string; tipo?: string; activo: boolean | string };
type Subfamilia = { id: string; familia_id: string; nombre: string; tipo?: string; activo: boolean | string };

const esReceta = (t?: string) => String(t || '').toLowerCase() === 'receta';

export default function FamiliasRecetasPage() {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [subfamilias, setSubfamilias] = useState<Subfamilia[]>([]);
  const [cargando, setCargando] = useState(true);

  const [nuevaFamilia, setNuevaFamilia] = useState('');
  const [guardandoFam, setGuardandoFam] = useState(false);

  const [subFamiliaId, setSubFamiliaId] = useState('');
  const [nuevaSub, setNuevaSub] = useState('');
  const [guardandoSub, setGuardandoSub] = useState(false);

  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [rf, rs] = await Promise.all([
        fetch('/api/familias', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/subfamilias', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      const fams: Familia[] = (rf?.data || []).filter((f: Familia) => esReceta(f.tipo));
      setFamilias(fams);
      setSubfamilias(rs?.data || []);
      if (fams.length && !subFamiliaId) setSubFamiliaId(fams[0].id);
    } catch {
      setMsg({ tipo: 'error', texto: 'No se pudieron cargar las familias.' });
    } finally {
      setCargando(false);
    }
  }, [subFamiliaId]);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearFamilia(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nuevaFamilia.trim();
    if (!nombre) return;
    setGuardandoFam(true);
    setMsg(null);
    try {
      const r = await fetch('/api/familias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      }).then((res) => res.json());
      if (r?.ok) {
        setNuevaFamilia('');
        setMsg({ tipo: 'ok', texto: `Familia "${nombre}" creada.` });
        await cargar();
      } else {
        setMsg({ tipo: 'error', texto: r?.error || 'No se pudo crear la familia.' });
      }
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red al crear la familia.' });
    } finally {
      setGuardandoFam(false);
    }
  }

  async function crearSubfamilia(e: React.FormEvent) {
    e.preventDefault();
    const nombre = nuevaSub.trim();
    if (!nombre || !subFamiliaId) return;
    setGuardandoSub(true);
    setMsg(null);
    try {
      const r = await fetch('/api/subfamilias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familia_id: subFamiliaId, nombre }),
      }).then((res) => res.json());
      if (r?.ok) {
        setNuevaSub('');
        setMsg({ tipo: 'ok', texto: `Subfamilia "${nombre}" creada.` });
        await cargar();
      } else {
        setMsg({ tipo: 'error', texto: r?.error || 'No se pudo crear la subfamilia.' });
      }
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red al crear la subfamilia.' });
    } finally {
      setGuardandoSub(false);
    }
  }

  const subsDe = (familiaId: string) =>
    subfamilias.filter((s) => String(s.familia_id) === String(familiaId) && esReceta(s.tipo));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ambar-700">Familias de platos de venta</h1>
          <p className="text-sm text-salvia-500">Crea y organiza las familias y subfamilias para clasificar tus recetas.</p>
        </div>
        <Link href="/recetas" className="rounded-md border border-salvia-200 px-3 py-2 text-sm text-salvia-600 hover:bg-salvia-50">
          Volver al recetario
        </Link>
      </div>

      {msg && (
        <div
          className={`mb-4 rounded-md px-4 py-2 text-sm ${
            msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.texto}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={crearFamilia} className="rounded-lg border border-salvia-100 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Nueva familia</h2>
          <label className="mb-1 block text-xs font-medium text-salvia-500">Nombre de la familia</label>
          <input
            value={nuevaFamilia}
            onChange={(e) => setNuevaFamilia(e.target.value)}
            placeholder="Ej: Entradas, Platos Fuertes, Postres"
            className="w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={guardandoFam || !nuevaFamilia.trim()}
            className="mt-3 w-full rounded-md bg-ambar-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ambar-700 disabled:opacity-50"
          >
            {guardandoFam ? 'Creando...' : 'Crear familia'}
          </button>
        </form>

        <form onSubmit={crearSubfamilia} className="rounded-lg border border-salvia-100 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Nueva subfamilia</h2>
          <label className="mb-1 block text-xs font-medium text-salvia-500">Familia</label>
          <div className="mb-2">
                <SearchableSelect
                  value={subFamiliaId}
                  onChange={(v) => setSubFamiliaId(v)}
                  options={familias.map((f) => ({ value: f.id, label: f.nombre }))}
                  placeholder={familias.length ? 'Selecciona una familia' : 'Crea una familia primero'}
                  searchPlaceholder="Buscar familia…"
                  clearLabel="— Selecciona una familia —"
                  disabled={!familias.length}
                />
              </div>
          <label className="mb-1 block text-xs font-medium text-salvia-500">Nombre de la subfamilia</label>
          <input
            value={nuevaSub}
            onChange={(e) => setNuevaSub(e.target.value)}
            placeholder="Ej: Ceviches, Sopas, Tortas"
            className="w-full rounded-md border border-salvia-200 px-3 py-2 text-sm focus:border-ambar-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={guardandoSub || !nuevaSub.trim() || !subFamiliaId}
            className="mt-3 w-full rounded-md bg-ambar-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ambar-700 disabled:opacity-50"
          >
            {guardandoSub ? 'Creando...' : 'Crear subfamilia'}
          </button>
        </form>
      </div>

      <section className="mt-6 rounded-lg border border-salvia-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Familias existentes</h2>
        {cargando ? (
          <p className="text-sm text-salvia-400">Cargando...</p>
        ) : familias.length === 0 ? (
          <p className="text-sm text-salvia-400">Aun no has creado familias de platos de venta. Usa el formulario de arriba para empezar.</p>
        ) : (
          <ul className="space-y-3">
            {familias.map((f) => (
              <li key={f.id} className="rounded-md border border-salvia-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-salvia-700">{f.nombre}</span>
                  <span className="text-xs text-salvia-400">{f.id}</span>
                </div>
                {subsDe(f.id).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {subsDe(f.id).map((s) => (
                      <span key={s.id} className="rounded-full bg-salvia-50 px-2.5 py-0.5 text-xs text-salvia-600">
                        {s.nombre}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
