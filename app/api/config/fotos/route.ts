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

/** GET /api/config/fotos -> { nombre, folder_id, url } de la carpeta de Drive. */
export async function GET() {
  try {
    const j = await backend({ mode: 'read', resource: 'configfotos', params: {} });
    if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message }, { status: 502 });
    return NextResponse.json({ ok: true, carpeta: j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/** POST /api/config/fotos  body: { nombre } — renombra la carpeta (solo Admin, ver middleware). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const nombre = String(body?.nombre || '').trim();
    if (!nombre) return NextResponse.json({ ok: false, error: 'Escribe un nombre para la carpeta' }, { status: 400 });

    const j = await backend({ resource: 'configfotos', action: 'renombrar', data: { nombre } });
    if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message || 'No se pudo renombrar' }, { status: 502 });
    return NextResponse.json({ ok: true, carpeta: j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
