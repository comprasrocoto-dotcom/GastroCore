/**
 * GastroCore — Cliente de la API de Google Apps Script.
 *
 * IMPORTANTE (seguridad): este modulo SOLO debe ejecutarse en el servidor
 * (Server Components, Route Handlers). El token nunca se envia al navegador.
 */
// server-only

const API_URL = process.env.GASTROCORE_API_URL;
const API_TOKEN = process.env.GASTROCORE_API_TOKEN;

export type ApiResponse<T> = {
  ok: boolean;
  data: T;
  meta?: { count?: number };
  error?: { code: string; message: string };
};

export type Insumo = {
  id: string;
  referencia: string;
  articulo: string;
  unidad: string;
  subfamilia: string;
  subfamilia_id: string;
  coste: number;
};

export type IngredienteReceta = {
  id?: string;
  receta_id?: string;
  tipo_item: 'insumo' | 'subreceta';
  item_id: string;
  cantidad: number;
  unidad_id: string;
  merma_pct: number;
  costo_unitario?: number;
  costo_linea?: number;
  orden?: number;
  nombre_item?: string;
};

export type Receta = {
  id: string;
  nombre: string;
  familia_id: string; // v9.4: las recetas clasifican por familia directa
  rendimiento: number;
  unidad_rendimiento_id: string;
  merma_pct: number;
  desvio_pct: number;
  costo_total: number;
  costo_porcion: number;
  food_cost: number;
  precio_sugerido: number;
  precio_real: number;
  margen_objetivo: number;
  iva?: number;
  activo: boolean | string;
  creado_en?: string;
  actualizado_en?: string;
  creado_por?: string;
  actualizado_por?: string;
  ingredientes?: IngredienteReceta[];
  historial?: HistorialReceta[];
};

export type HistorialReceta = {
  id: string;
  receta_id: string;
  accion: string;
  usuario: string;
  fecha: string;
  nombre: string;
  costo_total: number;
  costo_porcion: number;
  food_cost: number;
  precio_real: number;
  cambios: string;
  version?: number;
  origen?: string;
  campo?: string;
  valor_anterior?: string | number;
  valor_nuevo?: string | number;
  observaciones?: string;
  snapshot?: string;
};

export type Familia = { id: string; nombre: string; tipo?: string; activo: boolean | string };
export type Subfamilia = { id: string; familia_id: string; nombre: string; tipo?: string; activo: boolean | string };
export type Unidad = { id: string; codigo: string; nombre: string; tipo: string; activo: boolean | string };

// Item unificado del catalogo de ingredientes (insumo o subreceta).
export type CatalogoItem = {
  id: string;
  tipo_item: 'insumo' | 'subreceta';
  articulo: string;
  unidad: string;
  subfamilia: string;
  subfamilia_id: string;
  coste: number;
  rendimiento?: number;
  unidad_rendimiento_id?: string;
};

export type Dependencia = { id: string; nombre: string; es_subreceta: boolean; activo: boolean | string };

export type HistorialInsumo = {
  id: string;
  insumo_id: string;
  coste: number;
  fecha: string;
  usuario_id: string;
  coste_anterior: number;
  diferencia: number;
  motivo: string;
};

function assertConfig(): void {
  if (!API_URL || !API_TOKEN) {
    throw new Error('Faltan GASTROCORE_API_URL o GASTROCORE_API_TOKEN en las variables de entorno.');
  }
}

// ── Caché de lecturas (v7) ──────────────────────────────────────────────────
// TTL DIFERENCIADO por recurso + STALE-WHILE-REVALIDATE: dentro del TTL se
// responde de memoria; vencido el TTL (pero dentro de la ventana de gracia)
// se responde AL INSTANTE con el dato viejo y se refresca en segundo plano.
// Solo la primera visita en frío espera a Apps Script. Vive por instancia de
// Vercel; el CacheService del backend (v7) cubre los arranques en frío.
type CacheEntry = { at: number; data: unknown };
const readCache = new Map<string, CacheEntry>();
const enVuelo = new Map<string, Promise<unknown>>(); // dedupe de peticiones simultáneas

// Segundos de frescura por recurso. Catálogos casi estáticos: largos;
// datos operativos: cortos. Cualquier mutación borra TODO el caché igual.
const TTL_POR_RECURSO: Record<string, number> = {
  familias: 300, subfamilias: 300, unidades: 300,
  insumos: 120, catalogo: 120, bootstrap: 120,
  analytics: 120, snapshots: 120,
  recetas: 45, subrecetas: 45,
  fichas: 20, historialRecetas: 30, ingredientes: 30, configfotos: 600, parametros: 300,
};
const TTL_DEFAULT = 30;
const VENTANA_GRACIA_MS = 10 * 60 * 1000; // hasta 10 min sirviendo viejo mientras refresca

/** Borra todo el caché de lecturas (se llama tras cada mutación). */
export function limpiarCacheLecturas(): void {
  readCache.clear();
}

async function descargar<T>(
  cacheKey: string,
  resource: string,
  params: Record<string, string>
): Promise<ApiResponse<T>> {
  // Dedupe: si ya hay una petición idéntica en vuelo, únete a ella.
  const pendiente = enVuelo.get(cacheKey);
  if (pendiente) return pendiente as Promise<ApiResponse<T>>;

  const promesa = (async () => {
    const res = await fetch(API_URL as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'read', resource, token: API_TOKEN, params }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Error de red al consultar la API: ' + res.status);
    const json = (await res.json()) as ApiResponse<T>;
    // CRITICO: solo se cachean respuestas EXITOSAS. Cachear un error (p. ej.
    // durante la ventana de redespliegue de Apps Script) lo dejaria "pegado"
    // y el stale-while-revalidate lo serviria una y otra vez.
    if (json && json.ok) {
      readCache.set(cacheKey, { at: Date.now(), data: json });
    }
    return json;
  })().finally(() => enVuelo.delete(cacheKey));

  enVuelo.set(cacheKey, promesa);
  return promesa;
}

/**
 * Lectura de datos. IMPORTANTE (seguridad): el token viaja SIEMPRE en el body
 * de un POST, nunca en la query string de la URL. Esto evita que el secreto
 * quede registrado en logs de red, de Vercel o de intermediarios.
 *
 * Requiere que el backend de Apps Script maneje `mode: 'read'` en doPost
 * (ver README, sección "Backend: lectura por POST").
 */
async function apiGet<T>(
  resource: string,
  params: Record<string, string> = {},
  ttlSeconds?: number
): Promise<ApiResponse<T>> {
  assertConfig();

  const ttlMs = (ttlSeconds ?? TTL_POR_RECURSO[resource] ?? TTL_DEFAULT) * 1000;
  const cacheKey = resource + '::' + JSON.stringify(params);
  let hit = readCache.get(cacheKey);
  // Defensa extra: si algo invalido llego al cache, se descarta.
  if (hit && !(hit.data as ApiResponse<unknown>)?.ok) {
    readCache.delete(cacheKey);
    hit = undefined;
  }
  const edad = hit ? Date.now() - hit.at : Infinity;

  // Fresco: directo de memoria (0 ms).
  if (hit && edad < ttlMs) return hit.data as ApiResponse<T>;

  // Vencido pero dentro de la gracia: responder YA con lo viejo y refrescar
  // en segundo plano (mejor esfuerzo: si la instancia se congela antes de
  // terminar, la próxima petición lo refresca — y el caché compartido del
  // backend v7 hace que ese refresco cueste <1s).
  if (hit && edad < VENTANA_GRACIA_MS) {
    void descargar<T>(cacheKey, resource, params).catch(() => {});
    return hit.data as ApiResponse<T>;
  }

  // Frío o demasiado viejo: hay que esperar. Si la red falla y existe un dato
  // viejo, mejor servir eso que reventar la página.
  try {
    return await descargar<T>(cacheKey, resource, params);
  } catch (err) {
    if (hit) return hit.data as ApiResponse<T>;
    throw err;
  }
}

async function apiPost<T>(
  resource: string,
  action: 'create' | 'update' | 'delete' | 'setActivo',
  payload: { id?: string; data?: unknown }
): Promise<ApiResponse<T>> {
  assertConfig();
  const res = await fetch(API_URL as string, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource, action, token: API_TOKEN, ...payload }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Error de red al escribir en la API: ' + res.status);
  const json = (await res.json()) as ApiResponse<T>;
  limpiarCacheLecturas(); // los datos cambiaron: la próxima lectura trae lo nuevo
  return json;
}

// ---------- INSUMOS ----------
export async function getInsumos(): Promise<Insumo[]> {
  const r = await apiGet<Insumo[]>('insumos');
  return r.ok ? r.data : [];
}
export async function getInsumo(id: string): Promise<Insumo | null> {
  const r = await apiGet<Insumo>('insumos', { id });
  return r.ok ? r.data : null;
}
export async function actualizarCosteInsumo(id: string, coste: number) {
  return apiPost<Insumo>('insumos', 'update', { id, data: { coste } });
}

// ---------- RECETAS ----------
export async function getRecetas(all = false): Promise<Receta[]> {
  const r = await apiGet<Receta[]>('recetas', all ? { all: 'true' } : {});
  return r.ok ? r.data : [];
}

export async function getReceta(id: string): Promise<Receta | null> {
  // v7.3: el backend getById ya devuelve la receta CON sus ingredientes y los
  // nombres resueltos, y el historial llega filtrado y SIN los snapshots
  // pesados. Antes: 4 descargas de tablas completas; ahora: 2 llamadas finas.
  const [r, historial] = await Promise.all([
    apiGet<Receta>('recetas', { id }),
    getHistorialReceta(id).catch(() => []),
  ]);
  if (!r.ok || !r.data) return null;
  const receta = r.data;
  receta.historial = historial;
  return receta;
}

/** Receta puntual SIN historial (para pantallas que solo necesitan la base). */
export async function getRecetaPorId(id: string): Promise<Receta | null> {
  const r = await apiGet<Receta>('recetas', { id });
  return r.ok ? r.data : null;
}

export async function getHistorialReceta(recetaId: string): Promise<HistorialReceta[]> {
  const r = await apiGet<HistorialReceta[]>('historialRecetas', { receta_id: recetaId });
  const arr = r.ok && Array.isArray(r.data) ? r.data : [];
  return arr
    .filter((h) => String(h.receta_id) === String(recetaId))
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}

export async function getIngredientesReceta(recetaId: string): Promise<IngredienteReceta[]> {
  const r = await apiGet<IngredienteReceta[]>('ingredientes', { receta_id: recetaId });
  const arr = r.ok && Array.isArray(r.data) ? r.data : [];
  return arr.filter((g) => !recetaId || g.receta_id === recetaId);
}

export async function crearReceta(data: Partial<Receta>) {
  return apiPost<Receta>('recetas', 'create', { data });
}
export async function actualizarReceta(id: string, data: Partial<Receta>) {
  return apiPost<Receta>('recetas', 'update', { id, data });
}

export async function setActivoReceta(id: string, activo: boolean) {
  return apiPost<Receta>('recetas', 'setActivo', { id, data: { activo } });
}

export async function restaurarVersion(id: string, version: number, usuario?: string) {
  return apiPost<Receta>('recetas', 'restaurar', { data: { id, version, usuario: usuario || 'Sistema', _origen: 'Web' } });
}

export async function crearFamilia(data: { nombre: string; tipo?: string; activo?: boolean; centrocosto?: string }) {
  return apiPost<Familia>('familias', 'create', { data: { tipo: 'receta', activo: true, ...data } });
}
export async function crearSubfamilia(data: { familia_id: string; nombre: string; tipo?: string; activo?: boolean; centrocosto?: string }) {
  return apiPost<Subfamilia>('subfamilias', 'create', { data: { tipo: 'receta', activo: true, ...data } });
}

export async function actualizarFamilia(id: string, data: { nombre?: string; activo?: boolean; centrocosto?: string }) {
  return apiPost<Familia>('familias', 'update', { id, data });
}
export async function desactivarFamilia(id: string) {
  return apiPost<Familia>('familias', 'update', { id, data: { activo: false } });
}
export async function actualizarSubfamilia(id: string, data: { nombre?: string; familia_id?: string; activo?: boolean; centrocosto?: string }) {
  return apiPost<Subfamilia>('subfamilias', 'update', { id, data });
}
export async function desactivarSubfamilia(id: string) {
  return apiPost<Subfamilia>('subfamilias', 'update', { id, data: { activo: false } });
}

// ---------- CATALOGOS ----------
export async function getFamilias(): Promise<Familia[]> {
  const r = await apiGet<Familia[]>('familias');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}
export async function getSubfamilias(): Promise<Subfamilia[]> {
  const r = await apiGet<Subfamilia[]>('subfamilias');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}
export async function getUnidades(): Promise<Unidad[]> {
  const r = await apiGet<Unidad[]>('unidades');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}


// ---------- CATALOGO UNIFICADO (insumos + subrecetas) ----------
export type Bootstrap = {
  familias: Familia[];
  subfamilias: Subfamilia[];
  unidades: Unidad[];
  catalogo: CatalogoItem[];
};

/** Carga inicial del editor: 4 catálogos en UNA llamada al backend. */
export type FichaTecnica = {
  id?: string; receta_id: string; descripcion?: string; preparacion?: string;
  emplatado?: string; notas?: string; foto_url?: string; foto_id?: string;
  tiempo_min?: string | number; gramaje_porcion?: string | number;
};

/** Ficha técnica de una receta (cacheada 20 s). */
export async function getFicha(recetaId: string): Promise<FichaTecnica | null> {
  const r = await apiGet<FichaTecnica[]>('fichas', { receta_id: recetaId });
  return r.ok && Array.isArray(r.data) ? r.data[0] || null : null;
}

/** Carpeta de fotos de Drive (cacheada 10 min: cambia casi nunca). */
export type Parametros = {
  nombre_negocio?: string;
  fc_objetivo: number;
  fc_por_familia: Record<string, number>;
  impuesto_pct: number;
  alerta_subida_pct: number;
  familias?: { id: string; nombre: string; tipo: string }[];
};

/** Parámetros de negocio (FC objetivo, impuesto, umbral de alertas). Cache 5 min. */
export async function getParametros(): Promise<Parametros | null> {
  const r = await apiGet<Parametros>('parametros');
  return r.ok ? r.data : null;
}

export async function getConfigFotos(): Promise<{ folder_id: string; nombre: string; url: string } | null> {
  const r = await apiGet<{ folder_id: string; nombre: string; url: string }>('configfotos');
  return r.ok ? r.data : null;
}

/**
 * Acción de escritura genérica (guardar ficha, subir foto, renombrar carpeta…).
 * Pasa por la misma limpieza de caché que apiPost: tras mutar, la próxima
 * lectura trae lo nuevo.
 */
export async function accionBackend<T>(
  resource: string,
  action: string,
  payload: { id?: string; data?: unknown }
): Promise<ApiResponse<T>> {
  assertConfig();
  const res = await fetch(API_URL as string, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource, action, token: API_TOKEN, ...payload }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Error de red al escribir en la API: ' + res.status);
  const json = (await res.json()) as ApiResponse<T>;
  limpiarCacheLecturas();
  return json;
}

export async function getBootstrap(): Promise<Bootstrap | null> {
  const r = await apiGet<Bootstrap>('bootstrap');
  return r.ok ? r.data : null;
}

export async function getCatalogo(): Promise<CatalogoItem[]> {
  const r = await apiGet<CatalogoItem[]>('catalogo');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

// ---------- SUBRECETAS (preparaciones base) ----------
export async function getSubrecetas(all = false): Promise<Receta[]> {
  const r = await apiGet<Receta[]>('subrecetas', all ? { all: 'true' } : {});
  return r.ok && Array.isArray(r.data) ? r.data : [];
}
export async function getSubreceta(id: string): Promise<Receta | null> {
  return getReceta(id);
}
export async function crearSubreceta(data: Partial<Receta>) {
  return apiPost<Receta>('subrecetas', 'create', { data });
}
export async function actualizarSubreceta(id: string, data: Partial<Receta>) {
  return apiPost<Receta>('subrecetas', 'update', { id, data });
}
export async function setActivoSubreceta(id: string, activo: boolean) {
  return apiPost<Receta>('subrecetas', 'setActivo', { id, data: { activo } });
}

// ---------- DEPENDENCIAS (recetas que usan un item) ----------
export async function getDependencias(itemId: string): Promise<Dependencia[]> {
  const r = await apiGet<Dependencia[]>('dependencias', { item_id: itemId });
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

// ---------- INSUMOS: edicion con trazabilidad ----------
export async function actualizarInsumo(id: string, data: Partial<Insumo> & { motivo?: string; usuario?: string }) {
  return apiPost<Insumo>('insumos', 'update', { id, data });
}

export async function getHistorialInsumo(insumoId: string): Promise<HistorialInsumo[]> {
  const r = await apiGet<HistorialInsumo[]>('preciosHistoricos');
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data
    .filter((h) => h.insumo_id === insumoId)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
}


// ---------- ANALYTICS / BI: variacion de costos ----------
export type TopMover = {
  id: string;
  referencia: string;
  articulo: string;
  subfamilia: string;
  subfamilia_id: string;
  coste_base: number;
  coste_actual: number;
  variacion_abs: number;
  variacion_pct: number;
  cambios: number;
  ultima_fecha: string;
};

export type ImpactoMenu = {
  receta_id: string;
  receta: string;
  insumo: string;
  insumo_id: string;
  variacion_pct: number;
  incremento_costo: number;
  food_cost: number;
  fuera_objetivo: boolean;
};

export type VariacionFamilia = { familia: string; variacion_pct: number };
export type EvolucionPunto = { fecha: string; costo_promedio: number };
export type Alerta = { nivel: 'rojo' | 'amarillo' | 'verde'; mensaje: string };

export type AnalyticsData = {
  generado_en: string;
  food_cost_objetivo: number;
  top_aumentos: TopMover[];
  top_reducciones: TopMover[];
  impacto_menu: ImpactoMenu[];
  variacion_familia: VariacionFamilia[];
  indicadores: {
    insumo_mas_inflacionario: TopMover | null;
    receta_mas_afectada: ImpactoMenu | null;
    variacion_promedio: number;
    recetas_fuera_objetivo: number;
  };
  evolucion_costo: EvolucionPunto[];
  food_cost_promedio: number;
  alertas: Alerta[];
  total_insumos: number;
  insumos_con_variacion: number;
};

export type SimulacionReceta = {
  receta_id: string;
  nombre: string;
  costo_actual: number;
  costo_nuevo: number;
  incremento: number;
  food_cost_actual: number;
  food_cost_nuevo: number;
  precio_real: number;
  precio_sugerido_nuevo: number;
  rentable: boolean;
  fuera_objetivo: boolean;
};

export type SimulacionResult = {
  insumo_id: string;
  articulo: string;
  precio_actual: number;
  nuevo_precio: number;
  variacion_pct: number;
  recetas: SimulacionReceta[];
};

export type SnapshotSemanal = {
  id: string;
  fecha: string;
  hora: string;
  usuario: string;
  cantidad_insumos: number;
  costo_promedio: number;
  insumos_modificados: number;
  nota: string;
};

export type PuntoHistorial = { fecha: string; coste: number; motivo?: string };

export async function getAnalytics(): Promise<AnalyticsData | null> {
  const r = await apiGet<AnalyticsData>('analytics');
  return r.ok ? r.data : null;
}

export async function getHistorialInsumoGrafica(insumoId: string): Promise<PuntoHistorial[]> {
  const r = await apiGet<PuntoHistorial[]>('analytics', { action: 'historialInsumo', item_id: insumoId });
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

export async function getSnapshots(): Promise<SnapshotSemanal[]> {
  const r = await apiGet<SnapshotSemanal[]>('snapshots');
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

export async function simularImpacto(insumoId: string, nuevoPrecio: number): Promise<SimulacionResult | null> {
  const r = await apiPost<SimulacionResult>('analytics', 'simular', { data: { insumo_id: insumoId, nuevo_precio: nuevoPrecio } });
  return r.ok ? r.data : null;
}

export async function generarSnapshot(usuario?: string) {
  return apiPost('analytics', 'snapshot', { data: { usuario: usuario || 'Sistema' } });
}
