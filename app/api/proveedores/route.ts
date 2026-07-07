import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = process.env.GASTROCORE_API_URL || '';
const API_TOKEN = process.env.GASTROCORE_API_TOKEN || '';

async function backend(payload: Record<string, unknown>) {
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, token: API_TOKEN }),
    cache: 'no-store',
  });
  return r.json();
}

/** GET /api/proveedores — lista (cualquier sesión). */
export async function GET() {
  const j = await backend({ mode: 'read', resource: 'proveedores', params: { all: 'true' } });
  if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message }, { status: 502 });
  return NextResponse.json({ ok: true, proveedores: j.data });
}

/**
 * POST /api/proveedores — mutaciones (middleware exige Admin):
 *  { accion:'crear',  data:{ nombre, contacto?, telefono? } }
 *  { accion:'editar', data:{ id, nombre?, contacto?, telefono? } }
 *  { accion:'estado', data:{ id, activo } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { accion, data } = body || {};

    if (accion === 'crear') {
      const nombre = String(data?.nombre || '').trim();
      if (!nombre) return NextResponse.json({ ok: false, error: 'Falta el nombre' }, { status: 400 });
      const j = await backend({
        resource: 'proveedores', action: 'create',
        data: { nombre, contacto: String(data?.contacto || '').trim(), telefono: String(data?.telefono || '').trim(), activo: true },
      });
      if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message }, { status: 502 });
      return NextResponse.json({ ok: true, proveedor: j.data });
    }

    if (accion === 'editar' || accion === 'estado') {
      if (!data?.id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });
      const payload: Record<string, unknown> = {};
      if (accion === 'editar') {
        if (data.nombre !== undefined) payload.nombre = String(data.nombre).trim();
        if (data.contacto !== undefined) payload.contacto = String(data.contacto).trim();
        if (data.telefono !== undefined) payload.telefono = String(data.telefono).trim();
      } else {
        payload.activo = !!data.activo;
      }
      const j = await backend({ resource: 'proveedores', action: 'update', id: data.id, data: payload });
      if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message }, { status: 502 });
      return NextResponse.json({ ok: true, proveedor: j.data });
    }

    return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
