import { NextResponse } from 'next/server';
import { getSubfamilias, crearSubfamilia } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getSubfamilias();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg, data: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const nombre = String(body?.nombre || '').trim();
    const familia_id = String(body?.familia_id || '').trim();
    if (!nombre || !familia_id) {
      return NextResponse.json({ ok: false, error: 'Nombre y familia son obligatorios' }, { status: 400 });
    }
    const r = await crearSubfamilia({ familia_id, nombre, tipo: 'receta' });
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
