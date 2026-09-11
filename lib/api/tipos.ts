/**
 * GastroCore — Tipos del dominio, compartidos por los dos backends.
 *
 * Vivían dentro de `lib/api/gastrocore.ts`. Se extrajeron aquí para que el
 * cliente de Apps Script y el de Supabase puedan usar LAS MISMAS definiciones
 * sin importarse mutuamente. Si un tipo cambia, cambia en un solo lugar y los
 * dos backends dejan de compilar a la vez — que es justo lo que uno quiere
 * durante una migración.
 *
 * Nota sobre los nombres: varios campos conservan la forma que traían de
 * Google Sheets (`unidad_rendimiento_id`, `unidad_id`) aunque en Supabase la
 * columna se llame distinto. La traducción vive en `lib/supabase/mapeo.ts`,
 * no aquí: estos son los nombres que consume la interfaz.
 */

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

/** Item unificado del catálogo de ingredientes (insumo o subreceta). */
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

export type Bootstrap = {
  familias: Familia[];
  subfamilias: Subfamilia[];
  unidades: Unidad[];
  catalogo: CatalogoItem[];
};

export type FichaTecnica = {
  id?: string; receta_id: string; descripcion?: string; preparacion?: string;
  emplatado?: string; notas?: string; foto_url?: string; foto_id?: string;
  tiempo_min?: string | number; gramaje_porcion?: string | number;
};

export type Parametros = {
  nombre_negocio?: string;
  fc_objetivo: number;
  fc_por_familia: Record<string, number>;
  impuesto_pct: number;
  alerta_subida_pct: number;
  familias?: { id: string; nombre: string; tipo: string }[];
};

// ── Analítica / BI ──────────────────────────────────────────────────────────

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
