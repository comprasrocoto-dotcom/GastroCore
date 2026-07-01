import { NextResponse } from 'next/server';
import { getInsumos } from '@/lib/api/gastrocore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const insumos = await getInsumos();
    return NextResponse.json({ ok: true, data: insumos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
