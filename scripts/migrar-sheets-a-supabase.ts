/**
 * scripts/migrar-sheets-a-supabase.ts
 * ----------------------------------------------------------------------------
 * IMPORTANTE: al revisar el proyecto de Supabase encontramos que los datos
 * de la marca "Rocoto" YA ESTÁN migrados (471 insumos, 87 recetas, 18
 * familias, etc. — ver docs/arquitectura.md). La migración 0001 les agrega
 * marca_id automáticamente. Este script YA NO hace falta para Rocoto.
 *
 * Sigue siendo útil si las otras 3 marcas nuevas tienen sus propias hojas
 * de Google Sheets que haya que importar (a confirmar con Diego/Mariluz —
 * ver "Qué falta" en docs/arquitectura.md). Si las otras marcas van a
 * arrancar vacías y cargarse a mano desde la app, este script no se
 * necesita en absoluto.
 *
 * ESQUELETO de la Fase 2 del plan de migración. Este archivo se escribió
 * SIN acceso al repo real de GastroCore (no había código de Next.js
 * disponible en esta sesión), así que los imports de `lib/api/gastrocore`
 * y los nombres exactos de campo están marcados con TODO y deben ajustarse
 * a lo que ya existe en `lib/api/gastrocore.ts` antes de correrlo.
 *
 * Qué SÍ hace este archivo:
 *   - Define el orden correcto de migración (respeta dependencias FK).
 *   - Trae un mapa id_legado -> uuid nuevo para poder resolver referencias
 *     (ej. una receta que referencia una familia que ya se migró).
 *   - Soporta --dry-run (solo cuenta e imprime) y modo real (inserta).
 *   - Usa la service_role key de Supabase (nunca la anon key) porque hace
 *     escritura masiva ignorando RLS a propósito.
 *
 * Uso previsto (una vez pegado en el repo real):
 *   npx tsx scripts/migrar-sheets-a-supabase.ts --marca="Nombre de la marca" --dry-run
 *   npx tsx scripts/migrar-sheets-a-supabase.ts --marca="Nombre de la marca"
 */

import { createClient } from '@supabase/supabase-js';
// TODO: ajustar este import a las funciones de lectura que ya existen en
// lib/api/gastrocore.ts (leerInsumos, leerRecetas, leerFamilias, etc).
// import * as sheets from '../lib/api/gastrocore';

const DRY_RUN = process.argv.includes('--dry-run');
const MARCA_NOMBRE = (process.argv.find((a) => a.startsWith('--marca=')) ?? '--marca=Marca principal').split('=')[1];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

/** Mapa genérico id_legado (de Sheets) -> uuid nuevo (de Supabase). */
type MapaIds = Map<string, string>;

function slugify(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function obtenerOCrearMarca(nombre: string): Promise<string> {
  const slug = slugify(nombre);
  const { data: existente } = await supabase.from('marcas').select('id').eq('slug', slug).maybeSingle();
  if (existente) return existente.id;

  if (DRY_RUN) {
    console.log(`[dry-run] crearía marca "${nombre}" (slug: ${slug})`);
    return 'DRY-RUN-MARCA-ID';
  }
  const { data, error } = await supabase.from('marcas').insert({ nombre, slug }).select('id').single();
  if (error) throw error;
  return data.id;
}

/**
 * Inserta un lote de filas y devuelve el mapa id_legado -> id nuevo.
 * En --dry-run solo cuenta, no inserta.
 */
async function migrarTabla<T extends { id_legado: string }>(
  tabla: string,
  filas: T[],
  opts: { resolverFks?: (fila: T) => T } = {}
): Promise<MapaIds> {
  const mapa: MapaIds = new Map();

  if (DRY_RUN) {
    console.log(`[dry-run] ${tabla}: migraría ${filas.length} filas`);
    return mapa;
  }

  const filasResueltas = opts.resolverFks ? filas.map(opts.resolverFks) : filas;
  // Insertar en lotes de 500 para no saturar la conexión.
  for (let i = 0; i < filasResueltas.length; i += 500) {
    const lote = filasResueltas.slice(i, i + 500);
    const { data, error } = await supabase.from(tabla).insert(lote).select('id, id_legado');
    if (error) throw new Error(`Error insertando en ${tabla}: ${error.message}`);
    for (const fila of data ?? []) mapa.set(fila.id_legado, fila.id);
  }
  console.log(`${tabla}: migradas ${filasResueltas.length} filas`);
  return mapa;
}

async function main() {
  console.log(`== Migración Sheets -> Supabase (${DRY_RUN ? 'DRY RUN' : 'MODO REAL'}) ==`);

  const marcaId = await obtenerOCrearMarca(MARCA_NOMBRE);
  console.log(`Marca destino: ${MARCA_NOMBRE} (${marcaId})`);

  // TODO: reemplazar cada bloque por la lectura real desde Apps Script y el
  // mapeo de columnas exacto (los nombres de la hoja no siempre calzan 1:1
  // con las columnas nuevas — revisar lib/api/gastrocore.ts tipo por tipo).
  //
  // Orden de migración (respeta FKs):
  //   1. unidades            (global, sin marca_id)
  //   2. familias
  //   3. subfamilias
  //   4. insumos
  //   5. subrecetas          (depende de insumos)
  //   6. recetas             (depende de familias)
  //   7. ingredientes_receta (depende de recetas/subrecetas/insumos/unidades)
  //   8. ficha_tecnica
  //   9. historial_recetas / historial_insumos / snapshots_semanales
  //  10. parametros
  //  11. usuarios            (¡clave_hash! no migrar contraseñas en texto plano)

  console.log('TODO: completar los 11 pasos de arriba usando lib/api/gastrocore.ts');
  console.log('Deja cada paso corriendo con --dry-run primero y compara conteos con Diego antes de insertar de verdad.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
