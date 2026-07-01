/**
 * GastroCore — Cliente de la API de Google Apps Script.
 *
 * IMPORTANTE (seguridad): este módulo SOLO debe ejecutarse en el servidor
 * (Server Components, Route Handlers). El token nunca se envía al navegador.
 * Las credenciales se leen de variables de entorno (Vercel / .env.local).
 */
import 'server-only';

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
  ingredientes?: IngredienteReceta[];
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
};

function assertConfig(): void {
  if (!API_URL || !API_TOKEN) {
    throw new Error(
      'Faltan GASTROCORE_API_URL o GASTROCORE_API_TOKEN en las variables de entorno.'
    );
  }
}

/** Lectura (GET). Revalida cada 30s por defecto para reflejar cambios del Sheet. */
async function apiGet<T>(
  resource: string,
  params: Record<string, string> = {},
  revalidate = 30
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

/** Escritura (POST). Emula create/update/delete. */
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
  const r = await apiGet<Receta>('recetas', { id });
  return r.ok ? r.data : null;
}

export async function crearReceta(data: Partial<Receta>) {
  return apiPost<Receta>('recetas', 'create', { data });
}

export async function actualizarReceta(id: string, data: Partial<Receta>) {
  return apiPost<Receta>('recetas', 'update', { id, data });
}

// ---------- CATÁLOGOS ----------
export async function getFamilias() {
  return (await apiGet<any[]>('familias')).data ?? [];
}
export async function getSubfamilias() {
  return (await apiGet<any[]>('subfamilias')).data ?? [];
}
export async function getUnidades() {
  return (await apiGet<any[]>('unidades')).data ?? [];
}
