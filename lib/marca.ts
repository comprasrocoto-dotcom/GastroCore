/**
 * GastroCore — Resolución de la marca activa (SOLO SERVIDOR).
 *
 * ESTADO: puente temporal hasta la Fase 4.
 *
 * El diseño final (ver migración 0002) es que la marca viaje en la sesión:
 * un Chef o Lector está atado a una marca, y un Admin con marca_id = NULL ve
 * varias. Pero la cookie de sesión actual (`lib/auth.ts`, tipo Session) solo
 * lleva { u, r, exp, e } — no tiene marca, porque el login todavía pasa por
 * Apps Script.
 *
 * Mientras tanto, la marca se resuelve así, en orden:
 *   1. El campo `m` de la sesión, si algún día existe → lo pondrá la Fase 4.
 *   2. La variable de entorno GASTROCORE_MARCA (slug).
 *   3. 'rocoto', que es la única marca con datos reales hoy.
 *
 * Cuando llegue la Fase 4 solo hay que borrar los pasos 2 y 3. Ninguna otra
 * parte del código consulta la marca por su cuenta.
 */
import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/cliente';
import { getSession } from '@/lib/session';

export type Marca = {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
};

const SLUG_POR_DEFECTO = process.env.GASTROCORE_MARCA || 'rocoto';

// Caché en memoria: la tabla `marcas` tiene 4 filas y cambia casi nunca.
// Vive por instancia de Vercel, igual que el caché de lecturas.
let _cache: { at: number; marcas: Marca[] } | null = null;
const TTL_MS = 10 * 60 * 1000;

async function cargarMarcas(): Promise<Marca[]> {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.marcas;

  const { data, error } = await supabaseAdmin()
    .from('marcas')
    .select('id, nombre, slug, activo')
    .order('nombre');

  if (error) throw new Error('No se pudieron leer las marcas: ' + error.message);

  const marcas = (data || []) as Marca[];
  _cache = { at: Date.now(), marcas };
  return marcas;
}

/** Vacía el caché de marcas (tras crear o renombrar una). */
export function limpiarCacheMarcas(): void {
  _cache = null;
}

/** Todas las marcas registradas. */
export async function getMarcas(): Promise<Marca[]> {
  return cargarMarcas();
}

/** Marca por slug de URL, o null si no existe o está inactiva. */
export async function getMarcaPorSlug(slug: string): Promise<Marca | null> {
  const limpio = String(slug || '').trim().toLowerCase();
  if (!limpio) return null;
  const marcas = await cargarMarcas();
  return marcas.find((m) => m.slug === limpio && m.activo) || null;
}

/** Marca por id. */
export async function getMarcaPorId(id: string): Promise<Marca | null> {
  const marcas = await cargarMarcas();
  return marcas.find((m) => m.id === id) || null;
}

/**
 * La marca del usuario que hace esta petición.
 *
 * OJO: hoy devuelve siempre la marca por defecto para cualquier usuario,
 * porque la sesión no guarda marca todavía. Eso es correcto mientras solo
 * exista Rocoto con datos, pero es exactamente lo que la Fase 4 tiene que
 * arreglar antes de cargar la segunda marca.
 */
export async function getMarcaActual(): Promise<Marca> {
  const sesion = (await getSession()) as (Record<string, unknown> | null);
  const slugSesion = sesion && typeof sesion.m === 'string' ? sesion.m : '';

  const slug = slugSesion || SLUG_POR_DEFECTO;
  const marca = await getMarcaPorSlug(slug);

  if (!marca) {
    throw new Error(
      'La marca "' + slug + '" no existe en la tabla `marcas` o está inactiva. ' +
        'Revisa la variable GASTROCORE_MARCA o la migración 0001.',
    );
  }
  return marca;
}

/** Atajo: solo el id de la marca actual (lo que piden las queries). */
export async function getMarcaActualId(): Promise<string> {
  return (await getMarcaActual()).id;
}
