/**
 * GastroCore — Middleware de sesión (v4).
 *
 * Reglas:
 *  1. Rutas PÚBLICAS (sin sesión): /login, su API, y el RECETARIO de cocina
 *     (/recetario y sus subrutas). El recetario se sirve desde el servidor con
 *     datos cacheados; el navegador de cocina nunca ve el token de la API.
 *  2. Todo lo demás exige cookie de sesión válida (HMAC, 12 h).
 *  3. Mutaciones (POST/PUT/DELETE) sobre /api/* exigen rol Admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verificarCookieSesion } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/recetario'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Assets estáticos y archivos de Next no pasan por auth.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // .png, .ico, .svg, etc.
  ) {
    return NextResponse.next();
  }

  if (isPublic(pathname)) return NextResponse.next();

  const cookie = req.cookies.get('gastrocore_session')?.value || '';
  const sesion = await verificarCookieSesion(cookie);

  if (!sesion) {
    // API sin sesión -> 401 JSON; página sin sesión -> redirect a /login.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Mutaciones de la API solo para Admin.
  const esMutacion = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE';
  if (pathname.startsWith('/api/') && esMutacion && sesion.r !== 'Admin') {
    return NextResponse.json(
      { ok: false, error: 'Se requiere rol Admin para esta acción' },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
