'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { Insumo, HistorialInsumo, Dependencia } from '@/lib/api/gastrocore';

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

const fecha = (v: string) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
};

type Cat = { id: string; nombre: string; familia_id?: string };

export function InsumosTabla({ insumos, familias = [], subfamilias: subfamiliasCat = [], esAdmin = false }:
  { insumos: Insumo[]; familias?: Cat[]; subfamilias?: Cat[]; esAdmin?: boolean }) {
  const [lista, setLista] = useState<Insumo[]>(insumos);
  const [q, setQ] = useState('');
  const [sub, setSub] = useState('');
  const [familiaF, setFamiliaF] = useState('');
  const [subfamiliaF, setSubfamiliaF] = useState('');
  const [cargaAbierta, setCargaAbierta] = useState(false);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [viendo, setViendo] = useState<Insumo | null>(null);

  const subfamilias = useMemo(() => {
    const set = new Set<string>();
    lista.forEach((i) => i.subfamilia && set.add(i.subfamilia));
    return Array.from(set).sort();
  }, [lista]);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    const subsDeFamilia = familiaF ? new Set(subfamiliasCat.filter((s) => s.familia_id === familiaF).map((s) => s.id)) : null;
    const filtroClas = (i: Insumo) =>
      (!subfamiliaF || String((i as any).subfamilia_id) === subfamiliaF) &&
      (!subsDeFamilia || subsDeFamilia.has(String((i as any).subfamilia_id)));
    return lista.filter((i) => {
      const matchQ =
        !term ||
        i.articulo?.toLowerCase().includes(term) ||
        i.referencia?.toLowerCase().includes(term);
      const matchSub = !sub || i.subfamilia === sub;
      return matchQ && matchSub && filtroClas(i);
    });
  }, [lista, q, sub, familiaF, subfamiliaF, subfamiliasCat]);

  const onGuardado = useCallback((id: string, coste: number, unidad: string) => {
    setLista((prev) => prev.map((i) => (i.id === id ? { ...i, coste, unidad } : i)));
  }, []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por articulo o referencia..."
          className="flex-1 min-w-[220px] rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        />
        <select value={familiaF} onChange={(e) => { setFamiliaF(e.target.value); setSubfamiliaF(''); }}
          className="rounded-lg border border-line px-3 py-2 text-sm">
          <option value="">Todas las familias</option>
          {familias.map((fa) => <option key={fa.id} value={fa.id}>{fa.nombre}</option>)}
        </select>
        <select value={subfamiliaF} onChange={(e) => setSubfamiliaF(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-sm">
          <option value="">Todas las subfamilias</option>
          {subfamiliasCat.filter((s) => !familiaF || s.familia_id === familiaF).map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
        {esAdmin && (
          <button onClick={() => setCargaAbierta(true)}
            className="rounded-lg bg-ambar-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ambar-700">
            ⇪ Carga por plana
          </button>
        )}
        <select
          value={sub}
          onChange={(e) => setSub(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink transition focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        >
          <option value="">Todas las subfamilias</option>
          {subfamilias.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <p className="mb-2 text-xs text-salvia-600">{filtrados.length} resultados</p>

      <div className="card overflow-hidden">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Referencia</th>
              <th>Articulo</th>
              <th>Unidad</th>
              <th>Subfamilia</th>
              <th className="!text-right">Coste</th>
              <th className="!text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-xs text-muted">{i.referencia}</td>
                <td className="font-medium">{i.articulo}</td>
                <td className="text-muted">{i.unidad}</td>
                <td>
                  <span className="chip bg-slate-100 text-slate-600">{i.subfamilia}</span>
                </td>
                <td className="text-right fin-value text-[#1E3A5F]">{money(i.coste)}</td>
                <td className="text-right whitespace-nowrap">
                  <button
                    onClick={() => esAdmin && setEditando(i)}
                    hidden={!esAdmin}
                    className="rounded-md border border-line px-2 py-1 text-xs font-medium text-ambar-700 hover:bg-ambar-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setViendo(i)}
                    className="ml-2 rounded-md border border-line px-2 py-1 text-xs font-medium text-salvia-700 hover:bg-salvia-50"
                  >
                    Donde se usa
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-muted">
                  No hay insumos que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {cargaAbierta && esAdmin && (
        <CargaPlana
          insumos={lista}
          onCerrar={() => setCargaAbierta(false)}
          onListo={(actualizados) => {
            if (actualizados.length) {
              setLista((prev) => prev.map((i) => {
                const a = actualizados.find((x) => x.referencia === String(i.referencia || '').trim().toUpperCase());
                return a ? { ...i, coste: a.ahora } : i;
              }));
            }
          }}
        />
      )}

      {editando && (
        <EditarInsumoModal
          insumo={editando}
          onClose={() => setEditando(null)}
          onGuardado={onGuardado}
        />
      )}
      {viendo && (
        <DependenciasModal insumo={viendo} onClose={() => setViendo(null)} />
      )}
    </div>
  );
}

function EditarInsumoModal({
  insumo,
  onClose,
  onGuardado,
}: {
  insumo: Insumo;
  onClose: () => void;
  onGuardado: (id: string, coste: number, unidad: string) => void;
}) {
  const [coste, setCoste] = useState(String(insumo.coste ?? 0));
  const [unidad, setUnidad] = useState(insumo.unidad || '');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialInsumo[] | null>(null);
  const [cargandoHist, setCargandoHist] = useState(false);

  const costeNum = Number(coste);
  const costeCambio = !Number.isNaN(costeNum) && costeNum !== insumo.coste;
  const unidadCambio = unidad.trim() !== (insumo.unidad || '');
  const diferencia = costeNum - insumo.coste;

  const cargarHistorial = async () => {
    setCargandoHist(true);
    try {
      const r = await fetch('/api/insumos/historial?id=' + encodeURIComponent(insumo.id));
      const j = await r.json();
      setHistorial(j.ok ? j.data : []);
    } catch {
      setHistorial([]);
    } finally {
      setCargandoHist(false);
    }
  };

  const guardar = async () => {
    setError(null);
    setOkMsg(null);
    if (Number.isNaN(costeNum) || costeNum < 0) {
      setError('Ingresa un coste valido.');
      return;
    }
    if (!costeCambio && !unidadCambio) {
      setError('No hay cambios que guardar.');
      return;
    }
    if (costeCambio && !motivo.trim()) {
      setError('Indica el motivo del cambio de precio (queda registrado en la trazabilidad).');
      return;
    }
    setGuardando(true);
    try {
      const r = await fetch('/api/insumos/actualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: insumo.id, coste: costeNum, unidad, motivo }),
      });
      const j = await r.json();
      if (!j.ok) {
        setError(j.error || 'No se pudo guardar.');
        return;
      }
      const recalc = j.data?.recetas_recalculadas;
      onGuardado(insumo.id, costeNum, unidad.trim());
      setOkMsg(
        'Cambios guardados.' +
          (typeof recalc === 'number' ? ' Recetas/subrecetas recalculadas: ' + recalc + '.' : '')
      );
      if (historial) await cargarHistorial();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-10 w-full max-w-lg rounded-xl border border-line bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ambar-700">Editar insumo</h2>
            <p className="text-sm text-salvia-700">{insumo.articulo}</p>
            <p className="font-mono text-xs text-muted">{insumo.referencia}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-muted hover:text-ink">&times;</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-salvia-700">Precio (coste)</span>
            <input
              type="number"
              min="0"
              step="any"
              value={coste}
              onChange={(e) => setCoste(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-salvia-700">Unidad</span>
            <input
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
            />
          </label>
        </div>

        {costeCambio && (
          <p className="mt-2 text-xs text-salvia-700">
            Cambio de precio: {money(insumo.coste)} &rarr; {money(costeNum)}{' '}
            <span className={diferencia >= 0 ? 'text-red-600' : 'text-green-700'}>
              ({diferencia >= 0 ? '+' : ''}{money(diferencia)})
            </span>
          </p>
        )}

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-salvia-700">
            Motivo del cambio {costeCambio ? '(obligatorio)' : '(opcional)'}
          </span>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Aumento de proveedor, ajuste de temporada..."
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#DBEAFE]"
          />
        </label>

        {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {okMsg && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{okMsg}</p>}

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={() => (historial ? setHistorial(null) : cargarHistorial())}
            className="text-sm font-medium text-salvia-700 underline-offset-2 hover:underline"
          >
            {historial ? 'Ocultar historial' : 'Ver historial de precios'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50">
              Cerrar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="rounded-lg bg-ambar-600 px-4 py-2 text-sm font-semibold text-white hover:bg-ambar-700 disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        {historial !== null && (
          <div className="mt-4 border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-semibold text-salvia-700">Trazabilidad de precios</h3>
            {cargandoHist ? (
              <p className="text-sm text-muted">Cargando...</p>
            ) : historial.length === 0 ? (
              <p className="text-sm text-muted">Sin cambios de precio registrados.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                <table className="erp-table text-xs">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th className="!text-right">Anterior</th>
                      <th className="!text-right">Nuevo</th>
                      <th className="!text-right">Dif.</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((h) => (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap">{fecha(h.fecha)}</td>
                        <td className="text-right">{money(h.coste_anterior)}</td>
                        <td className="text-right">{money(h.coste)}</td>
                        <td className={'text-right ' + (h.diferencia >= 0 ? 'text-red-600' : 'text-green-700')}>
                          {h.diferencia >= 0 ? '+' : ''}{money(h.diferencia)}
                        </td>
                        <td className="text-muted">{h.motivo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DependenciasModal({ insumo, onClose }: { insumo: Insumo; onClose: () => void }) {
  const [deps, setDeps] = useState<Dependencia[] | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/dependencias?item_id=' + encodeURIComponent(insumo.id));
        const j = await r.json();
        if (vivo) setDeps(j.ok ? j.data : []);
      } catch {
        if (vivo) setDeps([]);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [insumo.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="mt-16 w-full max-w-md rounded-xl border border-line bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-ambar-700">Donde se usa</h2>
            <p className="text-sm text-salvia-700">{insumo.articulo}</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none text-muted hover:text-ink">&times;</button>
        </div>

        {cargando ? (
          <p className="text-sm text-muted">Cargando dependencias...</p>
        ) : !deps || deps.length === 0 ? (
          <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-muted">
            Este insumo no se usa en ninguna receta ni subreceta todavia.
          </p>
        ) : (
          <>
            <p className="mb-2 text-xs text-salvia-600">
              Usado en {deps.length} {deps.length === 1 ? 'preparacion' : 'preparaciones'}:
            </p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {deps.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-medium text-ink">
                    {d.es_subreceta ? '🥣 ' : '🍽️ '}{d.nombre}
                  </span>
                  <span className="chip bg-slate-100 text-slate-600">
                    {d.es_subreceta ? 'Subreceta' : 'Receta'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-5 text-right">
          <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-slate-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
//  CARGA POR PLANA (v7.9): pega dos columnas — REFERENCIA y COSTE —
//  desde Excel. Cruza por referencia; historial + cascada incluidos.
// ══════════════════════════════════════════════════════════════════
type FilaPlana = { referencia: string; coste: number; articulo?: string; actual?: number; esSub?: boolean; incluir: boolean; estado: 'ok' | 'no_encontrado' | 'invalida' };

function CargaPlana({ insumos, onCerrar, onListo }:
  { insumos: Insumo[]; onCerrar: () => void; onListo: (a: { referencia: string; ahora: number }[]) => void }) {
  const [texto, setTexto] = useState('');
  const [filas, setFilas] = useState<FilaPlana[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const porRef = useMemo(() => {
    const m: Record<string, Insumo> = {};
    insumos.forEach((i) => { const r = String(i.referencia || '').trim().toUpperCase(); if (r) m[r] = i; });
    return m;
  }, [insumos]);

  function analizar() {
    const out: FilaPlana[] = [];
    texto.split(/\r?\n/).forEach((linea) => {
      const l = linea.trim();
      if (!l) return;
      const partes = l.split(/[\t;|]+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      const referencia = String(partes[0] || '').toUpperCase();
      const bruto = String(partes[1] || '').replace(/[^0-9.,-]/g, '');
      const coste = Number(bruto.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      if (!referencia || partes.length < 2 || isNaN(coste) || coste < 0) {
        out.push({ referencia: referencia || l.slice(0, 18), coste: NaN, incluir: false, estado: 'invalida' });
        return;
      }
      const ins = porRef[referencia];
      if (!ins) { out.push({ referencia, coste, incluir: false, estado: 'no_encontrado' }); return; }
      const actual = Number(ins.coste) || 0;
      const esSub = /^SUB[\s.]/i.test(String(ins.articulo || ''));
      out.push({
        referencia, coste, articulo: ins.articulo, actual, esSub,
        // Preparaciones SUB. con costo ya digitado: piden confirmación manual.
        incluir: !(esSub && actual > 0),
        estado: 'ok',
      });
    });
    setFilas(out);
  }

  async function enviar() {
    const aEnviar = (filas || []).filter((fl) => fl.estado === 'ok' && fl.incluir && Math.abs((fl.actual || 0) - fl.coste) > 0.0001);
    if (!aEnviar.length) { setResultado('No hay cambios seleccionados para aplicar.'); return; }
    setEnviando(true);
    setResultado(null);
    try {
      const r = await fetch('/api/insumos/carga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: aEnviar.map((fl) => ({ referencia: fl.referencia, coste: fl.coste })) }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Error del servidor');
      const d = j.data || {};
      setResultado(`✔ ${d.actualizados?.length || 0} actualizados · ${d.sin_cambio?.length || 0} sin cambio · ${d.no_encontrados?.length || 0} no encontrados${d.errores?.length ? ' · ' + d.errores.length + ' con error' : ''}. Las recetas afectadas se recalcularon en cascada.`);
      onListo((d.actualizados || []).map((a: { referencia: string; ahora: number }) => ({ referencia: a.referencia, ahora: a.ahora })));
    } catch (e) {
      setResultado('✘ ' + (e instanceof Error ? e.message : 'Error inesperado'));
    } finally {
      setEnviando(false);
    }
  }

  const pendientes = (filas || []).filter((fl) => fl.esSub && !fl.incluir && fl.estado === 'ok').length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-ink">Carga de costos por plana</h3>
        <p className="mt-1 text-xs text-salvia-600">
          Pega dos columnas desde Excel: <b>REFERENCIA</b> y <b>COSTE</b> (tab, «;» o espacios).
          El cruce es por referencia; cada cambio queda en el historial y recalcula las recetas en cascada.
        </p>
        {!filas ? (
          <>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10}
              placeholder={'REF001\t4500\nREF002\t12300'}
              className="mt-3 w-full rounded-lg border border-line p-3 font-mono text-xs focus:border-[#2563EB] focus:outline-none" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={onCerrar} className="rounded-lg border border-line px-4 py-2 text-sm">Cancelar</button>
              <button onClick={analizar} disabled={!texto.trim()}
                className="rounded-lg bg-ambar-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Analizar</button>
            </div>
          </>
        ) : (
          <>
            {pendientes > 0 && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠ {pendientes} preparación(es) «SUB.» ya tienen costo digitado. Marca su casilla solo si de verdad
                quieres <b>actualizar el costo del insumo</b>.
              </div>
            )}
            <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 text-left text-salvia-600">
                  <tr><th className="px-2 py-1.5">✓</th><th className="px-2 py-1.5">Referencia</th><th className="px-2 py-1.5">Artículo</th><th className="px-2 py-1.5 text-right">Actual</th><th className="px-2 py-1.5 text-right">Nuevo</th></tr>
                </thead>
                <tbody>
                  {filas.map((fl, i) => (
                    <tr key={i} className={fl.estado !== 'ok' ? 'bg-red-50 text-red-700' : fl.esSub ? 'bg-amber-50' : ''}>
                      <td className="px-2 py-1.5">
                        {fl.estado === 'ok' ? (
                          <input type="checkbox" checked={fl.incluir}
                            onChange={(e) => setFilas((prev) => prev!.map((x, j) => (j === i ? { ...x, incluir: e.target.checked } : x)))} />
                        ) : '—'}
                      </td>
                      <td className="px-2 py-1.5 font-mono">{fl.referencia}</td>
                      <td className="px-2 py-1.5">{fl.estado === 'no_encontrado' ? 'NO ENCONTRADO EN INSUMOS' : fl.estado === 'invalida' ? 'FILA INVÁLIDA' : fl.articulo}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fl.actual !== undefined ? '$' + Number(fl.actual).toLocaleString('es-CO') : ''}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold">{isNaN(fl.coste) ? '' : '$' + fl.coste.toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {resultado && <p className="mt-3 text-sm">{resultado}</p>}
            <div className="mt-3 flex justify-between">
              <button onClick={() => { setFilas(null); setResultado(null); }} className="rounded-lg border border-line px-4 py-2 text-sm">← Corregir texto</button>
              <div className="flex gap-2">
                <button onClick={onCerrar} className="rounded-lg border border-line px-4 py-2 text-sm">Cerrar</button>
                <button onClick={enviar} disabled={enviando}
                  className="rounded-lg bg-ambar-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
                  {enviando ? 'Aplicando…' : 'Aplicar cambios'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
