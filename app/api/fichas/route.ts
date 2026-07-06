import { NextRequest, NextResponse } from 'next/server';
import { getUsuario } from '@/lib/session';

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

/** GET /api/fichas?receta_id=REC-000011 -> { ficha, receta } */
export async function GET(req: NextRequest) {
  try {
    const recetaId = req.nextUrl.searchParams.get('receta_id');
    if (!recetaId) return NextResponse.json({ ok: false, error: 'Falta receta_id' }, { status: 400 });

    const [jFicha, jReceta] = await Promise.all([
      backend({ mode: 'read', resource: 'fichas', params: { receta_id: recetaId } }),
      backend({ mode: 'read', resource: 'recetas', params: { id: recetaId }, id: recetaId }),
    ]);
    if (!jFicha.ok) return NextResponse.json({ ok: false, error: jFicha.error?.message }, { status: 502 });

    const ficha = Array.isArray(jFicha.data) ? jFicha.data[0] || null : jFicha.data;
    const receta = jReceta.ok ? jReceta.data : null;
    return NextResponse.json({ ok: true, ficha, receta });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

/** POST /api/fichas  body: { receta_id, descripcion?, preparacion?, emplatado?, notas?, foto_url?, tiempo_min?, gramaje_porcion? } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body?.receta_id) return NextResponse.json({ ok: false, error: 'Falta receta_id' }, { status: 400 });

    const usuario = await getUsuario();
    const j = await backend({
      resource: 'fichas',
      action: 'guardar',
      data: { ...body, usuario },
    });
    if (!j.ok) return NextResponse.json({ ok: false, error: j.error?.message || 'Error del backend' }, { status: 502 });
    return NextResponse.json({ ok: true, ficha: j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
