'use client';

/**
 * ADMINISTRAR FAMILIAS — v9.3 (rediseño completo)
 *
 * Dos mundos claros, como opera el negocio:
 *   🍽 FAMILIAS DE RECETAS: las categorías de la carta. Cada tarjeta muestra
 *      su familia con centro de costo, cuántas recetas viven en ella y sus
 *      subfamilias adentro (la unión es visible, no un rompecabezas).
 *   📦 CLASIFICACIONES DE INSUMOS: las subfamilias del maestro (FRUVER,
 *      ABARROTES...), con su conteo de insumos y centro de costo.
 *
 * Reglas de trabajo:
 *   - Crear y editar EN LÍNEA (nombre + centro de costo juntos, un solo flujo).
 *   - El centro de costo se HEREDA: subfamilia vacía usa el de su familia.
 *   - Solo Admin muta; Chef y Lector ven todo en modo lectura.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchEnCola } from '@/lib/colaGuardado';
import { useRol } from '@/lib/useRol';
import { Ayuda } from '@/components/Ayuda';

type Familia = { id: string; nombre: string; tipo?: string; activo: boolean | string; centrocosto?: string };
type Subfamilia = { id: string; familia_id: string; nombre: string; tipo?: string; activo: boolean | string; centrocosto?: string };

const esActivo = (v: boolean | string) => v === true || v === 'TRUE' || v === 'True' || v === '';

export default function FamiliasPage() {
  const { esAdmin } = useRol();

  const [familias, setFamilias] = useState<Familia[]>([]);
  const [subfamilias, setSubfamilias] = useState<Subfamilia[]>([]);
  const [usoRecetas, setUsoRecetas] = useState<Map<string, number>>(new Map());
  const [usoInsumos, setUsoInsumos] = useState<Map<string, number>>(new Map());
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // ── creación ──
  const [nuevaFamilia, setNuevaFamilia] = useState('');
  const [nuevaFamiliaCC, setNuevaFamiliaCC] = useState('');
  const [nuevaClasif, setNuevaClasif] = useState('');
  const [nuevaClasifCC, setNuevaClasifCC] = useState('');
  const [subNueva, setSubNueva] = useState<{ familia_id: string; nombre: string } | null>(null);

  // ── edición en línea (un solo mecanismo para familias y subfamilias) ──
  const [edit, setEdit] = useState<{ clase: 'fam' | 'sub'; id: string; nombre: string; cc: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [rf, rs, rr, ri] = await Promise.all([
        fetch('/api/familias', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/subfamilias', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/recetas', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] })),
        fetch('/api/insumos', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ data: [] })),
      ]);
      setFamilias((rf?.data || []).filter((f: Familia) => esActivo(f.activo)));
      setSubfamilias((rs?.data || []).filter((s: Subfamilia) => esActivo(s.activo)));
      const ur = new Map<string, number>();
      (rr?.data || []).forEach((x: { subfamilia_id?: string }) => {
        const k = String(x.subfamilia_id || '');
        ur.set(k, (ur.get(k) || 0) + 1);
      });
      setUsoRecetas(ur);
      const ui = new Map<string, number>();
      (ri?.data || []).forEach((x: { subfamilia_id?: string }) => {
        const k = String(x.subfamilia_id || '');
        ui.set(k, (ui.get(k) || 0) + 1);
      });
      setUsoInsumos(ui);
    } catch {
      setMsg({ tipo: 'error', texto: 'No se pudieron cargar las familias.' });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const esFamReceta = (f: Familia) => String(f.tipo || '').toLowerCase() === 'receta' || (!f.tipo && f.id !== 'FAM-000001');
  const famRecetas = useMemo(() => familias.filter(esFamReceta).sort((a, b) => a.nombre.localeCompare(b.nombre)), [familias]);
  const famInsumos = useMemo(() => familias.filter((f) => !esFamReceta(f)), [familias]);
  const famInsumoPrincipal = famInsumos[0] || null;

  const subsDe = useCallback((fid: string) => subfamilias.filter((s) => String(s.familia_id) === String(fid)), [subfamilias]);
  const clasifInsumos = useMemo(
    () => famInsumos.flatMap((f) => subsDe(f.id)).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [famInsumos, subsDe]
  );
  const recetasDeFamilia = (fid: string) => subsDe(fid).reduce((a, s) => a + (usoRecetas.get(s.id) || 0), 0);

  // ─────────────────────────── acciones ───────────────────────────
  async function llamar(url: string, method: string, body: Record<string, unknown>, okTexto: string) {
    setOcupado(true);
    setMsg(null);
    try {
      const r = await fetchEnCola(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((x) => x.json());
      if (r.ok) { setMsg({ tipo: 'ok', texto: okTexto }); await cargar(); return true; }
      setMsg({ tipo: 'error', texto: (r.error && r.error.message) || r.error || 'No se pudo guardar.' });
      return false;
    } catch {
      setMsg({ tipo: 'error', texto: 'Error de red.' });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function crearFamiliaReceta() {
    const nombre = nuevaFamilia.trim().toUpperCase();
    if (!nombre) return;
    if (await llamar('/api/familias', 'POST', { nombre, centrocosto: nuevaFamiliaCC.trim() }, `Familia "${nombre}" creada.`)) {
      setNuevaFamilia(''); setNuevaFamiliaCC('');
    }
  }
  async function crearClasifInsumo() {
    const nombre = nuevaClasif.trim().toUpperCase();
    if (!nombre || !famInsumoPrincipal) return;
    if (await llamar('/api/subfamilias', 'POST', { nombre, familia_id: famInsumoPrincipal.id, tipo: 'insumo', centrocosto: nuevaClasifCC.trim() }, `Clasificación "${nombre}" creada.`)) {
      setNuevaClasif(''); setNuevaClasifCC('');
    }
  }
  async function crearSubfamiliaDe(familia_id: string) {
    const nombre = (subNueva?.nombre || '').trim().toUpperCase();
    if (!nombre) return;
    if (await llamar('/api/subfamilias', 'POST', { nombre, familia_id, tipo: 'receta' }, `Subfamilia "${nombre}" creada.`)) {
      setSubNueva(null);
    }
  }
  async function guardarEdicion() {
    if (!edit) return;
    const url = edit.clase === 'fam' ? '/api/familias' : '/api/subfamilias';
    if (await llamar(url, 'PUT', { id: edit.id, nombre: edit.nombre.trim().toUpperCase(), centrocosto: edit.cc.trim() }, 'Cambios guardados.')) {
      setEdit(null);
    }
  }
  async function desactivar(clase: 'fam' | 'sub', id: string, nombre: string, enUso: number) {
    const aviso = enUso > 0
      ? `"${nombre}" tiene ${enUso} ${clase === 'fam' ? 'receta(s)' : 'elemento(s)'} clasificados. Quedarán SIN clasificación visible hasta reasignarlos. ¿Desactivar igual?`
      : `¿Desactivar "${nombre}"?`;
    if (!window.confirm(aviso)) return;
    const url = clase === 'fam' ? '/api/familias' : '/api/subfamilias';
    await llamar(url, 'PUT', { id, activo: false }, `"${nombre}" desactivada.`);
  }

  // ─────────────────────────── piezas de UI ───────────────────────────
  function ChipCC({ cc, heredado }: { cc?: string; heredado?: string }) {
    if (cc) return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">🏷 {cc}</span>;
    if (heredado) return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500" title="Heredado de la familia">🏷 {heredado} ↩</span>;
    return null;
  }

  function FilaEdicion() {
    if (!edit) return null;
    return (
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <input
          value={edit.nombre}
          onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
          className="min-w-[180px] flex-1 rounded-md border border-ambar-300 px-2 py-1.5 text-sm uppercase focus:border-ambar-400 focus:outline-none"
          autoFocus
        />
        <input
          value={edit.cc}
          onChange={(e) => setEdit({ ...edit, cc: e.target.value })}
          placeholder="Centro de costo"
          className="w-40 rounded-md border border-salvia-200 px-2 py-1.5 text-xs uppercase focus:border-ambar-400 focus:outline-none"
        />
        <button onClick={guardarEdicion} disabled={ocupado} className="rounded bg-ambar px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Guardar</button>
        <button onClick={() => setEdit(null)} disabled={ocupado} className="rounded border border-salvia-200 px-3 py-1.5 text-xs text-salvia-600">Cancelar</button>
      </div>
    );
  }

  const botonEditar = (clase: 'fam' | 'sub', x: { id: string; nombre: string; centrocosto?: string }) => (
    <button
      onClick={() => setEdit({ clase, id: x.id, nombre: x.nombre, cc: String(x.centrocosto || '') })}
      className="rounded border border-salvia-200 px-2.5 py-1 text-xs text-salvia-600 hover:bg-salvia-50"
    >✏️ Editar</button>
  );

  // ─────────────────────────── render ───────────────────────────
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6 border-b border-salvia-100 pb-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-salvia-400">GastroCore · Clasificaciones</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold text-ink">
            Administrar familias
            <Ayuda titulo="Cómo funciona la clasificación">
              <p><b>🍽 Familias de recetas</b> = las categorías de tu carta (ENTRADAS, CEVICHES…). Cada receta pertenece a una.</p>
              <p><b>📦 Clasificaciones de insumos</b> = cómo agrupas el maestro de compras (FRUVER, ABARROTES…).</p>
              <p><b>Centro de costo (🏷):</b> se hereda hacia abajo — si una subfamilia no tiene, usa el de su familia. Pon &quot;COCINA&quot; a la familia y afina solo donde haga falta.</p>
              <p><b>Desactivar</b> no borra nada: el historial y las recetas quedan intactos, solo deja de aparecer en los selectores.</p>
            </Ayuda>
          </h1>
          <Link href="/recetas" className="text-xs font-medium text-ambar-600 hover:underline">← Volver a recetas</Link>
        </div>
      </header>

      {msg && (
        <p className={`mb-4 rounded-lg px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {msg.texto}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-salvia-500">Cargando…</p>
      ) : (
        <div className="space-y-8">
          {/* ══════════ 🍽 FAMILIAS DE RECETAS ══════════ */}
          <section>
            <div className="mb-3 flex items-center gap-2 border-l-4 border-ambar-400 pl-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-salvia-600">🍽 Familias de recetas</h2>
              <span className="rounded-full bg-salvia-50 px-2 py-0.5 text-[11px] text-salvia-500">{famRecetas.length}</span>
            </div>

            {esAdmin && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-salvia-200 bg-white p-3">
                <input
                  value={nuevaFamilia}
                  onChange={(e) => setNuevaFamilia(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && crearFamiliaReceta()}
                  placeholder="Nueva familia (ej: POSTRES DE TEMPORADA)"
                  className="min-w-[220px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-sm uppercase focus:border-ambar-400 focus:outline-none"
                />
                <input
                  value={nuevaFamiliaCC}
                  onChange={(e) => setNuevaFamiliaCC(e.target.value)}
                  placeholder="Centro de costo (opcional)"
                  className="w-48 rounded-md border border-salvia-200 px-3 py-2 text-xs uppercase focus:border-ambar-400 focus:outline-none"
                />
                <button onClick={crearFamiliaReceta} disabled={ocupado || !nuevaFamilia.trim()} className="rounded-lg bg-ambar px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  + Crear
                </button>
              </div>
            )}

            <ul className="space-y-2">
              {famRecetas.map((f) => {
                const subs = subsDe(f.id);
                const nRec = recetasDeFamilia(f.id);
                return (
                  <li key={f.id} className="rounded-xl border border-salvia-100 bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {edit && edit.clase === 'fam' && edit.id === f.id ? <FilaEdicion /> : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-ink">{f.nombre}</span>
                            <ChipCC cc={f.centrocosto} />
                            <span className="text-[11px] text-salvia-400">{nRec} receta{nRec === 1 ? '' : 's'}</span>
                          </div>
                          {esAdmin && (
                            <div className="flex items-center gap-2">
                              {botonEditar('fam', f)}
                              <button onClick={() => desactivar('fam', f.id, f.nombre, nRec)} disabled={ocupado} className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">Desactivar</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* la unión familia → subfamilias, visible y editable adentro */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-salvia-50 pt-2">
                      {subs.map((s) => (
                        edit && edit.clase === 'sub' && edit.id === s.id ? <FilaEdicion key={s.id} /> : (
                          <span key={s.id} className="group inline-flex items-center gap-1 rounded-full bg-salvia-50 px-2.5 py-1 text-xs text-salvia-700">
                            {s.nombre}
                            <ChipCC cc={s.centrocosto} heredado={f.centrocosto} />
                            <span className="text-[10px] text-salvia-400">({usoRecetas.get(s.id) || 0})</span>
                            {esAdmin && (
                              <>
                                <button onClick={() => setEdit({ clase: 'sub', id: s.id, nombre: s.nombre, cc: String(s.centrocosto || '') })} title="Editar" className="opacity-40 transition hover:opacity-100">✏️</button>
                                <button onClick={() => desactivar('sub', s.id, s.nombre, usoRecetas.get(s.id) || 0)} title="Desactivar" className="opacity-40 transition hover:opacity-100">✕</button>
                              </>
                            )}
                          </span>
                        )
                      ))}
                      {esAdmin && (
                        subNueva && subNueva.familia_id === f.id ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              value={subNueva.nombre}
                              onChange={(e) => setSubNueva({ familia_id: f.id, nombre: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && crearSubfamiliaDe(f.id)}
                              placeholder="Nombre…"
                              autoFocus
                              className="w-36 rounded-full border border-ambar-300 px-2.5 py-1 text-xs uppercase focus:outline-none"
                            />
                            <button onClick={() => crearSubfamiliaDe(f.id)} disabled={ocupado} className="text-xs font-semibold text-ambar-600">OK</button>
                            <button onClick={() => setSubNueva(null)} className="text-xs text-salvia-400">✕</button>
                          </span>
                        ) : (
                          <button onClick={() => setSubNueva({ familia_id: f.id, nombre: '' })} className="rounded-full border border-dashed border-salvia-300 px-2.5 py-1 text-xs text-salvia-500 hover:border-ambar-400 hover:text-ambar-600">
                            + subfamilia
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ══════════ 📦 CLASIFICACIONES DE INSUMOS ══════════ */}
          <section>
            <div className="mb-3 flex items-center gap-2 border-l-4 border-blue-400 pl-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-salvia-600">📦 Clasificaciones de insumos</h2>
              <span className="rounded-full bg-salvia-50 px-2 py-0.5 text-[11px] text-salvia-500">{clasifInsumos.length}</span>
              <Ayuda titulo="Clasificaciones de insumos">
                <p>Son las subfamilias del maestro de INSUMOS: agrupan tus compras (FRUVER, ABARROTES, LICORES…) y también las preparaciones &quot;SUB.&quot;.</p>
                <p>El número entre paréntesis es cuántos insumos viven en cada una. El 🏷 es su centro de costo (si está vacío, hereda el de la familia INSUMOS).</p>
              </Ayuda>
            </div>

            {esAdmin && famInsumoPrincipal && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-blue-200 bg-white p-3">
                <input
                  value={nuevaClasif}
                  onChange={(e) => setNuevaClasif(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && crearClasifInsumo()}
                  placeholder="Nueva clasificación (ej: EMPAQUES)"
                  className="min-w-[220px] flex-1 rounded-md border border-salvia-200 px-3 py-2 text-sm uppercase focus:border-blue-400 focus:outline-none"
                />
                <input
                  value={nuevaClasifCC}
                  onChange={(e) => setNuevaClasifCC(e.target.value)}
                  placeholder="Centro de costo (opcional)"
                  className="w-48 rounded-md border border-salvia-200 px-3 py-2 text-xs uppercase focus:border-blue-400 focus:outline-none"
                />
                <button onClick={crearClasifInsumo} disabled={ocupado || !nuevaClasif.trim()} className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  + Crear
                </button>
              </div>
            )}

            <ul className="grid gap-2 sm:grid-cols-2">
              {clasifInsumos.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-salvia-100 bg-white px-3 py-2.5">
                  {edit && edit.clase === 'sub' && edit.id === s.id ? <FilaEdicion /> : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-ink">{s.nombre}</span>
                        <ChipCC cc={s.centrocosto} heredado={famInsumoPrincipal?.centrocosto} />
                        <span className="text-[11px] text-salvia-400">{usoInsumos.get(s.id) || 0} insumos</span>
                      </div>
                      {esAdmin && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          {botonEditar('sub', s)}
                          <button onClick={() => desactivar('sub', s.id, s.nombre, usoInsumos.get(s.id) || 0)} disabled={ocupado} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">✕</button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
