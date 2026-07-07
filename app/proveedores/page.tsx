'use client';

/**
 * Proveedores (ADMIN) — /proveedores
 * CRUD simple contra la hoja 'Proveedores'. Mutaciones solo Admin
 * (middleware); cualquier sesión puede consultar la lista.
 */
import { useEffect, useState } from 'react';

type Proveedor = { id: string; nombre: string; contacto: string; telefono: string; activo: boolean | string };

const VACIO = { nombre: '', contacto: '', telefono: '' };

function esActivo(v: Proveedor['activo']): boolean {
  return v === true || v === 'TRUE' || v === 'VERDADERO' || v === '';
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [nuevo, setNuevo] = useState({ ...VACIO });
  const [editando, setEditando] = useState<string | null>(null);
  const [formEdit, setFormEdit] = useState({ ...VACIO });
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const r = await fetch('/api/proveedores');
      const j = await r.json();
      if (j.ok) setProveedores(j.proveedores || []);
      else setMensaje({ tipo: 'error', texto: j.error || 'No se pudo cargar' });
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red' });
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function accion(payload: object, exito: string) {
    setOcupado(true);
    setMensaje(null);
    try {
      const r = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (j.ok) { setMensaje({ tipo: 'ok', texto: exito }); await cargar(); return true; }
      setMensaje({ tipo: 'error', texto: j.error || 'No se pudo completar' });
      return false;
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de red' });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function crear() {
    if (await accion({ accion: 'crear', data: nuevo }, 'Proveedor creado.')) setNuevo({ ...VACIO });
  }
  async function guardarEdicion(id: string) {
    if (await accion({ accion: 'editar', data: { id, ...formEdit } }, 'Proveedor actualizado.')) setEditando(null);
  }
  async function cambiarEstado(p: Proveedor) {
    const activar = !esActivo(p.activo);
    await accion({ accion: 'estado', data: { id: p.id, activo: activar } }, activar ? 'Proveedor reactivado.' : 'Proveedor desactivado.');
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-display text-xl font-bold text-[#1E3A5F]">Proveedores</h1>
      <p className="mt-1 text-sm text-slate-500">Directorio de proveedores del restaurante.</p>

      {mensaje && (
        <p className={'mt-4 rounded-lg px-3 py-2 text-sm ' + (mensaje.tipo === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700')}>
          {mensaje.texto}
        </p>
      )}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">➕ Nuevo proveedor</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input type="text" placeholder="Nombre *" value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]" />
          <input type="text" placeholder="Contacto" value={nuevo.contacto}
            onChange={(e) => setNuevo({ ...nuevo, contacto: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]" />
          <input type="text" placeholder="Teléfono" value={nuevo.telefono}
            onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]" />
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={crear} disabled={ocupado || !nuevo.nombre.trim()}
            className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16304e] disabled:opacity-50">
            Crear proveedor
          </button>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {cargando ? (
          <p className="p-6 text-sm text-slate-400">Cargando proveedores…</p>
        ) : proveedores.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">Aún no hay proveedores registrados. Crea el primero arriba.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Nombre</th>
                <th className="px-4 py-2.5 font-semibold">Contacto</th>
                <th className="px-4 py-2.5 font-semibold">Teléfono</th>
                <th className="px-4 py-2.5 font-semibold">Estado</th>
                <th className="px-4 py-2.5 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  {editando === p.id ? (
                    <>
                      <td className="px-4 py-2.5"><input value={formEdit.nombre} onChange={(e) => setFormEdit({ ...formEdit, nombre: e.target.value })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-4 py-2.5"><input value={formEdit.contacto} onChange={(e) => setFormEdit({ ...formEdit, contacto: e.target.value })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-4 py-2.5"><input value={formEdit.telefono} onChange={(e) => setFormEdit({ ...formEdit, telefono: e.target.value })} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => guardarEdicion(p.id)} disabled={ocupado} className="mr-2 rounded bg-[#1E3A5F] px-3 py-1 text-xs font-semibold text-white disabled:opacity-60">Guardar</button>
                        <button onClick={() => setEditando(null)} className="rounded border border-slate-300 px-3 py-1 text-xs">Cancelar</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 font-medium">{p.nombre}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.contacto || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.telefono || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={'text-xs font-semibold ' + (esActivo(p.activo) ? 'text-green-700' : 'text-red-600')}>
                          {esActivo(p.activo) ? '● Activo' : '○ Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => { setEditando(p.id); setFormEdit({ nombre: p.nombre || '', contacto: p.contacto || '', telefono: p.telefono || '' }); }}
                          className="mr-2 rounded border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50">Editar</button>
                        <button onClick={() => cambiarEstado(p)} disabled={ocupado}
                          className={'rounded px-3 py-1 text-xs font-semibold disabled:opacity-60 ' +
                            (esActivo(p.activo) ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'border border-green-200 text-green-700 hover:bg-green-50')}>
                          {esActivo(p.activo) ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
