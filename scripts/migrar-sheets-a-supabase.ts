/**
 * scripts/migrar-sheets-a-supabase.ts
 * ----------------------------------------------------------------------------
 * Completa en Supabase los recursos que hoy están vacíos para la marca
 * "Rocoto" (la única marca con datos reales — las otras 3 marcas nuevas
 * arrancan vacías, según lo confirmado con Mariluz, así que este script NO
 * necesita crear marcas nuevas ni remapear ids).
 *
 * familias, subfamilias, insumos, recetas (campos base) y unidades_medida
 * YA existen en Supabase con los MISMOS ids de texto que en Sheets
 * (ej. INS-000001, REC-000011) — este script no los vuelve a crear, solo
 * los usa como referencia y, en --dry-run, compara sus conteos contra
 * Sheets como chequeo de salud.
 *
 * Recursos que sí faltan y este script sabe llenar:
 *   - fichas_tecnicas      (una por receta, vía getFicha)
 *   - historial_recetas    (vía getHistorialReceta)
 *   - configuracion        (parámetros de negocio, vía getParametros)
 *   - usuarios             (nombre/email/rol — NUNCA clave_hash, ver abajo)
 *
 * Recursos que necesitan confirmar su forma real antes de escribir nada
 * (--recurso=subrecetas y --recurso=ingredientes solo hacen un DIAGNÓSTICO:
 * traen los datos de Apps Script y los imprimen tal cual, sin transformarlos
 * ni escribir en Supabase, porque el tipo Receta/IngredienteReceta de
 * gastrocore.ts no alcanza a confirmar cómo se relaciona una subreceta con
 * su insumo "puente" — mejor ver el dato real que adivinar la relación):
 *   - subrecetas
 *   - ingredientes
 *
 * SIEMPRE lee con las funciones que YA existen en lib/api/gastrocore.ts
 * (nunca se reimplementa la llamada a Apps Script) y escribe con la
 * SUPABASE_SERVICE_ROLE_KEY (ignora RLS a propósito: es una carga
 * administrativa, no una petición de un usuario final).
 *
 * Uso:
 *   npx tsx scripts/migrar-sheets-a-supabase.ts --recurso=fichas --dry-run
 *   npx tsx scripts/migrar-sheets-a-supabase.ts --recurso=fichas
 *   npx tsx scripts/migrar-sheets-a-supabase.ts --recurso=todos --dry-run
 *
 * Recursos válidos para --recurso=: chequeo, fichas, historial,
 * configuracion, usuarios, subrecetas, ingredientes, todos (default: todos).
 *
 * IMPORTANTE: correr SIEMPRE primero con --dry-run, revisar los conteos y
 * la muestra impresa, y solo repetir sin --dry-run cuando Mariluz/Diego
 * confirmen que cuadra con lo que hay en Sheets.
 */
import {
  getUnidades,
  getFamilias,
  getSubfamilias,
  getInsumos,
  getRecetas,
  getSubrecetas,
  getIngredientesReceta,
  getFicha,
  getHistorialReceta,
  getParametros,
  getUsuarios,
} from '../lib/api/gastrocore';
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const RECURSO = (process.argv.find((a) => a.startsWith('--recurso=')) ?? '--recurso=todos').split('=')[1];
const MARCA_SLUG = (process.argv.find((a) => a.startsWith('--marca=')) ?? '--marca=rocoto').split('=')[1];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno. ' +
      'Son las mismas que ya usa la app en producción — no son nuevas.'
  );
}
if (!process.env.GASTROCORE_API_URL || !process.env.GASTROCORE_API_TOKEN) {
  throw new Error(
    'Faltan GASTROCORE_API_URL o GASTROCORE_API_TOKEN: lib/api/gastrocore.ts los necesita para leer de Apps Script.'
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function marcaId(slug: string): Promise<string> {
  const { data, error } = await supabase.from('marcas').select('id').eq('slug', slug).single();
  if (error || !data) throw new Error(`No se encontró la marca "${slug}" en Supabase: ${error?.message ?? 'sin datos'}`);
  return data.id as string;
}

/** true/false a partir de los distintos formatos que puede traer Sheets (booleano real o texto). */
function aBooleano(v: unknown, porDefecto = true): boolean {
  if (typeof v === 'boolean') return v;
  if (v === undefined || v === null || v === '') return porDefecto;
  const s = String(v).trim().toLowerCase();
  return s === 'true' || s === 'sí' || s === 'si' || s === '1' || s === 'verdadero';
}

async function upsertLote(tabla: string, filas: Record<string, unknown>[], onConflict: string) {
  if (filas.length === 0) {
    console.log(`  ${tabla}: nada que escribir.`);
    return;
  }
  if (DRY_RUN) {
    console.log(`  [dry-run] ${tabla}: ${filas.length} filas listas.`);
    console.log(`  [dry-run] muestra (hasta 2 filas):`, JSON.stringify(filas.slice(0, 2), null, 2));
    return;
  }
  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500);
    const { error } = await supabase.from(tabla).upsert(lote, { onConflict });
    if (error) throw new Error(`Error escribiendo en ${tabla}: ${error.message}`);
  }
  console.log(`  ${tabla}: ${filas.length} filas escritas.`);
}

// ---------------------------------------------------------------------------
// Chequeo de salud: NO escribe nada. Compara Sheets vs Supabase para los
// recursos que ya deberían estar completos, para detectar cualquier desvío
// antes de seguir.
// ---------------------------------------------------------------------------
async function chequeoDeSalud(mId: string) {
  console.log('\n== Chequeo: Sheets vs Supabase (recursos que ya deberían estar completos) ==');
  const [unidades, familias, subfamilias, insumos, recetas] = await Promise.all([
    getUnidades(),
    getFamilias(),
    getSubfamilias(),
    getInsumos(),
    getRecetas(true),
  ]);

  const contarSupabase = async (tabla: string, filtrarPorMarca: boolean) => {
    let q = supabase.from(tabla).select('*', { count: 'exact', head: true });
    if (filtrarPorMarca) q = q.eq('marca_id', mId);
    const { count, error } = await q;
    if (error) throw new Error(`Error contando ${tabla}: ${error.message}`);
    return count ?? 0;
  };

  const filas: [string, number, string, boolean][] = [
    ['unidades', unidades.length, 'unidades_medida', false],
    ['familias', familias.length, 'familias', true],
    ['subfamilias', subfamilias.length, 'subfamilias', true],
    ['insumos', insumos.length, 'insumos', true],
    ['recetas', recetas.length, 'recetas', true],
  ];
  for (const [nombre, enSheets, tabla, filtrarPorMarca] of filas) {
    const enSupabase = await contarSupabase(tabla, filtrarPorMarca);
    const marca = enSheets === enSupabase ? 'OK' : '⚠️ NO CUADRA';
    console.log(`  ${nombre}: Sheets=${enSheets}  Supabase=${enSupabase}  ${marca}`);
  }
}

// ---------------------------------------------------------------------------
// fichas_tecnicas — una por receta. Mapeo directo, sin ambigüedad.
// ---------------------------------------------------------------------------
async function migrarFichas(mId: string) {
  console.log('\n== fichas_tecnicas ==');
  const recetas = await getRecetas(true);
  const filas: Record<string, unknown>[] = [];
  for (const r of recetas) {
    const f = await getFicha(r.id);
    if (!f) continue;
    filas.push({
      id: f.id || `FT-${r.id}`,
      receta_id: r.id,
      preparacion: f.preparacion ?? null,
      emplatado: f.emplatado ?? null,
      notas: f.notas ?? null,
      foto_url: f.foto_url ?? null,
      foto_id: f.foto_id ?? null,
      tiempo_min: f.tiempo_min ?? null,
      gramaje_porcion: f.gramaje_porcion ?? null,
      actualizado_en: null,
      actualizado_por: null,
      marca_id: mId,
    });
  }
  console.log(`  ${filas.length} de ${recetas.length} recetas tienen ficha técnica en Sheets.`);
  await upsertLote('fichas_tecnicas', filas, 'id');
}

// ---------------------------------------------------------------------------
// historial_recetas — todo el historial de cada receta.
// ---------------------------------------------------------------------------
async function migrarHistorial(mId: string) {
  console.log('\n== historial_recetas ==');
  const recetas = await getRecetas(true);
  const filas: Record<string, unknown>[] = [];
  for (const r of recetas) {
    const historial = await getHistorialReceta(r.id);
    for (const h of historial) {
      filas.push({
        id: h.id,
        receta_id: h.receta_id,
        accion: h.accion ?? null,
        usuario: h.usuario ?? null,
        fecha: h.fecha,
        nombre: h.nombre ?? null,
        costo_total: h.costo_total ?? null,
        costo_porcion: h.costo_porcion ?? null,
        food_cost: h.food_cost ?? null,
        precio_real: h.precio_real ?? null,
        cambios: h.cambios ?? null,
        version: h.version ?? null,
        origen: h.origen ?? null,
        campo: h.campo ?? null,
        valor_anterior: h.valor_anterior != null ? String(h.valor_anterior) : null,
        valor_nuevo: h.valor_nuevo != null ? String(h.valor_nuevo) : null,
        observaciones: h.observaciones ?? null,
        // la columna es jsonb: si el snapshot llega como string, se guarda tal cual
        // (Postgres lo acepta como jsonb string); si ya es objeto, se serializa.
        snapshot: h.snapshot ?? null,
        marca_id: mId,
      });
    }
  }
  console.log(`  ${filas.length} filas de historial en total, de ${recetas.length} recetas.`);
  await upsertLote('historial_recetas', filas, 'id');
}

// ---------------------------------------------------------------------------
// configuracion — un renglón (clave/valor) por cada campo de Parametros.
// ---------------------------------------------------------------------------
async function migrarConfiguracion(mId: string) {
  console.log('\n== configuracion (parámetros de negocio) ==');
  const p = await getParametros();
  if (!p) {
    console.log('  getParametros() no devolvió nada — nada que migrar.');
    return;
  }
  const entradas: [string, unknown][] = [
    ['nombre_negocio', p.nombre_negocio ?? null],
    ['fc_objetivo', p.fc_objetivo],
    ['fc_por_familia', p.fc_por_familia ?? {}],
    ['impuesto_pct', p.impuesto_pct],
    ['alerta_subida_pct', p.alerta_subida_pct],
  ];
  const filas = entradas
    .filter(([, valor]) => valor !== null && valor !== undefined)
    .map(([clave, valor]) => ({
      clave,
      valor,
      actualizado_en: new Date().toISOString(),
      actualizado_por: 'migracion-sheets-a-supabase',
      marca_id: mId,
    }));
  console.log(`  ${filas.length} parámetros encontrados: ${filas.map((f) => f.clave).join(', ')}`);
  await upsertLote('configuracion', filas, 'marca_id,clave');
}

// ---------------------------------------------------------------------------
// usuarios — nombre/email/rol. NUNCA clave_hash (se define aparte con
// bcrypt + flujo de reseteo). El id de Supabase es uuid (no el id de
// Sheets), así que el upsert usa el email como llave natural.
// ---------------------------------------------------------------------------
async function migrarUsuarios(mId: string) {
  console.log('\n== usuarios ==');
  const usuarios = await getUsuarios();
  if (usuarios.length === 0) {
    console.log('  Sheets no devolvió usuarios (o el recurso "usuarios" no responde con mode:read — confirmar).');
    return;
  }
  const filas = usuarios.map((u) => ({
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    activo: aBooleano(u.activo, true),
    // Todos arrancan asignados a Rocoto por default — es la única marca con
    // datos reales hoy. Un Admin que deba ver varias marcas se cambia a
    // marca_id = NULL a mano en Supabase (o desde la Fase 5) cuando haga
    // falta; no se decide aquí de una vez por todas.
    marca_id: mId,
  }));
  console.log(`  ${filas.length} usuarios en Sheets.`);
  await upsertLote('usuarios', filas, 'email');
}

// ---------------------------------------------------------------------------
// DIAGNÓSTICO (no escribe nada): subrecetas e ingredientes. Antes de migrar
// estos dos hace falta ver la forma real del dato — el tipo Receta de
// gastrocore.ts no expone cómo una subreceta se liga a su insumo "puente"
// (ver docs/arquitectura.md, sección "Subrecetas: maestro-calculadora"), y
// la tabla ingredientes_receta tiene una columna receta_id NOT NULL Y una
// subreceta_id nullable a la vez — hay que confirmar con un dato real cómo
// se llenan ambas antes de escribir el mapeo.
// ---------------------------------------------------------------------------
async function diagnosticoSubrecetas() {
  console.log('\n== DIAGNÓSTICO subrecetas (no escribe nada) ==');
  const subrecetas = await getSubrecetas(true);
  console.log(`  Sheets tiene ${subrecetas.length} subrecetas.`);
  if (subrecetas.length > 0) {
    console.log('  Primer registro TAL CUAL llega de Apps Script:');
    console.log(JSON.stringify(subrecetas[0], null, 2));
    console.log(
      '\n  Revisar: ¿trae un campo que identifique el insumo "puente" (insumo_id o similar)? ' +
        'Con eso se completa el mapeo real en este script.'
    );
  }
}

async function diagnosticoIngredientes() {
  console.log('\n== DIAGNÓSTICO ingredientes_receta (no escribe nada) ==');
  const recetas = await getRecetas(true);
  const primera = recetas[0];
  if (!primera) {
    console.log('  No hay recetas para probar.');
    return;
  }
  const ingredientes = await getIngredientesReceta(primera.id);
  console.log(`  Receta de prueba: ${primera.id} (${primera.nombre}) — ${ingredientes.length} ingredientes en Sheets.`);
  if (ingredientes.length > 0) {
    console.log('  Primer registro TAL CUAL llega de Apps Script:');
    console.log(JSON.stringify(ingredientes[0], null, 2));
  } else {
    console.log(
      '  Esta receta no trajo ingredientes desde Apps Script. Probar con --recurso=ingredientes ' +
        'usando otra receta, o confirmar con Diego si el recurso "ingredientes" está poblado en Sheets.'
    );
  }
}

async function main() {
  console.log(`== Migración Sheets -> Supabase (${DRY_RUN ? 'DRY RUN' : 'MODO REAL'}) — recurso: ${RECURSO} ==`);
  const mId = await marcaId(MARCA_SLUG);
  console.log(`Marca destino: ${MARCA_SLUG} (${mId})`);

  const pasos: Record<string, () => Promise<void>> = {
    chequeo: () => chequeoDeSalud(mId),
    fichas: () => migrarFichas(mId),
    historial: () => migrarHistorial(mId),
    configuracion: () => migrarConfiguracion(mId),
    usuarios: () => migrarUsuarios(mId),
    subrecetas: diagnosticoSubrecetas,
    ingredientes: diagnosticoIngredientes,
  };

  if (RECURSO === 'todos') {
    for (const [nombre, fn] of Object.entries(pasos)) {
      await fn();
    }
  } else if (pasos[RECURSO]) {
    await pasos[RECURSO]();
  } else {
    throw new Error(`--recurso="${RECURSO}" no reconocido. Válidos: ${['todos', ...Object.keys(pasos)].join(', ')}`);
  }

  console.log('\nListo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
