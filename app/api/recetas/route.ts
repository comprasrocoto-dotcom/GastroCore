import { NextRequest, NextResponse } from 'next/server';
import { crearReceta, getRecetas } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const recetas = await getRecetas();
    return NextResponse.json({ ok: true, data: recetas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await crearReceta(body);
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
