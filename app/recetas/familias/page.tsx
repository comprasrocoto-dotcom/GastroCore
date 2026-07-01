'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SearchableSelect from '@/components/SearchableSelect';

type Familia = { id: string; nombre: string; tipo?: string; activo: boolean | string };
type Subfamilia = { id: string; familia_id: string; nombre: string; tipo?: string; activo: boolean | string };

const esReceta = (t?: string) => String(t || '').toLowerCase() === 'receta';
const esActivo = (a: boolean | string) => a === true || a === 'true' || a === 'TRUE' || a === 'VERDADERO';

export default function FamiliasRecetasPage() {
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [subfamilias, setSubfamilias] = useState<Subfamilia[]>([]);
  const [cargando, setCargando] = useState(true);

  const [nuevaFamilia, setNuevaFamilia] = useState('');
  const [guardandoFam, setGuardandoFam] = useState(false);

  const [subFamiliaId, setSubFamiliaId] = useState('');
  const [nuevaSub, setNuevaSub] = useState('');
  const [guardandoSub, setGuardandoSub] = useState(false);

  const [editFamId, setEditFamId] = useState('');
  const [editFamNombre, setEditFamNombre] = useState('');
  const [editSubId, setEditSubId] = useState('');
  const [editSubNombre, setEditSubNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [rf, rs] = await Promise.all([
        fetch('/api/familias', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/subfamilias', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      const fams: Familia[] = (rf.data || []).filter((f: Familia) => esReceta(f.tipo));
      setFamilias(fams);
      setSubfamilias(rs.data || []);
      if (fams.length && !subFamiliaId) setSubFamiliaId(fams[0].id);
    } catch {
      setMsg({ tipo: 'error', texto: 'No se pudieron cargar las familias.' });
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (r.ok) {
        setNuevaFamilia('');
        setMsg({ tipo: 'ok', texto: `Familia "${nombre}" creada.` });
        await cargar();
      } else {
        setMsg({ tipo: 'error', texto: r.error || 'No se pudo crear la familia.' });
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
        body: JSON.stringify({ nombre, familia_id: subFamiliaId }),
      }).then((res) => res.json());
      if (r.ok) {
        setNuevaSub('');
        setMsg({ tipo: 'ok', texto: `Subfamilia "${nombre}" creada.` });
        await cargar();
      } else {
        setMsg({ tipo: 'error', texto: r.error || 'No se pudo crear la subfamilia.' });
      }
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red al crear la subfamilia.' });
    } finally {
      setGuardandoSub(false);
    }
  }

  async function guardarFamilia(id: string) {
    const nombre = editFamNombre.trim();
    if (!nombre) return;
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch('/api/familias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nombre }),
      }).then((res) => res.json());
      if (r.ok) {
        setEditFamId('');
        setMsg({ tipo: 'ok', texto: 'Familia actualizada.' });
        await cargar();
      } else {
        setMsg({ tipo: 'error', texto: r.error || 'No se pudo actualizar.' });
      }
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red al actualizar.' });
    } finally {
      setOcupado(false);
    }
  }

  async function desactivarFamilia(id: string, nombre: string) {
    if (!confirm(`¿Desactivar la familia "${nombre}"? Dejara de mostrarse en el recetario (borrado logico, se puede reactivar en la base).`)) return;
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch('/api/familias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo: false }),
      }).then((res) => res.json());
      if (r.ok) {
        setMsg({ tipo: 'ok', texto: `Familia "${nombre}" desactivada.` });
        await cargar();
      } else {
        setMsg({ tipo: 'error', texto: r.error || 'No se pudo desactivar.' });
      }
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red al desactivar.' });
    } finally {
      setOcupado(false);
    }
  }

  async function guardarSubfamilia(id: string) {
    const nombre = editSubNombre.trim();
    if (!nombre) return;
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch('/api/subfamilias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nombre }),
      }).then((res) => res.json());
      if (r.ok) {
        setEditSubId('');
        setMsg({ tipo: 'ok', texto: 'Subfamilia actualizada.' });
        await cargar();
      } else {
        setMsg({ tipo: 'error', texto: r.error || 'No se pudo actualizar.' });
      }
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red al actualizar.' });
    } finally {
      setOcupado(false);
    }
  }

  async function desactivarSubfamilia(id: string, nombre: string) {
    if (!confirm(`¿Desactivar la subfamilia "${nombre}"? (borrado logico)`)) return;
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetch('/api/subfamilias', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo: false }),
      }).then((res) => res.json());
      if (r.ok) {
        setMsg({ tipo: 'ok', texto: `Subfamilia "${nombre}" desactivada.` });
        await cargar();
      } else {
        setMsg({ tipo: 'error', texto: r.error || 'No se pudo desactivar.' });
      }
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red al desactivar.' });
    } finally {
      setOcupado(false);
    }
  }

  const subsDe = (fid: string) =>
    subfamilias.filter((s) => String(s.familia_id) === String(fid) && esReceta(s.tipo) && esActivo(s.activo));

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ambar-800">Familias de platos de venta</h1>
          <p className="text-sm text-salvia-500">Crea, edita o desactiva las familias y subfamilias de tus recetas.</p>
        </div>
        <Link href="/recetas" className="text-sm font-medium text-ambar hover:underline">Volver al recetario</Link>
      </div>

      {msg && (
        <p className={`mb-4 rounded-md border p-3 text-sm ${msg.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {msg.texto}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={crearFamilia} className="card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Nueva familia</h2>
          <input
            value={nuevaFamilia}
            onChange={(e) => setNuevaFamilia(e.target.value)}
            placeholder="Ej: Entradas, Fondos, Postres…"
            className="mb-3 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
          />
          <button type="submit" disabled={guardandoFam} className="btn-primary w-full disabled:opacity-50">
            {guardandoFam ? 'Creando…' : 'Crear familia'}
          </button>
        </form>

        <form onSubmit={crearSubfamilia} className="card p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Nueva subfamilia</h2>
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
          <input
            value={nuevaSub}
            onChange={(e) => setNuevaSub(e.target.value)}
            placeholder="Ej: Ceviches, Tiraditos…"
            className="mb-3 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
          />
          <button type="submit" disabled={guardandoSub || !familias.length} className="btn-primary w-full disabled:opacity-50">
            {guardandoSub ? 'Creando…' : 'Crear subfamilia'}
          </button>
        </form>
      </div>

      <section className="mt-6 card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-salvia-500">Familias existentes</h2>
        {cargando ? (
          <p className="text-sm text-salvia-400">Cargando…</p>
        ) : familias.length === 0 ? (
          <p className="text-sm text-salvia-400">Aun no has creado familias de platos de venta. Usa el formulario de arriba para empezar.</p>
        ) : (
          <ul className="space-y-3">
            {familias.map((f) => (
              <li key={f.id} className="rounded-md border border-salvia-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  {editFamId === f.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        value={editFamNombre}
                        onChange={(e) => setEditFamNombre(e.target.value)}
                        className="flex-1 rounded-md border border-ambar-300 px-2 py-1 text-sm focus:border-ambar-400 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={() => guardarFamilia(f.id)} disabled={ocupado} className="rounded bg-ambar px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Guardar</button>
                      <button onClick={() => setEditFamId('')} disabled={ocupado} className="rounded border border-salvia-200 px-3 py-1 text-xs text-salvia-600">Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span className="font-medium text-salvia-700">{f.nombre}</span>
                        <span className="ml-2 text-xs text-salvia-400">{f.id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditFamId(f.id); setEditFamNombre(f.nombre); }} className="rounded border border-salvia-200 px-3 py-1 text-xs text-salvia-600 hover:bg-salvia-50">Editar</button>
                        <button onClick={() => desactivarFamilia(f.id, f.nombre)} disabled={ocupado} className="rounded border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">Desactivar</button>
                      </div>
                    </>
                  )}
                </div>
                {subsDe(f.id).length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-salvia-50 pt-2">
                    {subsDe(f.id).map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2 pl-3 text-sm">
                        {editSubId === s.id ? (
                          <div className="flex flex-1 items-center gap-2">
                            <input
                              value={editSubNombre}
                              onChange={(e) => setEditSubNombre(e.target.value)}
                              className="flex-1 rounded-md border border-ambar-300 px-2 py-1 text-sm focus:border-ambar-400 focus:outline-none"
                              autoFocus
                            />
                            <button onClick={() => guardarSubfamilia(s.id)} disabled={ocupado} className="rounded bg-ambar px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Guardar</button>
                            <button onClick={() => setEditSubId('')} disabled={ocupado} className="rounded border border-salvia-200 px-3 py-1 text-xs text-salvia-600">Cancelar</button>
                          </div>
                        ) : (
                          <>
                            <span className="rounded-full bg-salvia-50 px-2.5 py-0.5 text-xs text-salvia-600">{s.nombre}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setEditSubId(s.id); setEditSubNombre(s.nombre); }} className="rounded border border-salvia-200 px-2 py-0.5 text-xs text-salvia-600 hover:bg-salvia-50">Editar</button>
                              <button onClick={() => desactivarSubfamilia(s.id, s.nombre)} disabled={ocupado} className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">Desactivar</button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
