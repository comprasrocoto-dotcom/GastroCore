-- ============================================================================
-- GastroCore · Migración 0003: vista pública del recetario (sin costos)
-- ----------------------------------------------------------------------------
-- El endpoint público /recetario/[marca] (usado por cocina / punto de venta)
-- debe leer SOLO de estas vistas. No exponen costo_total, costo_porcion,
-- food_cost, precio_sugerido, precio_real, margen_objetivo, iva, ni coste de
-- insumos: esas columnas simplemente no viajan, no se ocultan en el frontend.
--
-- Usa los nombres de columna REALES del esquema ya existente (recetas,
-- familias, fichas_tecnicas, ingredientes_receta, insumos, subrecetas,
-- unidades_medida), no un diseño nuevo.
-- ============================================================================

create or replace view public.recetario_publico as
select
  r.id,
  r.marca_id,
  m.slug          as marca_slug,
  r.nombre,
  r.familia_id,
  f.nombre        as familia_nombre,
  r.rendimiento,
  r.unidad_rendimiento_codigo,
  r.activo,
  ft.preparacion,
  ft.emplatado,
  ft.notas,
  ft.foto_url,
  ft.tiempo_min,
  ft.gramaje_porcion
from public.recetas r
join public.marcas m         on m.id = r.marca_id
left join public.familias f  on f.id = r.familia_id
left join public.fichas_tecnicas ft on ft.receta_id = r.id
where r.activo = true
  and m.activo = true;

create or replace view public.recetario_publico_ingredientes as
select
  ir.id,
  ir.marca_id,
  ir.receta_id,
  ir.subreceta_id,
  ir.tipo_item,
  ir.item_id,
  case ir.tipo_item
    when 'insumo' then i.articulo
    when 'subreceta' then i_sub.articulo
  end                          as item_nombre,
  ir.cantidad,
  ir.unidad_codigo,
  um.nombre                    as unidad_nombre,
  ir.merma_pct,
  ir.orden
from public.ingredientes_receta ir
left join public.insumos i       on i.id = ir.item_id and ir.tipo_item = 'insumo'
left join public.subrecetas sr   on sr.id = ir.item_id and ir.tipo_item = 'subreceta'
left join public.insumos i_sub   on i_sub.id = sr.insumo_id  -- insumo "puente" que nombra la subreceta
left join public.unidades_medida um on um.codigo = ir.unidad_codigo;

-- Solo lectura, y solo de estas dos vistas, para visitantes sin sesión.
grant usage on schema public to anon;
grant select on public.recetario_publico to anon;
grant select on public.recetario_publico_ingredientes to anon;

comment on view public.recetario_publico is
  'Vista pública sin costos/precios/márgenes. El endpoint /recetario/[marca] debe leer de aquí, nunca de public.recetas directamente.';
