/**
 * GastroCore — Mapeo entre el esquema de Supabase y los tipos del frontend.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ---------------------------
 * Los tipos que consume la app (`Insumo`, `Receta`, `IngredienteReceta`…)
 * nacieron de las hojas de Google Sheets. El esquema que ya estaba en
 * Supabase usa otros nombres en varias columnas. Los desajustes reales
 * detectados leyendo la migración 0003 (que sí usa los nombres verdaderos):
 *
 *   frontend                          Supabase
 *   ────────────────────────────────  ──────────────────────────────────
 *   Receta.unidad_rendimiento_id      recetas.unidad_rendimiento_codigo
 *   IngredienteReceta.unidad_id       ingredientes_receta.unidad_codigo
 *   Insumo.subfamilia (nombre)        se resuelve por join, no es columna
 *   Insumo.articulo                   insumos.articulo  ✔ (igual)
 *
 * Todo el desajuste vive AQUÍ y en ningún otro lado. Si al correr contra la
 * base real aparece una columna que no se llama como esperábamos, se corrige
 * en este archivo y el resto de la app no se entera.
 *
 * ⚠ VERIFICAR ANTES DE PRODUCCIÓN
 * Este mapeo se dedujo de las migraciones, no de una introspección de la base
 * real (esta sesión no tuvo credenciales de Supabase). Corre
 * `npx tsx scripts/verificar-esquema.ts` con las variables de entorno puestas:
 * compara este mapeo contra information_schema y reporta lo que no calce.
 */
import type {
  Insumo,
  Receta,
  IngredienteReceta,
  Familia,
  Subfamilia,
  Unidad,
  FichaTecnica,
  HistorialReceta,
  HistorialInsumo,
  CatalogoItem,
} from '@/lib/api/tipos';

/** Fila cruda: lo que devuelve Supabase antes de traducirse. */
export type Fila = Record<string, unknown>;

// ── Utilidades de coerción ──────────────────────────────────────────────────
// Las columnas numeric de Postgres llegan como string por el driver JS, y las
// booleanas venidas de Sheets pueden ser 'TRUE'/'SI'/1. Se normalizan aquí.

export function num(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function txt(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

export function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === 'si' || s === 'sí' || s === '1' || s === 'x';
}

// ── Columnas por tabla ──────────────────────────────────────────────────────
// Fuente de verdad para los SELECT. Se listan explícitamente en vez de usar
// '*' para que un cambio de esquema falle aquí y no en una pantalla.

export const COLS = {
  insumos: 'id, marca_id, referencia, articulo, unidad, subfamilia_id, coste',
  recetas:
    'id, marca_id, nombre, familia_id, rendimiento, unidad_rendimiento_codigo, ' +
    'merma_pct, desvio_pct, costo_total, costo_porcion, food_cost, precio_sugerido, ' +
    'precio_real, margen_objetivo, iva, activo, creado_en, actualizado_en, creado_por, actualizado_por',
  subrecetas:
    'id, marca_id, insumo_id, nombre, familia_id, rendimiento, unidad_rendimiento_codigo, ' +
    'merma_pct, desvio_pct, costo_total, costo_porcion, activo, creado_en, actualizado_en',
  ingredientes_receta:
    'id, marca_id, receta_id, subreceta_id, tipo_item, item_id, cantidad, ' +
    'unidad_codigo, merma_pct, costo_unitario, costo_linea, orden',
  familias: 'id, marca_id, nombre, tipo, activo, centrocosto',
  subfamilias: 'id, marca_id, familia_id, nombre, tipo, activo, centrocosto',
  unidades_medida: 'codigo, nombre, tipo, activo',
  fichas_tecnicas:
    'id, marca_id, receta_id, descripcion, preparacion, emplatado, notas, ' +
    'foto_url, foto_id, tiempo_min, gramaje_porcion',
  historial_recetas:
    'id, marca_id, receta_id, accion, usuario, fecha, nombre, costo_total, ' +
    'costo_porcion, food_cost, precio_real, cambios, version, origen',
  precios_historicos:
    'id, marca_id, insumo_id, coste, fecha, usuario_id, coste_anterior, diferencia, motivo',
  marcas: 'id, nombre, slug, activo',
} as const;

// ── Traductores: fila de Supabase → tipo del frontend ───────────────────────

export function aInsumo(f: Fila, nombreSubfamilia = ''): Insumo {
  return {
    id: txt(f.id),
    referencia: txt(f.referencia),
    articulo: txt(f.articulo),
    unidad: txt(f.unidad),
    subfamilia: nombreSubfamilia,
    subfamilia_id: txt(f.subfamilia_id),
    coste: num(f.coste),
  };
}

export function aReceta(f: Fila): Receta {
  return {
    id: txt(f.id),
    nombre: txt(f.nombre),
    familia_id: txt(f.familia_id),
    rendimiento: num(f.rendimiento),
    // ── desajuste de nombre: codigo en la base, _id en el frontend ──
    unidad_rendimiento_id: txt(f.unidad_rendimiento_codigo),
    merma_pct: num(f.merma_pct),
    desvio_pct: num(f.desvio_pct),
    costo_total: num(f.costo_total),
    costo_porcion: num(f.costo_porcion),
    food_cost: num(f.food_cost),
    precio_sugerido: num(f.precio_sugerido),
    precio_real: num(f.precio_real),
    margen_objetivo: num(f.margen_objetivo),
    iva: num(f.iva),
    activo: bool(f.activo),
    creado_en: txt(f.creado_en),
    actualizado_en: txt(f.actualizado_en),
    creado_por: txt(f.creado_por),
    actualizado_por: txt(f.actualizado_por),
  };
}

export function aIngrediente(f: Fila, nombreItem = ''): IngredienteReceta {
  return {
    id: txt(f.id),
    receta_id: txt(f.receta_id),
    tipo_item: (txt(f.tipo_item) === 'subreceta' ? 'subreceta' : 'insumo'),
    item_id: txt(f.item_id),
    cantidad: num(f.cantidad),
    // ── desajuste de nombre: unidad_codigo en la base, unidad_id en el frontend ──
    unidad_id: txt(f.unidad_codigo),
    merma_pct: num(f.merma_pct),
    costo_unitario: num(f.costo_unitario),
    costo_linea: num(f.costo_linea),
    orden: num(f.orden),
    nombre_item: nombreItem,
  };
}

export function aFamilia(f: Fila): Familia {
  return { id: txt(f.id), nombre: txt(f.nombre), tipo: txt(f.tipo), activo: bool(f.activo) };
}

export function aSubfamilia(f: Fila): Subfamilia {
  return {
    id: txt(f.id),
    familia_id: txt(f.familia_id),
    nombre: txt(f.nombre),
    tipo: txt(f.tipo),
    activo: bool(f.activo),
  };
}

export function aUnidad(f: Fila): Unidad {
  // `unidades_medida` se referencia por `codigo` en todo el esquema (no hay
  // columna id), así que el código hace de identificador para el frontend.
  return {
    id: txt(f.codigo),
    codigo: txt(f.codigo),
    nombre: txt(f.nombre),
    tipo: txt(f.tipo),
    activo: bool(f.activo),
  };
}

export function aFicha(f: Fila): FichaTecnica {
  return {
    id: txt(f.id),
    receta_id: txt(f.receta_id),
    descripcion: txt(f.descripcion),
    preparacion: txt(f.preparacion),
    emplatado: txt(f.emplatado),
    notas: txt(f.notas),
    foto_url: txt(f.foto_url),
    foto_id: txt(f.foto_id),
    tiempo_min: txt(f.tiempo_min),
    gramaje_porcion: txt(f.gramaje_porcion),
  };
}

export function aHistorialReceta(f: Fila): HistorialReceta {
  return {
    id: txt(f.id),
    receta_id: txt(f.receta_id),
    accion: txt(f.accion),
    usuario: txt(f.usuario),
    fecha: txt(f.fecha),
    nombre: txt(f.nombre),
    costo_total: num(f.costo_total),
    costo_porcion: num(f.costo_porcion),
    food_cost: num(f.food_cost),
    precio_real: num(f.precio_real),
    cambios: txt(f.cambios),
    version: num(f.version),
    origen: txt(f.origen),
  };
}

export function aHistorialInsumo(f: Fila): HistorialInsumo {
  return {
    id: txt(f.id),
    insumo_id: txt(f.insumo_id),
    coste: num(f.coste),
    fecha: txt(f.fecha),
    usuario_id: txt(f.usuario_id),
    coste_anterior: num(f.coste_anterior),
    diferencia: num(f.diferencia),
    motivo: txt(f.motivo),
  };
}

export function aCatalogoInsumo(f: Fila, nombreSubfamilia = ''): CatalogoItem {
  return {
    id: txt(f.id),
    tipo_item: 'insumo',
    articulo: txt(f.articulo),
    unidad: txt(f.unidad),
    subfamilia: nombreSubfamilia,
    subfamilia_id: txt(f.subfamilia_id),
    coste: num(f.coste),
  };
}

export function aCatalogoSubreceta(f: Fila, articuloPuente: string, unidad: string): CatalogoItem {
  // EL PUENTE: una subreceta se ofrece en el catálogo con el nombre y el costo
  // del insumo maestro al que empuja su costo calculado (ver README, módulo
  // Subrecetas). Por eso se toma `articulo` del insumo puente, no de la
  // subreceta.
  return {
    id: txt(f.id),
    tipo_item: 'subreceta',
    articulo: articuloPuente || txt(f.nombre),
    unidad,
    subfamilia: '',
    subfamilia_id: '',
    coste: num(f.costo_porcion) || num(f.costo_total),
    rendimiento: num(f.rendimiento),
    unidad_rendimiento_id: txt(f.unidad_rendimiento_codigo),
  };
}

// ── Traductor inverso: tipo del frontend → fila para escribir ───────────────

/**
 * Convierte un `Partial<Receta>` del frontend en columnas de Supabase.
 * Solo incluye las claves presentes, para que un update parcial no borre
 * campos que el formulario no envió.
 */
export function deReceta(data: Partial<Receta>): Fila {
  const f: Fila = {};
  const copiar = <K extends keyof Receta>(k: K, col = k as string) => {
    if (data[k] !== undefined) f[col] = data[k];
  };
  copiar('nombre');
  copiar('familia_id');
  copiar('rendimiento');
  copiar('unidad_rendimiento_id', 'unidad_rendimiento_codigo'); // ← renombre
  copiar('merma_pct');
  copiar('desvio_pct');
  copiar('costo_total');
  copiar('costo_porcion');
  copiar('food_cost');
  copiar('precio_sugerido');
  copiar('precio_real');
  copiar('margen_objetivo');
  copiar('iva');
  copiar('activo');
  copiar('actualizado_por');
  return f;
}

/** Convierte un ingrediente del frontend en fila de `ingredientes_receta`. */
export function deIngrediente(g: Partial<IngredienteReceta>, recetaId: string, marcaId: string): Fila {
  return {
    marca_id: marcaId,
    receta_id: recetaId,
    tipo_item: g.tipo_item || 'insumo',
    item_id: g.item_id,
    cantidad: num(g.cantidad),
    unidad_codigo: g.unidad_id, // ← renombre
    merma_pct: num(g.merma_pct),
    costo_unitario: num(g.costo_unitario),
    costo_linea: num(g.costo_linea),
    orden: num(g.orden),
  };
}
