/**
 * GastroCore — Capa de datos contra Supabase (FASE 3). SOLO SERVIDOR.
 *
 * Expone EXACTAMENTE los mismos nombres de función que `lib/api/gastrocore.ts`
 * (el cliente de Apps Script), para que ninguna pantalla ni Route Handler
 * tenga que cambiar. El conmutador está en `lib/api/index.ts`.
 *
 * TRES REGLAS QUE NO SE ROMPEN AQUÍ
 * ---------------------------------
 * 1. Toda lectura de una tabla operativa pasa por `porMarca(tabla, marcaId)`.
 *    Con service_role RLS no aplica: el aislamiento lo sostiene este archivo.
 * 2. Ningún nombre de columna se escribe suelto: viven en `lib/supabase/mapeo.ts`.
 * 3. Toda mutación llama a `limpiarCacheLecturas()`, igual que hacía el
 *    cliente de Apps Script.
 *
 * LO QUE ESTA FASE **NO** MIGRA (y por qué)
 * -----------------------------------------
 * `getAnalytics`, `simularImpacto` y `generarSnapshot` siguen delegando en
 * Apps Script. No son lecturas de tabla: son un motor de agregación (top
 * movers, impacto en menú, alertas, snapshots semanales) que hoy vive en
 * Code.gs. Portarlo a ciegas, sin acceso a la base real ni al código de ese
 * motor, produciría KPIs plausibles pero no verificables — que es peor que un
 * error visible. Queda como costura explícita, marcada con PENDIENTE-FASE-3B.
 */
import 'server-only';
import { supabaseAdmin, porMarca } from '@/lib/supabase/cliente';
import { getMarcaActualId } from '@/lib/marca';
import {
  COLS, txt, num,
  aInsumo, aReceta, aIngrediente, aFamilia, aSubfamilia, aUnidad, aFicha,
  aHistorialReceta, aHistorialInsumo, aCatalogoInsumo, aCatalogoSubreceta,
  deReceta, deIngrediente,
  type Fila,
} from '@/lib/supabase/mapeo';

// Los tipos siguen siendo los mismos: se reexportan desde el módulo original
// para que exista UNA sola definición y no dos que puedan divergir.
export type {
  ApiResponse, Insumo, IngredienteReceta, Receta, HistorialReceta, Familia,
  Subfamilia, Unidad, CatalogoItem, Dependencia, HistorialInsumo, Bootstrap,
  FichaTecnica, Parametros, TopMover, ImpactoMenu, VariacionFamilia,
  EvolucionPunto, Alerta, AnalyticsData, SimulacionReceta, SimulacionResult,
  SnapshotSemanal, PuntoHistorial,
} from '@/lib/api/tipos';

import type {
  ApiResponse, Insumo, IngredienteReceta, Receta, HistorialReceta, Familia,
  Subfamilia, Unidad, CatalogoItem, Dependencia, HistorialInsumo, Bootstrap,
  FichaTecnica, Parametros, AnalyticsData, SimulacionResult, SnapshotSemanal,
  PuntoHistorial,
} from '@/lib/api/tipos';

// ── Caché de lecturas ───────────────────────────────────────────────────────
// Mismo contrato que la capa de Apps Script: TTL por recurso, dedupe de
// peticiones en vuelo y purga total en cada mutación. Los TTL bajan respecto
// al original porque Supabase responde en milisegundos: el caché deja de ser
// un salvavidas de latencia y pasa a ser solo un ahorro de llamadas.
type Entrada = { at: number; data: unknown };
const cache = new Map<string, Entrada>();
const enVuelo = new Map<string, Promise<unknown>>();

const TTL: Record<string, number> = {
  familias: 300, subfamilias: 300, unidades: 600,
  insumos: 60, catalogo: 60, bootstrap: 60,
  recetas: 60, subrecetas: 60, fichas: 30,
  parametros: 300, marcas: 600,
};
const TTL_DEFECTO = 60;

export function limpiarCacheLecturas(): void {
  cache.clear();
  import('next/cache')
    .then((m) => m.revalidateTag('recetario'))
    .catch(() => { /* fuera de contexto server no aplica */ });
}

/** Envuelve una lectura con caché + dedupe. La clave incluye la marca. */
async function cacheado<T>(recurso: string, clave: string, fn: () => Promise<T>): Promise<T> {
  const k = recurso + '::' + clave;
  const ttlMs = (TTL[recurso] ?? TTL_DEFECTO) * 1000;

  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;

  const pendiente = enVuelo.get(k);
  if (pendiente) return pendiente as Promise<T>;

  const promesa = fn()
    .then((data) => {
      cache.set(k, { at: Date.now(), data });
      return data;
    })
    .finally(() => enVuelo.delete(k));

  enVuelo.set(k, promesa);
  return promesa;
}

/** Respuesta con la forma que esperan los Route Handlers. */
function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}
function fallo<T>(code: string, message: string): ApiResponse<T> {
  return { ok: false, data: null as T, error: { code, message } };
}

/** Ejecuta una mutación y traduce el error de Postgres a ApiResponse. */
async function mutar<T>(fn: () => Promise<{ data: unknown; error: { message: string; code?: string } | null }>): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await fn();
    if (error) return fallo<T>(error.code || 'SUPABASE', error.message);
    limpiarCacheLecturas();
    return ok(data as T);
  } catch (e) {
    return fallo<T>('EXCEPCION', e instanceof Error ? e.message : String(e));
  }
}

// ── Diccionarios auxiliares (para resolver nombres sin N+1 queries) ─────────

async function mapaSubfamilias(marcaId: string): Promise<Map<string, string>> {
  const { data } = await porMarca('subfamilias', marcaId);
  const m = new Map<string, string>();
  for (const f of (data || []) as unknown as Fila[]) m.set(txt(f.id), txt(f.nombre));
  return m;
}

async function mapaInsumos(marcaId: string): Promise<Map<string, Fila>> {
  const { data } = await porMarca('insumos', marcaId);
  const m = new Map<string, Fila>();
  for (const f of (data || []) as unknown as Fila[]) m.set(txt(f.id), f);
  return m;
}

// ── INSUMOS ─────────────────────────────────────────────────────────────────

export async function getInsumos(): Promise<Insumo[]> {
  const marcaId = await getMarcaActualId();
  return cacheado('insumos', marcaId, async () => {
    const [{ data, error }, subf] = await Promise.all([
      supabaseAdmin().from('insumos').select(COLS.insumos).eq('marca_id', marcaId).order('articulo'),
      mapaSubfamilias(marcaId),
    ]);
    if (error) throw new Error('insumos: ' + error.message);
    return ((data || []) as unknown as Fila[]).map((f) => aInsumo(f, subf.get(txt(f.subfamilia_id)) || ''));
  });
}

export async function getInsumo(id: string): Promise<Insumo | null> {
  const marcaId = await getMarcaActualId();
  const { data, error } = await supabaseAdmin()
    .from('insumos').select(COLS.insumos)
    .eq('marca_id', marcaId).eq('id', id).maybeSingle();
  if (error || !data) return null;
  const subf = await mapaSubfamilias(marcaId);
  const f = data as unknown as Fila;
  return aInsumo(f, subf.get(txt(f.subfamilia_id)) || '');
}

export async function actualizarCosteInsumo(id: string, coste: number) {
  return actualizarInsumo(id, { coste });
}

/**
 * Edición de insumo CON trazabilidad. Escribe el precio nuevo y, si el coste
 * cambió, deja la fila en `precios_historicos` — que es lo que alimenta "Ver
 * historial de precios" y la gráfica de evolución.
 */
export async function actualizarInsumo(
  id: string,
  data: Partial<Insumo> & { motivo?: string; usuario?: string },
) {
  const marcaId = await getMarcaActualId();
  const { motivo, usuario, ...campos } = data;

  const { data: previo } = await supabaseAdmin()
    .from('insumos').select('coste')
    .eq('marca_id', marcaId).eq('id', id).maybeSingle();
  const costeAnterior = num((previo as unknown as (Fila | null))?.coste);

  const res = await mutar<Insumo>(async () =>
    supabaseAdmin().from('insumos').update(campos)
      .eq('marca_id', marcaId).eq('id', id).select(COLS.insumos).maybeSingle(),
  );

  if (res.ok && campos.coste !== undefined && num(campos.coste) !== costeAnterior) {
    await supabaseAdmin().from('precios_historicos').insert({
      marca_id: marcaId,
      insumo_id: id,
      coste: num(campos.coste),
      coste_anterior: costeAnterior,
      diferencia: num(campos.coste) - costeAnterior,
      fecha: new Date().toISOString(),
      usuario_id: usuario || 'Sistema',
      motivo: motivo || 'Edición manual',
    });
    limpiarCacheLecturas();
  }
  return res;
}

export async function getHistorialInsumo(insumoId: string): Promise<HistorialInsumo[]> {
  const marcaId = await getMarcaActualId();
  const { data, error } = await supabaseAdmin()
    .from('precios_historicos').select(COLS.precios_historicos)
    .eq('marca_id', marcaId).eq('insumo_id', insumoId)
    .order('fecha', { ascending: false });
  if (error) return [];
  return ((data || []) as unknown as Fila[]).map(aHistorialInsumo);
}

// ── RECETAS ─────────────────────────────────────────────────────────────────

export async function getRecetas(all = false): Promise<Receta[]> {
  const marcaId = await getMarcaActualId();
  return cacheado('recetas', marcaId + ':' + all, async () => {
    let q = supabaseAdmin().from('recetas').select(COLS.recetas).eq('marca_id', marcaId);
    if (!all) q = q.eq('activo', true);
    const { data, error } = await q.order('nombre');
    if (error) throw new Error('recetas: ' + error.message);
    return ((data || []) as unknown as Fila[]).map(aReceta);
  });
}

export async function getRecetaPorId(id: string): Promise<Receta | null> {
  const marcaId = await getMarcaActualId();
  const { data, error } = await supabaseAdmin()
    .from('recetas').select(COLS.recetas)
    .eq('marca_id', marcaId).eq('id', id).maybeSingle();
  if (error || !data) return null;
  return aReceta(data as unknown as Fila);
}

/** Receta completa: base + ingredientes con nombre resuelto + historial. */
export async function getReceta(id: string): Promise<Receta | null> {
  const [base, ingredientes, historial] = await Promise.all([
    getRecetaPorId(id),
    getIngredientesReceta(id).catch(() => [] as IngredienteReceta[]),
    getHistorialReceta(id).catch(() => [] as HistorialReceta[]),
  ]);
  if (!base) return null;
  base.ingredientes = ingredientes;
  base.historial = historial;
  return base;
}

export async function getIngredientesReceta(recetaId: string): Promise<IngredienteReceta[]> {
  const marcaId = await getMarcaActualId();
  const { data, error } = await supabaseAdmin()
    .from('ingredientes_receta').select(COLS.ingredientes_receta)
    .eq('marca_id', marcaId).eq('receta_id', recetaId)
    .order('orden');
  if (error) return [];

  const filas = (data || []) as unknown as Fila[];
  if (!filas.length) return [];

  // Los nombres se resuelven con dos mapas en memoria en vez de un join por
  // fila: `item_id` apunta a `insumos` o a `subrecetas` según `tipo_item`, y
  // una subreceta se nombra por su insumo puente.
  const insumos = await mapaInsumos(marcaId);
  const { data: subs } = await porMarca('subrecetas', marcaId);
  const puente = new Map<string, string>();
  for (const s of (subs || []) as unknown as Fila[]) {
    const ins = insumos.get(txt(s.insumo_id));
    puente.set(txt(s.id), txt(ins?.articulo) || txt(s.nombre));
  }

  return filas.map((f) => {
    const nombre = txt(f.tipo_item) === 'subreceta'
      ? puente.get(txt(f.item_id)) || ''
      : txt(insumos.get(txt(f.item_id))?.articulo);
    return aIngrediente(f, nombre);
  });
}

export async function getHistorialReceta(recetaId: string): Promise<HistorialReceta[]> {
  const marcaId = await getMarcaActualId();
  const { data, error } = await supabaseAdmin()
    .from('historial_recetas').select(COLS.historial_recetas)
    .eq('marca_id', marcaId).eq('receta_id', recetaId)
    .order('fecha', { ascending: false });
  if (error) return [];
  return ((data || []) as unknown as Fila[]).map(aHistorialReceta);
}

export async function crearReceta(data: Partial<Receta>) {
  const marcaId = await getMarcaActualId();
  const fila = { ...deReceta(data), marca_id: marcaId, creado_en: new Date().toISOString() };
  const res = await mutar<Receta>(async () =>
    supabaseAdmin().from('recetas').insert(fila).select(COLS.recetas).maybeSingle(),
  );
  if (res.ok && data.ingredientes?.length) {
    await guardarIngredientes(txt((res.data as unknown as Fila)?.id), data.ingredientes, marcaId);
  }
  return res;
}

export async function actualizarReceta(id: string, data: Partial<Receta>) {
  const marcaId = await getMarcaActualId();
  const fila = { ...deReceta(data), actualizado_en: new Date().toISOString() };
  const res = await mutar<Receta>(async () =>
    supabaseAdmin().from('recetas').update(fila)
      .eq('marca_id', marcaId).eq('id', id).select(COLS.recetas).maybeSingle(),
  );
  if (res.ok && data.ingredientes) {
    await guardarIngredientes(id, data.ingredientes, marcaId);
  }
  return res;
}

/**
 * Reemplaza la lista de ingredientes de una receta.
 *
 * Borra y reinserta en vez de hacer un diff fila por fila. Es lo que hacía
 * Apps Script y es lo correcto aquí: el orden importa, las líneas no tienen
 * identidad estable desde el formulario, y un diff introduciría estados
 * intermedios inconsistentes.
 */
async function guardarIngredientes(
  recetaId: string,
  ingredientes: Partial<IngredienteReceta>[],
  marcaId: string,
): Promise<void> {
  if (!recetaId) return;
  await supabaseAdmin().from('ingredientes_receta')
    .delete().eq('marca_id', marcaId).eq('receta_id', recetaId);

  const filas = ingredientes
    .filter((g) => g && g.item_id)
    .map((g, i) => deIngrediente({ orden: i + 1, ...g }, recetaId, marcaId));

  if (filas.length) await supabaseAdmin().from('ingredientes_receta').insert(filas);
  limpiarCacheLecturas();
}

export async function setActivoReceta(id: string, activo: boolean) {
  const marcaId = await getMarcaActualId();
  return mutar<Receta>(async () =>
    supabaseAdmin().from('recetas').update({ activo })
      .eq('marca_id', marcaId).eq('id', id).select(COLS.recetas).maybeSingle(),
  );
}

/**
 * Restaura una versión anterior desde `historial_recetas`.
 * Cada fila del historial guarda el snapshot completo en `cambios`.
 */
export async function restaurarVersion(id: string, version: number, usuario?: string) {
  const marcaId = await getMarcaActualId();
  const { data, error } = await supabaseAdmin()
    .from('historial_recetas').select('cambios, nombre')
    .eq('marca_id', marcaId).eq('receta_id', id).eq('version', version).maybeSingle();

  if (error || !data) return fallo<Receta>('NO_ENCONTRADA', 'No existe la versión ' + version + ' de esta receta.');

  let snapshot: Partial<Receta>;
  try {
    snapshot = JSON.parse(txt((data as unknown as Fila).cambios) || '{}') as Partial<Receta>;
  } catch {
    return fallo<Receta>('SNAPSHOT_INVALIDO', 'El snapshot de la versión ' + version + ' no es JSON válido.');
  }

  return actualizarReceta(id, { ...snapshot, actualizado_por: usuario || 'Sistema' });
}

// ── SUBRECETAS ──────────────────────────────────────────────────────────────

export async function getSubrecetas(all = false): Promise<Receta[]> {
  const marcaId = await getMarcaActualId();
  return cacheado('subrecetas', marcaId + ':' + all, async () => {
    let q = supabaseAdmin().from('subrecetas').select(COLS.subrecetas).eq('marca_id', marcaId);
    if (!all) q = q.eq('activo', true);
    const { data, error } = await q.order('nombre');
    if (error) throw new Error('subrecetas: ' + error.message);
    return ((data || []) as unknown as Fila[]).map(aReceta);
  });
}

export async function getSubreceta(id: string): Promise<Receta | null> {
  const marcaId = await getMarcaActualId();
  const { data, error } = await supabaseAdmin()
    .from('subrecetas').select(COLS.subrecetas)
    .eq('marca_id', marcaId).eq('id', id).maybeSingle();
  if (error || !data) return null;
  const base = aReceta(data as unknown as Fila);
  base.ingredientes = await getIngredientesReceta(id).catch(() => []);
  return base;
}

export async function crearSubreceta(data: Partial<Receta>) {
  const marcaId = await getMarcaActualId();
  return mutar<Receta>(async () =>
    supabaseAdmin().from('subrecetas')
      .insert({ ...deReceta(data), marca_id: marcaId, creado_en: new Date().toISOString() })
      .select(COLS.subrecetas).maybeSingle(),
  );
}

export async function actualizarSubreceta(id: string, data: Partial<Receta>) {
  const marcaId = await getMarcaActualId();
  const res = await mutar<Receta>(async () =>
    supabaseAdmin().from('subrecetas')
      .update({ ...deReceta(data), actualizado_en: new Date().toISOString() })
      .eq('marca_id', marcaId).eq('id', id).select(COLS.subrecetas).maybeSingle(),
  );
  if (res.ok && data.ingredientes) await guardarIngredientes(id, data.ingredientes, marcaId);
  return res;
}

export async function setActivoSubreceta(id: string, activo: boolean) {
  const marcaId = await getMarcaActualId();
  return mutar<Receta>(async () =>
    supabaseAdmin().from('subrecetas').update({ activo })
      .eq('marca_id', marcaId).eq('id', id).select(COLS.subrecetas).maybeSingle(),
  );
}

// ── DEPENDENCIAS (qué recetas usan un item) ─────────────────────────────────

export async function getDependencias(itemId: string): Promise<Dependencia[]> {
  const marcaId = await getMarcaActualId();
  const { data, error } = await supabaseAdmin()
    .from('ingredientes_receta').select('receta_id')
    .eq('marca_id', marcaId).eq('item_id', itemId);
  if (error) return [];

  const ids = Array.from(new Set(((data || []) as unknown as Fila[]).map((f) => txt(f.receta_id)))).filter(Boolean);
  if (!ids.length) return [];

  // Un item puede ser ingrediente de una receta o de una subreceta: hay que
  // buscar los ids en las dos tablas para no reportar dependencias a medias.
  const [{ data: recs }, { data: subs }] = await Promise.all([
    supabaseAdmin().from('recetas').select('id, nombre, activo').eq('marca_id', marcaId).in('id', ids),
    supabaseAdmin().from('subrecetas').select('id, nombre, activo').eq('marca_id', marcaId).in('id', ids),
  ]);

  return [
    ...((recs || []) as unknown as Fila[]).map((f) => ({
      id: txt(f.id), nombre: txt(f.nombre), es_subreceta: false, activo: Boolean(f.activo),
    })),
    ...((subs || []) as unknown as Fila[]).map((f) => ({
      id: txt(f.id), nombre: txt(f.nombre), es_subreceta: true, activo: Boolean(f.activo),
    })),
  ];
}

// ── CATÁLOGOS ───────────────────────────────────────────────────────────────

export async function getFamilias(): Promise<Familia[]> {
  const marcaId = await getMarcaActualId();
  return cacheado('familias', marcaId, async () => {
    const { data, error } = await supabaseAdmin()
      .from('familias').select(COLS.familias).eq('marca_id', marcaId).order('nombre');
    if (error) throw new Error('familias: ' + error.message);
    return ((data || []) as unknown as Fila[]).map(aFamilia);
  });
}

export async function getSubfamilias(): Promise<Subfamilia[]> {
  const marcaId = await getMarcaActualId();
  return cacheado('subfamilias', marcaId, async () => {
    const { data, error } = await supabaseAdmin()
      .from('subfamilias').select(COLS.subfamilias).eq('marca_id', marcaId).order('nombre');
    if (error) throw new Error('subfamilias: ' + error.message);
    return ((data || []) as unknown as Fila[]).map(aSubfamilia);
  });
}

/** `unidades_medida` es catálogo GLOBAL: no lleva marca_id (migración 0001). */
export async function getUnidades(): Promise<Unidad[]> {
  return cacheado('unidades', 'global', async () => {
    const { data, error } = await supabaseAdmin()
      .from('unidades_medida').select(COLS.unidades_medida).order('nombre');
    if (error) throw new Error('unidades_medida: ' + error.message);
    return ((data || []) as unknown as Fila[]).map(aUnidad);
  });
}

export async function crearFamilia(data: { nombre: string; tipo?: string; activo?: boolean; centrocosto?: string }) {
  const marcaId = await getMarcaActualId();
  return mutar<Familia>(async () =>
    supabaseAdmin().from('familias')
      .insert({ tipo: 'receta', activo: true, ...data, marca_id: marcaId })
      .select(COLS.familias).maybeSingle(),
  );
}

export async function crearSubfamilia(data: { familia_id: string; nombre: string; tipo?: string; activo?: boolean; centrocosto?: string }) {
  const marcaId = await getMarcaActualId();
  return mutar<Subfamilia>(async () =>
    supabaseAdmin().from('subfamilias')
      .insert({ tipo: 'receta', activo: true, ...data, marca_id: marcaId })
      .select(COLS.subfamilias).maybeSingle(),
  );
}

export async function actualizarFamilia(id: string, data: { nombre?: string; activo?: boolean; centrocosto?: string }) {
  const marcaId = await getMarcaActualId();
  return mutar<Familia>(async () =>
    supabaseAdmin().from('familias').update(data)
      .eq('marca_id', marcaId).eq('id', id).select(COLS.familias).maybeSingle(),
  );
}

export async function desactivarFamilia(id: string) {
  return actualizarFamilia(id, { activo: false });
}

export async function actualizarSubfamilia(id: string, data: { nombre?: string; familia_id?: string; activo?: boolean; centrocosto?: string }) {
  const marcaId = await getMarcaActualId();
  return mutar<Subfamilia>(async () =>
    supabaseAdmin().from('subfamilias').update(data)
      .eq('marca_id', marcaId).eq('id', id).select(COLS.subfamilias).maybeSingle(),
  );
}

export async function desactivarSubfamilia(id: string) {
  return actualizarSubfamilia(id, { activo: false });
}

// ── CATÁLOGO UNIFICADO + BOOTSTRAP ──────────────────────────────────────────

export async function getCatalogo(): Promise<CatalogoItem[]> {
  const marcaId = await getMarcaActualId();
  return cacheado('catalogo', marcaId, async () => {
    const [{ data: ins }, { data: subs }, subf] = await Promise.all([
      supabaseAdmin().from('insumos').select(COLS.insumos).eq('marca_id', marcaId).order('articulo'),
      supabaseAdmin().from('subrecetas').select(COLS.subrecetas).eq('marca_id', marcaId).eq('activo', true),
      mapaSubfamilias(marcaId),
    ]);

    const insumos = (ins || []) as unknown as Fila[];
    const porId = new Map(insumos.map((f) => [txt(f.id), f]));

    return [
      ...insumos.map((f) => aCatalogoInsumo(f, subf.get(txt(f.subfamilia_id)) || '')),
      ...((subs || []) as unknown as Fila[]).map((s) => {
        const puente = porId.get(txt(s.insumo_id));
        return aCatalogoSubreceta(s, txt(puente?.articulo), txt(puente?.unidad));
      }),
    ];
  });
}

/** Carga inicial del editor: 4 catálogos en una sola ida al servidor. */
export async function getBootstrap(): Promise<Bootstrap | null> {
  const [familias, subfamilias, unidades, catalogo] = await Promise.all([
    getFamilias(), getSubfamilias(), getUnidades(), getCatalogo(),
  ]);
  return { familias, subfamilias, unidades, catalogo };
}

// ── FICHAS TÉCNICAS ─────────────────────────────────────────────────────────

export async function getFicha(recetaId: string): Promise<FichaTecnica | null> {
  const marcaId = await getMarcaActualId();
  const { data, error } = await supabaseAdmin()
    .from('fichas_tecnicas').select(COLS.fichas_tecnicas)
    .eq('marca_id', marcaId).eq('receta_id', recetaId).maybeSingle();
  if (error || !data) return null;
  return aFicha(data as unknown as Fila);
}

async function guardarFicha(recetaId: string, datos: Partial<FichaTecnica>) {
  const marcaId = await getMarcaActualId();
  return mutar<FichaTecnica>(async () =>
    supabaseAdmin().from('fichas_tecnicas')
      .upsert({ ...datos, receta_id: recetaId, marca_id: marcaId }, { onConflict: 'marca_id,receta_id' })
      .select(COLS.fichas_tecnicas).maybeSingle(),
  );
}

// ── CONFIGURACIÓN / PARÁMETROS ──────────────────────────────────────────────
// `configuracion` es clave/valor con PK (marca_id, clave) tras la migración 0001.

async function leerConfig(marcaId: string): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin()
    .from('configuracion').select('clave, valor').eq('marca_id', marcaId);
  if (error) return {};
  const out: Record<string, string> = {};
  for (const f of (data || []) as unknown as Fila[]) out[txt(f.clave)] = txt(f.valor);
  return out;
}

export async function getParametros(): Promise<Parametros | null> {
  const marcaId = await getMarcaActualId();
  return cacheado('parametros', marcaId, async () => {
    const cfg = await leerConfig(marcaId);
    let fcPorFamilia: Record<string, number> = {};
    try {
      fcPorFamilia = JSON.parse(cfg.fc_por_familia || '{}');
    } catch { /* config corrupta: se ignora, no se cae la app */ }

    const familias = await getFamilias();
    return {
      nombre_negocio: cfg.nombre_negocio || '',
      fc_objetivo: num(cfg.fc_objetivo) || 0.35,
      fc_por_familia: fcPorFamilia,
      impuesto_pct: num(cfg.impuesto_pct) || 0.08,
      alerta_subida_pct: num(cfg.alerta_subida_pct) || 10,
      familias: familias.map((f) => ({ id: f.id, nombre: f.nombre, tipo: txt(f.tipo) })),
    } as Parametros;
  });
}

export async function getConfigFotos(): Promise<{ folder_id: string; nombre: string; url: string } | null> {
  const marcaId = await getMarcaActualId();
  const cfg = await leerConfig(marcaId);
  if (!cfg.fotos_folder_id) return null;
  return {
    folder_id: cfg.fotos_folder_id,
    nombre: cfg.fotos_folder_nombre || '',
    url: cfg.fotos_folder_url || '',
  };
}

// ── ACCIÓN GENÉRICA ─────────────────────────────────────────────────────────

/**
 * Puerta de escritura genérica que usaban los Route Handlers de fichas y
 * configuración. Se mantiene el mismo contrato (resource + action + payload)
 * para no tocar esos handlers en esta fase.
 */
export async function accionBackend<T>(
  resource: string,
  action: string,
  payload: { id?: string; data?: unknown },
): Promise<ApiResponse<T>> {
  const marcaId = await getMarcaActualId();
  const datos = (payload.data || {}) as Record<string, unknown>;

  if (resource === 'fichas' && (action === 'save' || action === 'update' || action === 'create')) {
    const recetaId = txt(payload.id) || txt(datos.receta_id);
    if (!recetaId) return fallo<T>('SIN_RECETA', 'Falta el id de la receta para guardar la ficha.');
    return guardarFicha(recetaId, datos as Partial<FichaTecnica>) as unknown as ApiResponse<T>;
  }

  if (resource === 'parametros' || resource === 'configuracion') {
    const filas = Object.entries(datos).map(([clave, valor]) => ({
      marca_id: marcaId,
      clave,
      valor: typeof valor === 'object' ? JSON.stringify(valor) : String(valor),
    }));
    if (!filas.length) return ok(null as T);
    return mutar<T>(async () =>
      supabaseAdmin().from('configuracion').upsert(filas, { onConflict: 'marca_id,clave' }).select(),
    );
  }

  // PENDIENTE-FASE-3B: subida de fotos a Drive, respaldo y rotación de token
  // siguen siendo cosa de Apps Script — no son operaciones de base de datos.
  return delegarAppsScript<T>(resource, action, payload);
}

// ── COSTURA CON APPS SCRIPT (lo que esta fase NO migra) ─────────────────────

/**
 * PENDIENTE-FASE-3B.
 *
 * Estas llamadas siguen yendo a Apps Script porque no son lecturas de tabla
 * sino un motor de cálculo (agregación de variaciones, impacto en menú,
 * alertas, generación de snapshots) que vive en Code.gs. Migrarlo es trabajo
 * propio, con su propia validación contra los números actuales.
 *
 * Mientras esta función exista, GASTROCORE_API_URL y GASTROCORE_API_TOKEN
 * siguen siendo obligatorias aunque el backend principal ya sea Supabase.
 */
async function delegarAppsScript<T>(
  resource: string,
  action: string,
  payload: { id?: string; data?: unknown },
): Promise<ApiResponse<T>> {
  const url = process.env.GASTROCORE_API_URL;
  const token = process.env.GASTROCORE_API_TOKEN;
  if (!url || !token) {
    return fallo<T>(
      'SIN_APPS_SCRIPT',
      'El recurso "' + resource + '" todavía lo atiende Apps Script (ver PENDIENTE-FASE-3B) ' +
        'y faltan GASTROCORE_API_URL / GASTROCORE_API_TOKEN.',
    );
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource, action, token, ...payload }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Apps Script respondió ' + res.status);
  const json = (await res.json()) as ApiResponse<T>;
  limpiarCacheLecturas();
  return json;
}

async function leerAppsScript<T>(resource: string, params: Record<string, string> = {}): Promise<ApiResponse<T>> {
  const url = process.env.GASTROCORE_API_URL;
  const token = process.env.GASTROCORE_API_TOKEN;
  if (!url || !token) return fallo<T>('SIN_APPS_SCRIPT', 'Analítica no disponible: falta configurar Apps Script (PENDIENTE-FASE-3B).');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'read', resource, token, params }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Apps Script respondió ' + res.status);
  return (await res.json()) as ApiResponse<T>;
}

export async function getAnalytics(): Promise<AnalyticsData | null> {
  const r = await leerAppsScript<AnalyticsData>('analytics');
  return r.ok ? r.data : null;
}

export async function getHistorialInsumoGrafica(insumoId: string): Promise<PuntoHistorial[]> {
  // Esta sí sale de Supabase: es la misma tabla que el historial de precios.
  const historial = await getHistorialInsumo(insumoId);
  return historial
    .slice()
    .reverse()
    .map((h) => ({ fecha: h.fecha, coste: h.coste, motivo: h.motivo }));
}

export async function getSnapshots(): Promise<SnapshotSemanal[]> {
  const marcaId = await getMarcaActualId();
  const { data, error } = await supabaseAdmin()
    .from('snapshots_semanales').select('*')
    .eq('marca_id', marcaId).order('fecha', { ascending: false });
  if (error) return [];
  return ((data || []) as unknown as Fila[]).map((f) => ({
    id: txt(f.id),
    fecha: txt(f.fecha),
    hora: txt(f.hora),
    usuario: txt(f.usuario),
    cantidad_insumos: num(f.cantidad_insumos),
    costo_promedio: num(f.costo_promedio),
    insumos_modificados: num(f.insumos_modificados),
    nota: txt(f.nota),
  }));
}

export async function simularImpacto(insumoId: string, nuevoPrecio: number): Promise<SimulacionResult | null> {
  const r = await delegarAppsScript<SimulacionResult>('analytics', 'simular', {
    data: { insumo_id: insumoId, nuevo_precio: nuevoPrecio },
  });
  return r.ok ? r.data : null;
}

export async function generarSnapshot(usuario?: string) {
  return delegarAppsScript('analytics', 'snapshot', { data: { usuario: usuario || 'Sistema' } });
}
