/**
 * GastroCore — Conmutador de backend de datos.
 *
 * Las 29 pantallas y Route Handlers de la app siguen importando de
 * '@/lib/api/gastrocore' exactamente igual que antes. Lo que cambió es lo que
 * hay detrás: ahora este archivo elige la implementación.
 *
 *   GASTROCORE_BACKEND=supabase     → lib/api/supabase.ts   (Fase 3)
 *   GASTROCORE_BACKEND=appsscript   → lib/api/appsScript.ts (el de siempre)
 *   sin definir                     → appsscript
 *
 * POR QUÉ UN CONMUTADOR Y NO UN REEMPLAZO
 * ---------------------------------------
 * Esta migración toca 471 insumos y 87 recetas reales de un restaurante que
 * está operando. La forma de equivocarse barato es poder volver atrás con una
 * variable de entorno y un redeploy, sin revertir código. Cuando Supabase
 * lleve semanas sirviendo bien, se borra `appsScript.ts` y este archivo se
 * vuelve un simple `export * from './supabase'`.
 *
 * El valor por defecto es DELIBERADAMENTE el backend viejo: quien despliegue
 * esta rama sin configurar nada no debe cambiar de base de datos por accidente.
 */
import * as appsScript from '@/lib/api/appsScript';
import * as supabase from '@/lib/api/supabase';

const USAR_SUPABASE = (process.env.GASTROCORE_BACKEND || 'appsscript').toLowerCase() === 'supabase';

const impl = USAR_SUPABASE ? supabase : appsScript;

/** Qué backend está sirviendo los datos ahora mismo (para diagnóstico). */
export const BACKEND_ACTIVO: 'supabase' | 'appsscript' = USAR_SUPABASE ? 'supabase' : 'appsscript';

// Tipos del dominio: únicos, independientes del backend.
export type {
  ApiResponse, Insumo, IngredienteReceta, Receta, HistorialReceta, Familia,
  Subfamilia, Unidad, CatalogoItem, Dependencia, HistorialInsumo, Bootstrap,
  FichaTecnica, Parametros, TopMover, ImpactoMenu, VariacionFamilia,
  EvolucionPunto, Alerta, AnalyticsData, SimulacionReceta, SimulacionResult,
  SnapshotSemanal, PuntoHistorial,
} from '@/lib/api/tipos';

// ── Caché ───────────────────────────────────────────────────────────────────
export const limpiarCacheLecturas = impl.limpiarCacheLecturas;

// ── Insumos ─────────────────────────────────────────────────────────────────
export const getInsumos = impl.getInsumos;
export const getInsumo = impl.getInsumo;
export const actualizarInsumo = impl.actualizarInsumo;
export const actualizarCosteInsumo = impl.actualizarCosteInsumo;
export const getHistorialInsumo = impl.getHistorialInsumo;

// ── Recetas ─────────────────────────────────────────────────────────────────
export const getRecetas = impl.getRecetas;
export const getReceta = impl.getReceta;
export const getRecetaPorId = impl.getRecetaPorId;
export const getIngredientesReceta = impl.getIngredientesReceta;
export const getHistorialReceta = impl.getHistorialReceta;
export const crearReceta = impl.crearReceta;
export const actualizarReceta = impl.actualizarReceta;
export const setActivoReceta = impl.setActivoReceta;
export const restaurarVersion = impl.restaurarVersion;

// ── Subrecetas ──────────────────────────────────────────────────────────────
export const getSubrecetas = impl.getSubrecetas;
export const getSubreceta = impl.getSubreceta;
export const crearSubreceta = impl.crearSubreceta;
export const actualizarSubreceta = impl.actualizarSubreceta;
export const setActivoSubreceta = impl.setActivoSubreceta;
export const getDependencias = impl.getDependencias;

// ── Catálogos ───────────────────────────────────────────────────────────────
export const getFamilias = impl.getFamilias;
export const getSubfamilias = impl.getSubfamilias;
export const getUnidades = impl.getUnidades;
export const crearFamilia = impl.crearFamilia;
export const crearSubfamilia = impl.crearSubfamilia;
export const actualizarFamilia = impl.actualizarFamilia;
export const desactivarFamilia = impl.desactivarFamilia;
export const actualizarSubfamilia = impl.actualizarSubfamilia;
export const desactivarSubfamilia = impl.desactivarSubfamilia;
export const getCatalogo = impl.getCatalogo;
export const getBootstrap = impl.getBootstrap;

// ── Fichas y configuración ──────────────────────────────────────────────────
export const getFicha = impl.getFicha;
export const getParametros = impl.getParametros;
export const getConfigFotos = impl.getConfigFotos;
export const accionBackend = impl.accionBackend;

// ── Analítica ───────────────────────────────────────────────────────────────
// Aun con GASTROCORE_BACKEND=supabase, getAnalytics / simularImpacto /
// generarSnapshot siguen delegando en Apps Script (ver PENDIENTE-FASE-3B en
// lib/api/supabase.ts). getSnapshots y getHistorialInsumoGrafica sí salen de
// Supabase.
export const getAnalytics = impl.getAnalytics;
export const getHistorialInsumoGrafica = impl.getHistorialInsumoGrafica;
export const getSnapshots = impl.getSnapshots;
export const simularImpacto = impl.simularImpacto;
export const generarSnapshot = impl.generarSnapshot;
