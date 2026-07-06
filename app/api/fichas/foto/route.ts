import { NextRequest, NextResponse } from 'next/server';
import { getUsuario } from '@/lib/session';

export const dynamic = 'force-dynamic';

const API_URL = process.env.GASTROCORE_API_URL || '';
const API_TOKEN = process.env.GASTROCORE_API_TOKEN || '';

// El cliente ya comprime la imagen (~1600px JPEG) antes de enviarla, pero
// ponemos un tope duro por si acaso: Vercel rechaza cuerpos > ~4.5 MB.
const MAX_BASE64 = 4 * 1024 * 1024; // ~3 MB de imagen real

/** POST /api/fichas/foto  body: { receta_id, base64, mime, nombre? } */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { receta_id, base64, mime } = body || {};
    if (!receta_id || !base64) {
      return NextResponse.json({ ok: false, error: 'Faltan receta_id o la imagen' }, { status: 400 });
    }
    if (String(base64).length > MAX_BASE64) {
      return NextResponse.json(
        { ok: false, error: 'La imagen es demasiado grande. Usa una foto de menos de 3 MB.' },
        { status: 413 },
      );
    }
    if (mime && !String(mime).startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'El archivo debe ser una imagen' }, { status: 400 });
    }

    const usuario = await getUsuario();
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource: 'fichas',
        action: 'subirFoto',
        token: API_TOKEN,
        data: { receta_id, base64, mime: mime || 'image/jpeg', usuario },
      }),
      cache: 'no-store',
    });
    const j = await r.json();
    if (!j.ok) {
      return NextResponse.json({ ok: false, error: j.error?.message || 'Error al subir la foto' }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...j.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
