import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, createSessionValue, authConfigured, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!authConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Autenticación no configurada en el servidor (faltan APP_PASSWORD / AUTH_SECRET).' },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const password = String(body?.password || '');
    const nombre = String(body?.nombre || '').trim().slice(0, 60) || 'Usuario';

    if (!checkPassword(password)) {
      return NextResponse.json({ ok: false, error: 'Contraseña incorrecta' }, { status: 401 });
    }

    const value = await createSessionValue(nombre);
    const res = NextResponse.json({ ok: true, usuario: nombre });
    res.cookies.set(SESSION_COOKIE, value, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
