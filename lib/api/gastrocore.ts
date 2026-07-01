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
  subfamilia_id: string;
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
};

export type Familia = { id: string; nombre: string; tipo?: string; activo: boolean | string };
export type Subfamilia = { id: string; familia_id: string; nombre: string; tipo?: string; activo: boolean | string };
export type Unidad = { id: string; codigo: string; nombre: string; tipo: string; activo: boolean | string };

function assertConfig(): void {
  if (!API_URL || !API_TOKEN) {
    throw new Error('Faltan GASTROCORE_API_URL o GASTROCORE_API_TOKEN en las variables de entorno.');
  }
}

async function apiGet<T>(
  resource: string,
  params: Record<string, string> = {},
  revalidate = 15
): Promise<ApiResponse<T>> {
  assertConfig();
  const url = new URL(API_URL as string);
  url.searchParams.set('resource', resource);
  url.searchParams.set('token', API_TOKEN as string);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { next: { revalidate } });
  if (!res.ok) throw new Error('Error de red al consultar la API: ' + res.status);
  return (await res.json()) as ApiResponse<T>;
}

async function apiPost<T>(
  resource: string,
  action: 'create' | 'update' | 'delete',
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
  return (await res.json()) as ApiResponse<T>;
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
export async function getRecetas(): Promise<Receta[]> {
  const r = await apiGet<Receta[]>('recetas');
  return r.ok ? r.data : [];
}

export async function getReceta(id: string): Promise<Receta | null> {
  // Traemos todas y buscamos por id (el backend no filtra por id de forma fiable),
  // y adjuntamos sus ingredientes desde el recurso 'ingredientes'.
  const [recetas, ings, insumos, historial] = await Promise.all([
    getRecetas(),
    getIngredientesReceta(id),
    getInsumos(),
    getHistorialReceta(id).catch(() => []),
  ]);
  const receta = recetas.find((x) => x.id === id);
  if (!receta) return null;
  const mapaInsumo = new Map(insumos.map((i) => [i.id, i.articulo]));
  receta.ingredientes = ings.map((g) => ({
    ...g,
    nombre_item: mapaInsumo.get(g.item_id) || g.item_id,
  }));
  receta.historial = historial;
  return receta;
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

export async function crearFamilia(data: { nombre: string; tipo?: string; activo?: boolean }) {
  return apiPost<Familia>('familias', 'create', { data: { tipo: 'receta', activo: true, ...data } });
}
export async function crearSubfamilia(data: { familia_id: string; nombre: string; tipo?: string; activo?: boolean }) {
  return apiPost<Subfamilia>('subfamilias', 'create', { data: { tipo: 'receta', activo: true, ...data } });
}

export async function actualizarFamilia(id: string, data: { nombre?: string; activo?: boolean }) {
  return apiPost<Familia>('familias', 'update', { id, data });
}
export async function desactivarFamilia(id: string) {
  return apiPost<Familia>('familias', 'update', { id, data: { activo: false } });
}
export async function actualizarSubfamilia(id: string, data: { nombre?: string; familia_id?: string; activo?: boolean }) {
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
