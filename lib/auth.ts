/**
 * GastroCore — Autenticación (sesión firmada por HMAC).
 *
 * Diseñado para funcionar en AMBOS runtimes:
 *   - Edge (middleware.ts): usa Web Crypto (crypto.subtle), disponible en Edge.
 *   - Node (route handlers): Web Crypto también está disponible en Node 18+.
 *
 * NO importa `next/headers` para poder usarse desde el middleware. La lectura
 * de la cookie desde route handlers/Server Components vive en `lib/session.ts`.
 *
 * Modelo: contraseña compartida (APP_PASSWORD) + nombre que el usuario declara
 * al entrar. El nombre viaja firmado dentro de la cookie, así la trazabilidad
 * deja de depender de un campo que el cliente podía falsificar.
 */

const encoder = new TextEncoder();

const SECRET = process.env.AUTH_SECRET || '';
const PASSWORD = process.env.APP_PASSWORD || '';

export const SESSION_COOKIE = 'gc_session';
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 horas

export type Session = { u: string; exp: number };

// ---------- base64url helpers ----------
function bytesToB64url(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToB64url(str: string): string {
  return bytesToB64url(encoder.encode(str));
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------- HMAC ----------
async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return bytesToB64url(sig);
}

/** Comparación en tiempo constante para evitar timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ---------- API pública ----------

/** Crea el valor firmado de la cookie de sesión para un nombre de usuario. */
export async function createSessionValue(username: string): Promise<string> {
  const payload: Session = { u: username, exp: Date.now() + SESSION_MAX_AGE * 1000 };
  const payloadB64 = strToB64url(JSON.stringify(payload));
  const sig = await hmac(payloadB64);
  return `${payloadB64}.${sig}`;
}

/** Verifica firma + expiración. Devuelve la sesión o null si es inválida. */
export async function verifySessionValue(value: string | undefined | null): Promise<Session | null> {
  if (!value) return null;
  const [payloadB64, sig] = value.split('.');
  if (!payloadB64 || !sig) return null;

  const expected = await hmac(payloadB64);
  if (!timingSafeEqual(sig, expected)) return null;

  try {
    const json = new TextDecoder().decode(b64urlToBytes(payloadB64));
    const session = JSON.parse(json) as Session;
    if (!session || typeof session.exp !== 'number' || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Compara la contraseña recibida con APP_PASSWORD en tiempo constante. */
export function checkPassword(input: string): boolean {
  if (!PASSWORD) return false; // sin contraseña configurada => nadie entra
  return timingSafeEqual(input, PASSWORD);
}

/** True si el servidor tiene las variables de auth configuradas. */
export function authConfigured(): boolean {
  return Boolean(SECRET && PASSWORD);
}
