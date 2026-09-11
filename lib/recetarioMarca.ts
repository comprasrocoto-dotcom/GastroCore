/**
 * GastroCore — Recetario público POR MARCA (FASE 6). SOLO SERVIDOR.
 *
 * Lee de `recetario_publico` y `recetario_publico_ingredientes` (migración
 * 0003), nunca de las tablas completas.
 *
 * LA DIFERENCIA IMPORTANTE CON `lib/recetario.ts`
 * -----------------------------------------------
 * El recetario viejo pide la receta entera a Apps Script — con costo_total,
 * food_cost, precio_real y precio_sugerido incluidos — y confía en que el
 * componente de galería no los pinte. O sea: los precios de la carta SÍ
 * viajaban al servidor de la vista pública, y bastaba un cambio descuidado en
 * el componente para exponerlos.
 *
 * Estas vistas no tienen esas columnas. No es que se oculten: no existen en
 * la respuesta. Por eso `RecetaPublica.costo_total` y compañía se rellenan
 * con 0 aquí — el tipo los pide porque lo comparte con la vista de admin, y
 * ponerlos en 0 es la forma de decir "esta ruta no los conoce".
 *
 * Si algún día el recetario público necesita mostrar el precio de venta, la
 * respuesta correcta es agregar SOLO `precio_real` a la vista en una migración
 * 0004, no leer de `recetas` desde aquí.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { supabaseAnon, supabaseAdmin } from '@/lib/supabase/cliente';
import { getMarcaPorSlug } from '@/lib/marca';
import { txt, num, type Fila } from '@/lib/supabase/mapeo';
import type { RecetaPublica, IngredienteRecetario } from '@/lib/recetario';

/** Marca tal como la necesita la cabecera del recetario. */
export type MarcaPublica = { slug: string; nombre: string; tema: string };

function aIngredientePublico(f: Fila): IngredienteRecetario {
  return {
    nombre: txt(f.item_nombre),
    tipo_item: txt(f.tipo_item) === 'subreceta' ? 'subreceta' : 'insumo',
    cantidad: num(f.cantidad),
    unidad: txt(f.unidad_nombre) || txt(f.unidad_codigo),
    merma_pct: num(f.merma_pct),
    costo_linea: 0, // la vista pública no expone costos (ver cabecera)
  };
}

function aRecetaPublica(f: Fila, ingredientes: IngredienteRecetario[]): RecetaPublica {
  return {
    id: txt(f.id),
    nombre: txt(f.nombre),
    categoria: txt(f.familia_nombre),
    subcategoria: '',
    rendimiento: num(f.rendimiento),
    unidad_rendimiento: txt(f.unidad_rendimiento_codigo),
    es_subreceta: false,
    // Sin costos por diseño: estas columnas no vienen en la vista.
    costo_total: 0,
    costo_porcion: 0,
    food_cost: 0,
    precio_real: 0,
    precio_sugerido: 0,
    ingredientes,
    ficha: {
      preparacion: txt(f.preparacion),
      emplatado: txt(f.emplatado),
      notas: txt(f.notas),
      foto_url: txt(f.foto_url),
      tiempo_min: txt(f.tiempo_min),
      gramaje_porcion: txt(f.gramaje_porcion),
    },
  };
}

/**
 * Carta completa de una marca. Caché 5 min con etiqueta 'recetario' — el
 * mismo ritmo de refresco de siempre, y toda mutación en el admin lo purga.
 *
 * La etiqueta de caché incluye el slug: purgar 'recetario' invalida las 4
 * marcas a la vez, que es lo correcto (una edición de catálogo global puede
 * tocar varias) y barato, porque la vista responde en milisegundos.
 */
export const getRecetarioMarca = unstable_cache(
  async (slug: string): Promise<RecetaPublica[]> => {
    const marca = await getMarcaPorSlug(slug);
    if (!marca) return [];

    const sb = supabaseAnon();
    const [{ data: recetas, error }, { data: ingredientes }] = await Promise.all([
      sb.from('recetario_publico').select('*').eq('marca_slug', marca.slug).order('nombre'),
      sb.from('recetario_publico_ingredientes').select('*').eq('marca_id', marca.id).order('orden'),
    ]);
    if (error) throw new Error('recetario_publico: ' + error.message);

    // Un solo viaje por tabla y agrupación en memoria: con 87 recetas, pedir
    // los ingredientes receta por receta serían 88 consultas.
    const porReceta = new Map<string, IngredienteRecetario[]>();
    for (const f of ((ingredientes || []) as unknown as Fila[])) {
      const k = txt(f.receta_id);
      if (!porReceta.has(k)) porReceta.set(k, []);
      porReceta.get(k)!.push(aIngredientePublico(f));
    }

    return ((recetas || []) as unknown as Fila[]).map((f) => aRecetaPublica(f, porReceta.get(txt(f.id)) || []));
  },
  ['recetario-publico-marca'],
  { revalidate: 300, tags: ['recetario'] },
);

/** Una receta puntual de una marca, para el enlace directo. */
export const getRecetaPublicaMarca = unstable_cache(
  async (slug: string, id: string): Promise<RecetaPublica | null> => {
    const marca = await getMarcaPorSlug(slug);
    if (!marca) return null;

    const sb = supabaseAnon();
    const { data, error } = await sb
      .from('recetario_publico').select('*')
      .eq('marca_slug', marca.slug).eq('id', id).maybeSingle();
    if (error || !data) return null;

    const { data: ing } = await sb
      .from('recetario_publico_ingredientes').select('*')
      .eq('marca_id', marca.id).eq('receta_id', id).order('orden');

    return aRecetaPublica(data as unknown as Fila, ((ing || []) as unknown as Fila[]).map(aIngredientePublico));
  },
  ['recetario-publico-marca-detalle'],
  { revalidate: 300, tags: ['recetario'] },
);

/**
 * Identidad visual de la marca para la cabecera pública.
 *
 * El nombre sale de `marcas`, no de la configuración: es el dato que define
 * de quién es este recetario y no debería depender de que alguien haya
 * llenado un campo en Configuración. El tema sí es configurable por marca.
 */
export const getMarcaPublica = unstable_cache(
  async (slug: string): Promise<MarcaPublica | null> => {
    const marca = await getMarcaPorSlug(slug);
    if (!marca) return null;

    const { data } = await supabaseAdmin()
      .from('configuracion').select('valor')
      .eq('marca_id', marca.id).eq('clave', 'recetario_tema').maybeSingle();

    return {
      slug: marca.slug,
      nombre: marca.nombre,
      tema: txt((data as unknown as (Fila | null))?.valor) || marca.slug,
    };
  },
  ['recetario-marca-publica'],
  { revalidate: 300, tags: ['recetario'] },
);

/** Marcas activas, para el selector de /recetario. */
export async function getMarcasPublicas(): Promise<MarcaPublica[]> {
  const { data, error } = await supabaseAdmin()
    .from('marcas').select('slug, nombre').eq('activo', true).order('nombre');
  if (error) return [];
  return ((data || []) as unknown as Fila[]).map((f) => ({
    slug: txt(f.slug),
    nombre: txt(f.nombre),
    tema: txt(f.slug),
  }));
}
