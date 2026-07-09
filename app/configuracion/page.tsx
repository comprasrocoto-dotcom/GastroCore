'use client';
import { fetchEnCola } from '@/lib/colaGuardado';
import { useEffect, useMemo, useState } from 'react';

/**
 * Configuración (solo ADMIN) — /configuracion  · v8.0
 * 1. Parámetros de costeo: Food Cost objetivo (global y por familia) e
 *    impuesto al consumo. Al guardar, el backend RECALCULA todo el menú.
 * 2. Umbral de alertas de Análisis (% de subida que dispara alerta roja).
 * 3. Mermas estándar por insumo (se precargan en los editores de recetas).
 * 4. Respaldo: copia Excel del Sheet completo con un clic.
 * 5. Credenciales: rotación guiada del API token y del AUTH_SECRET.
 * 6. Carpeta de fotos del recetario (Drive).
 */

type Carpeta = { folder_id: string; nombre: string; url: string };
type Familia = { id: string; nombre: string; tipo: string };
type Parametros = {
  fc_objetivo: number;
  fc_por_familia: Record<string, number>;
  impuesto_pct: number;
  alerta_subida_pct: number;
  familias?: Familia[];
};
type InsumoLite = { id: string; articulo: string; unidad: string; merma_std?: number };
type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null;

export default function ConfiguracionPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ambar-700">Configuración</h1>
        <p className="text-sm text-salvia-700">Parámetros de negocio del sistema. Solo visible para Admin.</p>
      </header>
      <div className="space-y-6">
        <SeccionParametros />
        <SeccionMermas />
        <SeccionRespaldo />
        <SeccionCredenciales />
        <SeccionCarpetaFotos />
      </div>
    </main>
  );
}

function SeccionParametros() {
  const [par, setPar] = useState<Parametros | null>(null);
  const [fc, setFc] = useState(35);
  const [imp, setImp] = useState(8);
  const [umbral, setUmbral] = useState(15);
  const [porFam, setPorFam] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  useEffect(() => {
    fetch('/api/config/parametros', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return;
        const p: Parametros = j.parametros;
        setPar(p);
        setFc(p.fc_objetivo);
        setImp(p.impuesto_pct);
        setUmbral(p.alerta_subida_pct);
        setPorFam(p.fc_por_familia || {});
      })
      .catch(() => setMsg({ tipo: 'error', texto: 'No se pudieron cargar los parámetros.' }));
  }, []);

  const familiasVenta = useMemo(
    () => (par?.familias || []).filter((f) => String(f.tipo).toLowerCase() === 'receta'),
    [par]
  );

  async function guardar() {
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetchEnCola('/api/config/parametros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fc_objetivo: fc, impuesto_pct: imp, alerta_subida_pct: umbral, fc_por_familia: porFam }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      setMsg({
        tipo: 'ok',
        texto: j.recalculo
          ? 'Parámetros guardados. ' + j.recalculo + ' — precios sugeridos y food cost actualizados en todo el menú.'
          : 'Parámetros guardados (sin cambios que afecten precios).',
      });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-800">🎯 Parámetros de costeo</h2>
      <p className="mt-1 text-xs text-salvia-600">
        Definen el <b>precio sugerido</b> y el <b>food cost</b> de todas las recetas. Al guardar cambios,
        el sistema recalcula el menú completo (con rastro en el historial de cada receta).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Food cost objetivo (%)</span>
          <input type="number" min={1} max={90} step={0.5} value={fc}
            onChange={(e) => setFc(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Impuesto al consumo (%)</span>
          <input type="number" min={0} max={40} step={0.5} value={imp}
            onChange={(e) => setImp(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-salvia-600">Alerta roja si un insumo sube más de (%)</span>
          <input type="number" min={1} max={100} step={1} value={umbral}
            onChange={(e) => setUmbral(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-salvia-600">
          Excepciones de food cost por familia <span className="normal-case font-normal">(vacío = usa el global)</span>
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {familiasVenta.map((f) => (
            <label key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
              <span className="text-sm">{f.nombre}</span>
              <span className="flex items-center gap-1 text-xs text-salvia-500">
                <input type="number" min={0} max={90} step={0.5}
                  value={porFam[f.id] ?? ''}
                  placeholder={String(fc)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPorFam((prev) => {
                      const n = { ...prev };
                      if (v === '' || Number(v) <= 0) delete n[f.id];
                      else n[f.id] = Number(v);
                      return n;
                    });
                  }}
                  className="w-20 rounded border border-line px-2 py-1 text-right text-sm" />
                %
              </span>
            </label>
          ))}
          {familiasVenta.length === 0 && <p className="text-xs text-salvia-500">Cargando familias…</p>}
        </div>
      </div>

      {msg && (
        <p className={'mt-3 rounded-lg px-3 py-2 text-xs ' + (msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {msg.texto}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <button onClick={guardar} disabled={guardando || !par}
          className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {guardando ? 'Guardando y recalculando…' : 'Guardar parámetros'}
        </button>
      </div>
    </section>
  );
}

function SeccionMermas() {
  const [q, setQ] = useState('');
  const [insumos, setInsumos] = useState<InsumoLite[]>([]);
  const [editados, setEditados] = useState<Record<string, number>>({});
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [msg, setMsg] = useState<Mensaje>(null);

  useEffect(() => {
    fetch('/api/insumos', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setInsumos(((j.insumos || j.data || []) as InsumoLite[])))
      .catch(() => {});
  }, []);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return insumos.filter((i) => String(i.articulo || '').toLowerCase().includes(t)).slice(0, 12);
  }, [q, insumos]);

  async function guardarMerma(ins: InsumoLite) {
    const valor = editados[ins.id];
    if (valor === undefined) return;
    if (valor < 0 || valor >= 95) { setMsg({ tipo: 'error', texto: 'La merma debe estar entre 0 y 94.9%.' }); return; }
    setGuardandoId(ins.id);
    setMsg(null);
    try {
      const r = await fetchEnCola('/api/insumos/actualizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ins.id, merma_std: valor }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo guardar');
      setInsumos((prev) => prev.map((x) => (x.id === ins.id ? { ...x, merma_std: valor } : x)));
      setEditados((prev) => { const n = { ...prev }; delete n[ins.id]; return n; });
      setMsg({ tipo: 'ok', texto: 'Merma estándar de ' + ins.articulo + ': ' + valor + '%. Se precargará al usarlo en recetas.' });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setGuardandoId(null);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-800">🔪 Mermas estándar por insumo</h2>
      <p className="mt-1 text-xs text-salvia-600">
        El % de merma típico de limpieza/porcionado de cada insumo. Al agregarlo en el editor de recetas,
        la merma llega <b>precargada</b> (siempre ajustable en la línea). No recalcula recetas existentes.
      </p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo… (ej: cebolla, pescado, aguacate)"
        className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm" />
      {filtrados.length > 0 && (
        <div className="mt-2 divide-y divide-line rounded-lg border border-line">
          {filtrados.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{i.articulo}</p>
                <p className="text-[11px] text-salvia-500">{i.unidad} · merma estándar actual: <b>{Number(i.merma_std) || 0}%</b></p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={94.9} step={0.5}
                  value={editados[i.id] ?? Number(i.merma_std) ?? 0}
                  onChange={(e) => setEditados((p) => ({ ...p, [i.id]: Number(e.target.value) }))}
                  className="w-20 rounded border border-line px-2 py-1 text-right text-sm" />
                <button onClick={() => guardarMerma(i)}
                  disabled={guardandoId === i.id || editados[i.id] === undefined}
                  className="rounded bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                  {guardandoId === i.id ? '…' : 'Guardar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg && (
        <p className={'mt-3 rounded-lg px-3 py-2 text-xs ' + (msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {msg.texto}
        </p>
      )}
    </section>
  );
}

function SeccionRespaldo() {
  const [descargando, setDescargando] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  async function descargar() {
    setDescargando(true);
    setMsg(null);
    try {
      const r = await fetch('/api/config/respaldo');
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'No se pudo generar el respaldo');
      }
      const blob = await r.blob();
      const nombre = (r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'respaldo.xlsx';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ tipo: 'ok', texto: 'Respaldo descargado: ' + nombre + '. Guárdalo fuera de Google (disco local, otra nube).' });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setDescargando(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-800">💾 Respaldo de la base de datos</h2>
      <p className="mt-1 text-xs text-salvia-600">
        Descarga una copia Excel del Sheet completo (las 13 hojas: insumos, recetas, historial, fichas…).
        Recomendado: <b>una vez al mes</b>, guardada fuera de Google.
      </p>
      {msg && (
        <p className={'mt-3 rounded-lg px-3 py-2 text-xs ' + (msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {msg.texto}
        </p>
      )}
      <div className="mt-3">
        <button onClick={descargar} disabled={descargando}
          className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {descargando ? 'Generando copia…' : '⬇ Descargar copia (Excel)'}
        </button>
      </div>
    </section>
  );
}

function SeccionCredenciales() {
  const [rotando, setRotando] = useState(false);
  const [tokenNuevo, setTokenNuevo] = useState<string | null>(null);
  const [secretNuevo, setSecretNuevo] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  async function rotarToken() {
    setRotando(true);
    setMsg(null);
    try {
      const r = await fetch('/api/config/token', { method: 'POST' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo rotar');
      setTokenNuevo(j.token);
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setRotando(false);
    }
  }

  function generarSecret() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    setSecretNuevo(btoa(String.fromCharCode(...bytes)));
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-800">🔐 Rotación de credenciales</h2>
      <p className="mt-1 text-xs text-salvia-600">
        Cambia periódicamente las llaves del sistema (o de inmediato si alguna quedó expuesta).
      </p>

      <div className="mt-4 rounded-lg border border-line p-3">
        <p className="text-xs font-semibold text-slate-700">A · Token de la API (Apps Script ↔ Vercel)</p>
        {!tokenNuevo ? (
          <>
            <p className="mt-1 text-[11px] text-amber-700">
              ⚠ Al rotar, la app queda <b>sin conexión al backend</b> hasta que actualices la variable en Vercel
              (≈2 minutos). Hazlo en un momento tranquilo.
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs text-salvia-700">
              <input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
              Entiendo el efecto y quiero rotar el token ahora
            </label>
            <button onClick={rotarToken} disabled={!confirmado || rotando}
              className="mt-2 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
              {rotando ? 'Rotando…' : 'Generar token nuevo'}
            </button>
          </>
        ) : (
          <div className="mt-2 space-y-2 text-xs">
            <p className="rounded bg-amber-50 px-2 py-1 text-amber-800">
              Este token se muestra <b>UNA sola vez</b>. Cópialo ya:
            </p>
            <code className="block break-all rounded bg-slate-100 p-2 font-mono text-[11px]">{tokenNuevo}</code>
            <ol className="list-decimal space-y-1 pl-4 text-salvia-700">
              <li>Cópialo completo.</li>
              <li>Vercel → Settings → Environment Variables → <b>GASTROCORE_API_TOKEN</b> → Edit → pegar → Save.</li>
              <li>Deployments → ⋯ del último deploy → <b>Redeploy</b>.</li>
              <li>Verifica que /insumos cargue. El token viejo ya no sirve.</li>
            </ol>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-line p-3">
        <p className="text-xs font-semibold text-slate-700">B · AUTH_SECRET (cookies de sesión)</p>
        <p className="mt-1 text-[11px] text-salvia-600">
          Se cambia solo en Vercel (el backend no participa). Al rotarlo, <b>todas las sesiones se cierran</b> y
          cada quien vuelve a iniciar sesión.
        </p>
        {!secretNuevo ? (
          <button onClick={generarSecret}
            className="mt-2 rounded-lg border border-line px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-neutral-50">
            Generar AUTH_SECRET nuevo
          </button>
        ) : (
          <div className="mt-2 space-y-2 text-xs">
            <code className="block break-all rounded bg-slate-100 p-2 font-mono text-[11px]">{secretNuevo}</code>
            <ol className="list-decimal space-y-1 pl-4 text-salvia-700">
              <li>Vercel → Settings → Environment Variables → <b>AUTH_SECRET</b> → Edit → pegar → Save.</li>
              <li>Redeploy. Todos vuelven a iniciar sesión.</li>
            </ol>
          </div>
        )}
      </div>
      {msg && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{msg.texto}</p>}
    </section>
  );
}

function SeccionCarpetaFotos() {
  const [carpeta, setCarpeta] = useState<Carpeta | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<Mensaje>(null);

  useEffect(() => {
    fetch('/api/config/fotos', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.carpeta) {
          setCarpeta(j.carpeta);
          setNuevoNombre(j.carpeta.nombre);
        }
      })
      .catch(() => {});
  }, []);

  async function renombrar() {
    const nombre = nuevoNombre.trim();
    if (!nombre || !carpeta || nombre === carpeta.nombre) return;
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetchEnCola('/api/config/fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo renombrar');
      setCarpeta(j.carpeta);
      setMsg({ tipo: 'ok', texto: 'Carpeta renombrada en Drive.' });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'Error inesperado' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold text-slate-800">📁 Carpeta de fotos del recetario</h2>
      <p className="mt-1 text-xs text-salvia-600">
        Las fotos de las fichas técnicas se guardan aquí. Renombrarla no afecta las fotos ya subidas.
      </p>
      {carpeta ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-salvia-700">
            Actual: <b>{carpeta.nombre}</b> ·{' '}
            <a href={carpeta.url} target="_blank" rel="noreferrer" className="text-blue-700 underline">abrir en Drive</a>
          </p>
          <div className="flex gap-2">
            <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
              className="flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
            <button onClick={renombrar} disabled={guardando}
              className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {guardando ? '…' : 'Renombrar'}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-salvia-500">Cargando…</p>
      )}
      {msg && (
        <p className={'mt-3 rounded-lg px-3 py-2 text-xs ' + (msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {msg.texto}
        </p>
      )}
    </section>
  );
}
