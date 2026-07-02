// lib/costeo.ts
// ============================================================================
// FUENTE UNICA DE VERDAD PARA EL CALCULO DE COSTOS (CostCalculator)
// ----------------------------------------------------------------------------
// Todas las vistas (Recetas, ficha, Panel Ejecutivo, Reportes, Exportaciones)
// deben consumir estas funciones. NO duplicar formulas en otros modulos.
//
// Reglas del negocio (fijas):
//   - Impuesto al Consumo (INC) fijo del 8%. Los precios de venta lo incluyen.
//   - Food Cost objetivo fijo del 35%.
//   - Food Cost = Costo por porcion / Precio base SIN impuesto.
//   - Precio base sin impuesto = precio_real / (1 + INC).
//   - Precio sugerido = (Costo por porcion / FC_OBJ) * (1 + INC).
// ============================================================================

export const INC = 0.08;      // Impuesto al Consumo (fijo)
export const FC_OBJ = 0.35;   // Food Cost objetivo (fijo)

const num = (n: any): number => Number(n) || 0;

/** Precio de venta base, quitando el impuesto al consumo. */
export function precioBaseSinImpuesto(precioReal: number): number {
  return num(precioReal) / (1 + INC);
}

/**
 * Food Cost canonico = Costo por porcion / Precio base sin impuesto.
 * Es la UNICA definicion de Food Cost de la aplicacion.
 */
export function foodCost(costoPorcion: number, precioReal: number): number {
  const base = precioBaseSinImpuesto(precioReal);
  return base > 0 ? num(costoPorcion) / base : 0;
}

/** Precio sugerido para alcanzar el Food Cost objetivo (con impuesto incluido). */
export function precioSugerido(costoPorcion: number): number {
  return FC_OBJ > 0 ? (num(costoPorcion) / FC_OBJ) * (1 + INC) : 0;
}

// Food Cost objetivo para la SUGERENCIA de precio del Panel Ejecutivo (30%).
// El resto de la app usa FC_OBJ (35%). Ver Panel Ejecutivo: precio sugerido editable.
export const FC_OBJ_PANEL = 0.30;

/**
 * Precio de venta sugerido para el Panel Ejecutivo, calculado con el
 * Food Cost objetivo del 30% e impuesto al consumo del 8% (incluido).
 */
export function precioSugeridoPanel(costoPorcion: number): number {
  return FC_OBJ_PANEL > 0 ? (num(costoPorcion) / FC_OBJ_PANEL) * (1 + INC) : 0;
}

/** Utilidad = Precio de venta - Costo por porcion. */
export function utilidad(precioReal: number, costoPorcion: number): number {
  const p = num(precioReal);
  return p > 0 ? p - num(costoPorcion) : 0;
}

/** Margen bruto = Utilidad / Precio de venta. */
export function margenBruto(precioReal: number, costoPorcion: number): number {
  const p = num(precioReal);
  return p > 0 ? (p - num(costoPorcion)) / p : 0;
}

/** Precio de venta necesario para volver al Food Cost objetivo dado un nuevo costo. */
export function precioParaObjetivo(costoPorcion: number): number {
  return precioSugerido(costoPorcion);
}

export type Semaforo = {
  hex: string;
  dot: string;
  text: string;
  bg: string;
  border: string;
  label: string;
  emoji: string;
};

/** Semaforo unico: verde <=33%, amarillo 33-35%, rojo >35%. */
export function semaforo(fc: number): Semaforo {
  const v = num(fc);
  if (v <= 0.33)
    return { hex: '#16A34A', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-[#DCFCE7]', border: 'border-[#BBF7D0]', label: 'Rentable', emoji: 'Optimo' };
  if (v <= 0.35)
    return { hex: '#F59E0B', dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-[#FEF3C7]', border: 'border-[#FDE68A]', label: 'En limite', emoji: 'Alerta' };
  return { hex: '#DC2626', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-[#FEE2E2]', border: 'border-[#FECACA]', label: 'Critico', emoji: 'Critico' };
}

/** True si el Food Cost esta dentro del objetivo (<= 35%). */
export function esRentable(fc: number): boolean {
  return num(fc) > 0 && num(fc) <= FC_OBJ;
}

export type Costeo = {
  costoPorcion: number;
  precioReal: number;
  precioSugerido: number;
  precioBase: number;
  foodCost: number;
  utilidad: number;
  margenBruto: number;
  rentable: boolean;
  semaforo: Semaforo;
};

/**
 * Costeo completo de una receta desde la fuente unica.
 * Usa el costo por porcion del backend (motor de costeo canonico) y calcula
 * el resto de indicadores. Si se pasa `precioOverride`, simula ese precio de
 * venta SIN alterar los datos guardados (para "Nuevo precio de venta").
 */
export function costearReceta(receta: any, precioOverride?: number): Costeo {
  const costoPorcion = num(receta?.costo_porcion) || num(receta?.costo_total);
  const precioReal =
    precioOverride !== undefined && precioOverride !== null && !isNaN(Number(precioOverride))
      ? num(precioOverride)
      : num(receta?.precio_real);
  const fc = foodCost(costoPorcion, precioReal);
  return {
    costoPorcion,
    precioReal,
    precioSugerido: precioSugerido(costoPorcion),
    precioBase: precioBaseSinImpuesto(precioReal),
    foodCost: fc,
    utilidad: utilidad(precioReal, costoPorcion),
    margenBruto: margenBruto(precioReal, costoPorcion),
    rentable: esRentable(fc),
    semaforo: semaforo(fc),
  };
}
