'use client';
import { fetchEnCola } from '@/lib/colaGuardado';

/**
 * Configuración (ADMIN) — /configuracion
 * Muestra la carpeta de Google Drive donde se guardan las fotos del recetario
 * y permite renombrarla. El rename se hace en Drive real; las fotos ya subidas
 * NO se rompen porque sus URLs dependen del ID de cada archivo.
 */
import { useEffect, useState } from 'react';

type Carpeta = { folder_id: string; nombre: string; url: string };

export default function ConfiguracionPage() {
  const [carpeta, setCarpeta] = useState<Carpeta | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/config/fotos');
        const j = await r.json();
        if (j.ok) {
          setCarpeta(j.carpeta);
          setNuevoNombre(j.carpeta?.nombre || '');
        } else {
          setMensaje({ tipo: 'error', texto: j.error || 'No se pudo cargar la configuración' });
        }
      } catch {
        setMensaje({ tipo: 'error', texto: 'Error de red al cargar la configuración' });
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  async function renombrar() {
    const nombre = nuevoNombre.trim();
    if (!nombre || nombre === carpeta?.nombre) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const r = await fetchEnCola('/api/config/fotos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      const j = await r.json();
      if (j.ok) {
        setCarpeta(j.carpeta);
        setMensaje({ tipo: 'ok', texto: 'Carpeta renombrada en Drive.' });
      } else {
        setMensaje({ tipo: 'error', texto: j.error || 'No se pudo renombrar' });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red al renombrar' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-xl font-bold text-[#1E3A5F]">Configuración</h1>
      <p className="mt-1 text-sm text-slate-500">Ajustes generales del sistema.</p>

      {mensaje && (
        <p
          className={
            'mt-4 rounded-lg px-3 py-2 text-sm ' +
            (mensaje.tipo === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')
          }
        >
          {mensaje.texto}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">📁 Carpeta de fotos del recetario</h2>
        <p className="mt-1 text-xs text-slate-500">
          Todas las fotos que subas desde las fichas técnicas se guardan en esta carpeta de Google
          Drive. Puedes cambiarle el nombre sin afectar las fotos ya subidas.
        </p>

        {cargando ? (
          <p className="mt-4 text-sm text-slate-400">Cargando…</p>
        ) : carpeta ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                maxLength={100}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
              />
              <button
                onClick={renombrar}
                disabled={guardando || !nuevoNombre.trim() || nuevoNombre.trim() === carpeta.nombre}
                className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16304e] disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : 'Renombrar'}
              </button>
            </div>
            <a
              href={carpeta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-medium text-[#1E3A5F] underline underline-offset-2"
            >
              Abrir carpeta en Google Drive ↗
            </a>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Sin información de la carpeta.</p>
        )}
      </section>
    </main>
  );
}
