/**
 * GastroCore — Cliente de Supabase (SOLO SERVIDOR).
 *
 * CONTRATO CON LA MIGRACIÓN 0002 (RLS):
 * Mientras la Fase 4 (login contra `usuarios` + JWT con claims) no exista,
 * todas las lecturas y escrituras desde Next.js usan la SERVICE_ROLE_KEY,
 * que IGNORA las políticas RLS por diseño. Eso significa que el aislamiento
 * entre marcas NO lo garantiza la base de datos todavía: lo garantiza este
 * código, filtrando por `marca_id` en cada query.
 *
 * Por eso `porMarca()` de abajo no es azúcar sintáctica — es la frontera de
 * seguridad. Cualquier consulta nueva a una tabla operativa DEBE pasar por
 * ahí. Una query que se olvide del filtro devuelve datos de las 4 marcas.
 *
 * Cuando exista la Fase 4, este módulo se cambia por un cliente que firme un
 * JWT con { rol, marca_id, usuario_id } y RLS pasa a ser la primera línea de
 * defensa en vez de la única red de seguridad.
 */
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let _admin: SupabaseClient | null = null;
let _anon: SupabaseClient | null = null;

/**
 * Cliente con service_role. Salta RLS: NUNCA debe llegar al navegador y
 * NUNCA debe consultarse sin filtrar por marca_id.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!URL || !SERVICE_KEY) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno.',
    );
  }
  if (!_admin) {
    _admin = createClient(URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

/**
 * Cliente anónimo. Solo puede leer las dos vistas del recetario público
 * (ver los GRANT de la migración 0003). Se usa en la ruta pública
 * /recetario/[marca], que no tiene sesión.
 */
export function supabaseAnon(): SupabaseClient {
  if (!URL || !ANON_KEY) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en las variables de entorno.',
    );
  }
  if (!_anon) {
    _anon = createClient(URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _anon;
}

/** True si hay credenciales de Supabase configuradas (para el conmutador). */
export function haySupabase(): boolean {
  return Boolean(URL && SERVICE_KEY);
}

/**
 * Tablas operativas que TIENEN columna marca_id (según la migración 0001).
 * `unidades_medida` y `marcas` no están aquí a propósito: la primera es un
 * catálogo global compartido entre las 4 marcas, la segunda es el índice
 * de marcas en sí.
 */
export const TABLAS_POR_MARCA = [
  'familias',
  'subfamilias',
  'insumos',
  'subrecetas',
  'recetas',
  'ingredientes_receta',
  'fichas_tecnicas',
  'historial_recetas',
  'precios_historicos',
  'snapshot_detalle',
  'snapshots_semanales',
  'configuracion',
] as const;

export type TablaPorMarca = (typeof TABLAS_POR_MARCA)[number];

/**
 * Punto de entrada OBLIGATORIO para leer cualquier tabla con marca_id.
 * Devuelve el query builder ya filtrado por la marca indicada.
 *
 *   const { data } = await porMarca('insumos', marcaId).select('*');
 */
export function porMarca(tabla: TablaPorMarca, marcaId: string) {
  if (!marcaId) {
    throw new Error(
      'porMarca("' + tabla + '") sin marca_id. Una consulta sin marca devolvería ' +
        'datos de todas las marcas: es un fallo de aislamiento, no un caso válido.',
    );
  }
  return supabaseAdmin().from(tabla).select('*').eq('marca_id', marcaId);
}
