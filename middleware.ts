import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionValue } from '@/lib/auth';

/**
 * Puerta de entrada única. TODO lo que no esté aquí exige sesión válida:
 *   - páginas sin sesión  -> redirect a /login?next=<ruta>
 *   - rutas /api/* sin sesión -> 401 JSON (para que el fetch del cliente lo maneje)
 *
 * El matcher excluye assets estáticos para no gastar ciclos en cada imagen.
 */
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const session = await verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Corre en todo EXCEPTO internos de Next y archivos estáticos.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff|woff2)$).*)',
  ],
};
