/**
 * GastroCore — Verificador del mapeo de columnas (Fase 3).
 *
 * POR QUÉ EXISTE
 * --------------
 * El mapeo de `lib/supabase/mapeo.ts` se dedujo de las migraciones SQL, no de
 * la base real: la sesión que escribió la Fase 3 no tuvo credenciales de
 * Supabase. Las migraciones nombran muchas columnas, pero no todas — por
 * ejemplo `insumos.referencia` o `familias.centrocosto` se infirieron de los
 * tipos del frontend.
 *
 * Este script compara las dos cosas y dice exactamente qué no calza, en vez de
 * que la app falle en producción con "column does not exist" a mitad de un
 * servicio.
 *
 * CÓMO CORRERLO
 *   export NEXT_PUBLIC_SUPABASE_URL=...
 *   export SUPABASE_SERVICE_ROLE_KEY=...
 *   npm run verificar-esquema
 *
 * Sale con código 1 si falta alguna columna, para poder usarlo en CI antes de
 * permitir GASTROCORE_BACKEND=supabase.
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!URL || !KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

/** Espejo de COLS en lib/supabase/mapeo.ts. Mantener sincronizado. */
const ESPERADO: Record<string, string[]> = {
  insumos: ['id', 'marca_id', 'referencia', 'articulo', 'unidad', 'subfamilia_id', 'coste'],
  recetas: [
    'id', 'marca_id', 'nombre', 'familia_id', 'rendimiento', 'unidad_rendimiento_codigo',
    'merma_pct', 'desvio_pct', 'costo_total', 'costo_porcion', 'food_cost',
    'precio_sugerido', 'precio_real', 'margen_objetivo', 'iva', 'activo',
    'creado_en', 'actualizado_en', 'creado_por', 'actualizado_por',
  ],
  subrecetas: [
    'id', 'marca_id', 'insumo_id', 'nombre', 'familia_id', 'rendimiento',
    'unidad_rendimiento_codigo', 'merma_pct', 'desvio_pct', 'costo_total',
    'costo_porcion', 'activo', 'creado_en', 'actualizado_en',
  ],
  ingredientes_receta: [
    'id', 'marca_id', 'receta_id', 'subreceta_id', 'tipo_item', 'item_id',
    'cantidad', 'unidad_codigo', 'merma_pct', 'costo_unitario', 'costo_linea', 'orden',
  ],
  familias: ['id', 'marca_id', 'nombre', 'tipo', 'activo', 'centrocosto'],
  subfamilias: ['id', 'marca_id', 'familia_id', 'nombre', 'tipo', 'activo', 'centrocosto'],
  unidades_medida: ['codigo', 'nombre', 'tipo', 'activo'],
  fichas_tecnicas: [
    'id', 'marca_id', 'receta_id', 'descripcion', 'preparacion', 'emplatado',
    'notas', 'foto_url', 'foto_id', 'tiempo_min', 'gramaje_porcion',
  ],
  historial_recetas: [
    'id', 'marca_id', 'receta_id', 'accion', 'usuario', 'fecha', 'nombre',
    'costo_total', 'costo_porcion', 'food_cost', 'precio_real', 'cambios', 'version', 'origen',
  ],
  precios_historicos: [
    'id', 'marca_id', 'insumo_id', 'coste', 'fecha', 'usuario_id',
    'coste_anterior', 'diferencia', 'motivo',
  ],
  snapshots_semanales: [
    'id', 'marca_id', 'fecha', 'hora', 'usuario', 'cantidad_insumos',
    'costo_promedio', 'insumos_modificados', 'nota',
  ],
  configuracion: ['marca_id', 'clave', 'valor'],
  marcas: ['id', 'nombre', 'slug', 'activo'],
};

const VISTAS: Record<string, string[]> = {
  recetario_publico: [
    'id', 'marca_id', 'marca_slug', 'nombre', 'familia_id', 'familia_nombre',
    'rendimiento', 'unidad_rendimiento_codigo', 'activo', 'preparacion',
    'emplatado', 'notas', 'foto_url', 'tiempo_min', 'gramaje_porcion',
  ],
  recetario_publico_ingredientes: [
    'id', 'marca_id', 'receta_id', 'subreceta_id', 'tipo_item', 'item_id',
    'item_nombre', 'cantidad', 'unidad_codigo', 'unidad_nombre', 'merma_pct', 'orden',
  ],
};

/**
 * Pide una fila pidiendo UNA columna. Si la columna no existe, PostgREST
 * responde con error 42703 — que es exactamente lo que queremos detectar.
 * Se hace columna por columna porque un select con varias falla entero en la
 * primera mala y no dice cuáles más faltan.
 */
async function existeColumna(relacion: string, columna: string): Promise<boolean> {
  const { error } = await sb.from(relacion).select(columna).limit(1);
  if (!error) return true;
  if (error.code === '42703' || /does not exist/i.test(error.message)) return false;
  // Otro error (relación inexistente, permisos): se reporta aparte.
  throw new Error(relacion + ': ' + error.message);
}

async function main() {
  let problemas = 0;

  for (const [grupo, mapa] of [['TABLA', ESPERADO], ['VISTA', VISTAS]] as const) {
    for (const [relacion, columnas] of Object.entries(mapa)) {
      let faltantes: string[] = [];
      try {
        for (const col of columnas) {
          if (!(await existeColumna(relacion, col))) faltantes.push(col);
        }
      } catch (e) {
        console.log('✗ ' + grupo + ' ' + relacion + ' — ' + (e as Error).message);
        problemas++;
        continue;
      }

      if (faltantes.length) {
        console.log('✗ ' + grupo + ' ' + relacion + ' — no existen: ' + faltantes.join(', '));
        problemas += faltantes.length;
      } else {
        console.log('✓ ' + grupo + ' ' + relacion + ' (' + columnas.length + ' columnas)');
      }
    }
  }

  // Conteos de control: los mismos que verificó la sesión de migración.
  console.log('\n— Conteos —');
  for (const t of ['marcas', 'insumos', 'recetas', 'familias', 'ingredientes_receta']) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    console.log('  ' + t + ': ' + (error ? 'error — ' + error.message : count));
  }
  console.log(
    '\n  Recordatorio: si ingredientes_receta sigue en 0, el recetario público\n' +
    '  mostrará recetas sin ingredientes. Ese hueco viene de Sheets, no de esta fase.',
  );

  if (problemas) {
    console.log('\n' + problemas + ' desajuste(s). Corrige COLS en lib/supabase/mapeo.ts antes de activar GASTROCORE_BACKEND=supabase.');
    process.exit(1);
  }
  console.log('\nMapeo verificado: el esquema real coincide con lib/supabase/mapeo.ts.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
