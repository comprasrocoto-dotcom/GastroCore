/**
 * GastroCore — Middleware de sesión (v4.1).
 *
 * v4.1 corrige el fallo MIDDLEWARE_INVOCATION_FAILED de v4: se importaban
 * nombres inexistentes. Los reales en lib/auth.ts son `verifySessionValue`
 * y `SESSION_COOKIE` ('gc_session').
 *
 * Reglas:
 *  1. Rutas PÚBLICAS (sin sesión): /login, su API, y el RECETARIO de cocina
 *     (/recetario y sus subrutas). El recetario se sirve desde el servidor con
 *     datos cacheados; el navegador de cocina nunca ve el token de la API.
 *  2. Todo lo demás exige cookie de sesión válida (HMAC, 12 h).
 *  3. Mutaciones (POST/PUT/DELETE) sobre /api/* exigen rol Admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionValue, SESSION_COOKIE } from '@/lib/auth';

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

  const cookie = req.cookies.get(SESSION_COOKIE)?.value || '';
  const sesion = await verifySessionValue(cookie);

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

  // ── MATRIZ DE ROLES (v5) ─────────────────────────────────────────────
  //  Admin : todo.
  //  Chef  : puede crear/editar recetas, subrecetas y fichas técnicas; el
  //          resto solo lectura.
  //  Lector: solo lectura en toda la aplicación.
  const rol = sesion.r;

  // Usuarios y Configuración: exclusivos de Admin, incluso para VER.
  const zonaAdmin =
    pathname === '/usuarios' || pathname.startsWith('/usuarios/') ||
    pathname === '/configuracion' || pathname.startsWith('/configuracion/') ||
    pathname.startsWith('/api/usuarios') || pathname.startsWith('/api/config');
  if (zonaAdmin && rol !== 'Admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ ok: false, error: 'Sección exclusiva de Admin' }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Mutaciones de la API según el rol.
  const esMutacion = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE';
  if (pathname.startsWith('/api/') && esMutacion) {
    const chefPuede = /^\/api\/(recetas|subrecetas|fichas)(\/|$|\?)/.test(pathname);
    const permitido = rol === 'Admin' || (rol === 'Chef' && chefPuede);
    if (!permitido) {
      return NextResponse.json(
        { ok: false, error: 'Tu rol (' + rol + ') no permite esta acción' },
        { status: 403 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
