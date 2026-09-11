-- ============================================================================
-- GastroCore · Migración 0001: pasar el esquema EXISTENTE a multi-marca
-- ----------------------------------------------------------------------------
-- IMPORTANTE: este proyecto de Supabase NO estaba vacío. Ya tenía el esquema
-- completo de una sola marca (Rocoto), con datos reales: 471 insumos,
-- 87 recetas, 18 familias, etc. Los IDs de esas tablas son texto tipo Sheets
-- (FAM-000001, INS-000001, REC-000011...), no UUID.
--
-- Por eso esta migración NO crea tablas desde cero: EXTIENDE las tablas que
-- ya existen agregándoles una columna marca_id, sin tocar sus datos ni sus
-- IDs actuales. Decisiones confirmadas con Mariluz (11-sep-2026):
--   1. unidades_medida es GLOBAL/compartida entre las 4 marcas (no se toca).
--   2. usuarios.marca_id es NULLABLE: NULL = Admin multi-marca.
--   3. El recetario público se sirve por marca vía URL (/recetario/[marca]).
--   4. Se agrega marca_id también a "Costos Restaurantes", precios_historicos,
--      snapshot_detalle y snapshots_semanales por seguridad, aunque no se
--      sabe con certeza si el frontend actual las sigue usando (a confirmar
--      con quien tenga el repo).
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 1) Tabla nueva: marcas
-- ----------------------------------------------------------------------------
create table if not exists public.marcas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  slug        text not null unique,   -- usado en /recetario/[slug]
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

comment on table public.marcas is 'Las 4 marcas/restaurantes que comparten esta base de datos.';

-- Marca existente: los datos que ya había en este proyecto son de "Rocoto".
-- AJUSTAR el nombre aquí si no es el correcto antes de correr en producción.
insert into public.marcas (nombre, slug)
values ('Rocoto', 'rocoto')
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2) Agregar marca_id a cada tabla operativa existente (nullable primero)
-- ----------------------------------------------------------------------------
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'familias', 'subfamilias', 'insumos', 'subrecetas', 'recetas',
    'ingredientes_receta', 'fichas_tecnicas', 'historial_recetas',
    'precios_historicos', 'snapshot_detalle', 'snapshots_semanales',
    'Costos Restaurantes'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists marca_id uuid references public.marcas(id);',
      tabla
    );
  end loop;
end $$;

-- usuarios: marca_id nullable a propósito (NULL = Admin multi-marca).
alter table public.usuarios add column if not exists marca_id uuid references public.marcas(id);

-- configuracion: hoy es clave/valor global (0 filas) con PK en "clave".
-- La volvemos por-marca: cada marca tendrá su propio juego de claves, así
-- que la llave primaria pasa a ser (marca_id, clave). Como la tabla está
-- vacía (0 filas), este cambio de PK es seguro.
alter table public.configuracion add column if not exists marca_id uuid references public.marcas(id);
alter table public.configuracion alter column marca_id set not null;
do $$
declare
  pk_actual text;
begin
  select constraint_name into pk_actual
  from information_schema.table_constraints
  where table_schema = 'public' and table_name = 'configuracion' and constraint_type = 'PRIMARY KEY';

  if pk_actual is not null then
    execute format('alter table public.configuracion drop constraint %I;', pk_actual);
  end if;

  alter table public.configuracion add primary key (marca_id, clave);
end $$;

-- "Costos Restaurantes" no tiene primary key (a diferencia de las demás
-- tablas), así que Postgres necesita REPLICA IDENTITY FULL para poder
-- hacerle UPDATE (lo exige la publicación de Realtime). Esto también
-- confirma que esta tabla probablemente no es una tabla operativa normal
-- de la app, sino una importación cruda — se trata igual con cuidado.
alter table public."Costos Restaurantes" replica identity full;

-- ----------------------------------------------------------------------------
-- 3) Backfill: todo lo que ya existía es de la marca "Rocoto"
-- ----------------------------------------------------------------------------
do $$
declare
  tabla text;
  rocoto_id uuid;
begin
  select id into rocoto_id from public.marcas where slug = 'rocoto';

  foreach tabla in array array[
    'familias', 'subfamilias', 'insumos', 'subrecetas', 'recetas',
    'ingredientes_receta', 'fichas_tecnicas', 'historial_recetas',
    'precios_historicos', 'snapshot_detalle', 'snapshots_semanales',
    'Costos Restaurantes'
  ]
  loop
    execute format(
      'update public.%I set marca_id = $1 where marca_id is null;', tabla
    ) using rocoto_id;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4) Ahora que todas las filas tienen marca_id, la hacemos obligatoria
--    (excepto en usuarios, donde NULL sigue significando "Admin multi-marca",
--    y en configuracion, que puede arrancar vacía por marca).
-- ----------------------------------------------------------------------------
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'familias', 'subfamilias', 'insumos', 'subrecetas', 'recetas',
    'ingredientes_receta', 'fichas_tecnicas', 'historial_recetas',
    'precios_historicos', 'snapshot_detalle', 'snapshots_semanales',
    'Costos Restaurantes'
  ]
  loop
    execute format('alter table public.%I alter column marca_id set not null;', tabla);
    execute format('create index if not exists idx_%s_marca on public.%I (marca_id);',
      replace(lower(tabla), ' ', '_'), tabla);
  end loop;
end $$;

-- Restricción: en usuarios, marca_id solo puede ser NULL si el rol es Admin.
alter table public.usuarios drop constraint if exists usuarios_marca_obligatoria_si_no_admin;
alter table public.usuarios add constraint usuarios_marca_obligatoria_si_no_admin
  check (rol = 'Admin' or marca_id is not null);
