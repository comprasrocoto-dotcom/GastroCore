import { NextResponse } from 'next/server';
import { getFamilias, crearFamilia, actualizarFamilia } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getFamilias();
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
    if (!nombre) {
      return NextResponse.json({ ok: false, error: 'El nombre es obligatorio' }, { status: 400 });
    }
    const r = await crearFamilia({ nombre, tipo: 'receta' });
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ ok: false, error: 'El id es obligatorio' }, { status: 400 });
    const data: { nombre?: string; activo?: boolean } = {};
    if (typeof body.nombre === 'string') data.nombre = body.nombre.trim();
    if (typeof body.activo === 'boolean') data.activo = body.activo;
    const r = await actualizarFamilia(id, data);
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
