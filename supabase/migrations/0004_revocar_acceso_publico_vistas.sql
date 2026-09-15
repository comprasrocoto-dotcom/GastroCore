-- ============================================================================
-- GastroCore · Migración 0004: revocar acceso público a vistas heredadas
-- ----------------------------------------------------------------------------
-- Hallazgo durante la verificación previa a la Fase 3 (sesión 2, 11-sep-2026):
-- las vistas `v_insumos_completos` y `v_recetas_completas` ya existían en el
-- proyecto antes de cualquiera de las migraciones de GastroCore (no aparecen
-- en 0001/0002/0003, ni se usan en ningún lugar del código de Next.js — se
-- verificó con grep). Son propiedad de `postgres`, no tienen
-- `security_invoker`, y el rol `anon` tenía sobre ellas permisos de
-- SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER.
--
-- Efecto real: como la vista corre con los permisos de su dueño (`postgres`,
-- que ignora RLS), cualquiera con la llave pública "anon" (la misma que se
-- expone al navegador vía NEXT_PUBLIC_SUPABASE_ANON_KEY) podía leer el costo
-- de cada insumo/receta de TODAS las marcas, y además insertar/editar/borrar
-- filas directamente en `insumos` y `recetas` a través de la vista — sin
-- pasar por ninguna política de RLS ni por marca_id.
--
-- Esta migración revoca el acceso público. No borra las vistas (por si algún
-- proceso interno las usa con la service_role key), solo le quita el acceso
-- a los roles públicos de la API (anon, authenticated).
-- ============================================================================

revoke all on public.v_insumos_completos from anon, authenticated;
revoke all on public.v_recetas_completas from anon, authenticated;
