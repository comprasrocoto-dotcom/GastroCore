import { NextRequest, NextResponse } from 'next/server';
import { actualizarInsumo } from '@/lib/api/gastrocore';
import { getUsuario } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = (body?.id || '').trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Falta el id del insumo' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (body.coste !== undefined && body.coste !== null && body.coste !== '') {
      const n = Number(body.coste);
      if (Number.isNaN(n) || n < 0) {
        return NextResponse.json({ ok: false, error: 'Coste invalido' }, { status: 400 });
      }
      data.coste = n;
    }
    if (typeof body.unidad === 'string' && body.unidad.trim()) {
      data.unidad = body.unidad.trim();
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'No hay cambios que aplicar' }, { status: 400 });
    }
    data.motivo = (body.motivo || '').toString().trim();
    // Trazabilidad: el usuario proviene de la sesión firmada, NO del cliente.
    data.usuario = await getUsuario('Panel de insumos');

    const res = await actualizarInsumo(id, data);
    return NextResponse.json({ ok: true, data: res });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
