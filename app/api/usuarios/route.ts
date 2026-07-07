import { NextRequest, NextResponse } from 'next/server';
import { esAdmin } from '@/lib/session';

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

/** GET /api/usuarios — lista completa (la clave NUNCA viene: el backend la sanitiza). Solo Admin. */
export async function GET() {
  if (!(await esAdmin())) {
    return NextResponse.json({ ok: false, error: 'Solo Admin puede ver los usuarios' }, { status: 403 });
  }
  const j = await backend({ mode: 'read', resource: 'usuarios', params: { all: 'true' } });
  if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message }, { status: 502 });
  return NextResponse.json({ ok: true, usuarios: j.data });
}

/**
 * POST /api/usuarios — mutaciones (el middleware ya exige rol Admin):
 *  { accion:'crear',  data:{ email, nombre, rol, clave } }
 *  { accion:'editar', data:{ id, nombre?, rol?, clave? } }   (clave vacía = no cambiarla)
 *  { accion:'estado', data:{ id, activo } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { accion, data } = body || {};

    if (accion === 'crear') {
      const email = String(data?.email || '').trim().toLowerCase();
      const clave = String(data?.clave || '').trim();
      if (!email || !email.includes('@')) return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 });
      if (clave.length < 4) return NextResponse.json({ ok: false, error: 'La clave debe tener al menos 4 caracteres' }, { status: 400 });
      const j = await backend({
        resource: 'usuarios', action: 'create',
        data: { email, nombre: String(data?.nombre || '').trim(), rol: data?.rol || 'Usuario', clave, activo: true },
      });
      if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message }, { status: 502 });
      return NextResponse.json({ ok: true, usuario: j.data });
    }

    if (accion === 'editar') {
      if (!data?.id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });
      const payload: Record<string, unknown> = {};
      if (data.nombre !== undefined) payload.nombre = String(data.nombre).trim();
      if (data.rol) payload.rol = data.rol;
      if (String(data.clave || '').trim()) payload.clave = String(data.clave).trim();
      const j = await backend({ resource: 'usuarios', action: 'update', id: data.id, data: payload });
      if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message }, { status: 502 });
      return NextResponse.json({ ok: true, usuario: j.data });
    }

    if (accion === 'estado') {
      if (!data?.id) return NextResponse.json({ ok: false, error: 'Falta id' }, { status: 400 });
      const j = await backend({ resource: 'usuarios', action: 'update', id: data.id, data: { activo: !!data.activo } });
      if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message }, { status: 502 });
      return NextResponse.json({ ok: true, usuario: j.data });
    }

    return NextResponse.json({ ok: false, error: 'Acción desconocida' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
