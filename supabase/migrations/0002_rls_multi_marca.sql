-- ============================================================================
-- GastroCore · Migración 0002: Row Level Security (aislamiento por marca)
-- ----------------------------------------------------------------------------
-- CONTRATO CON LA FASE 4 (auth en el repo Next.js):
--   GastroCore usa login propio (cookie HMAC), no Supabase Auth. Para que
--   estas políticas RLS se puedan evaluar, las llamadas a Supabase que NO
--   usen la service_role key deben incluir un JWT firmado con el JWT secret
--   del proyecto (Project Settings → API) con estos claims personalizados:
--     { "rol": "Admin" | "Chef" | "Lector",
--       "marca_id": "<uuid>" | null,      -- null = Admin multi-marca
--       "usuario_id": "<uuid>" }
--   Mientras la Fase 4 no exista, TODAS las lecturas/escrituras desde los
--   Route Handlers de Next.js deben seguir usando la SUPABASE_SERVICE_ROLE_KEY
--   (que ignora RLS por diseño) y filtrar manualmente por marca_id en cada
--   query. RLS aquí es una segunda capa de defensa por si esas claves
--   llegaran a exponerse o alguien llamara a la API de Supabase directamente
--   con una key anon/authenticated.
-- ============================================================================

create schema if not exists private;

create or replace function private.rol_actual()
returns text
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'rol';
$$;

create or replace function private.marca_actual()
returns uuid
language sql stable
as $$
  select nullif(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'marca_id'),
    ''
  )::uuid;
$$;

create or replace function private.usuario_actual()
returns uuid
language sql stable
as $$
  select nullif(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'usuario_id'),
    ''
  )::uuid;
$$;

-- Admin multi-marca = rol Admin y sin marca_id en el claim.
create or replace function private.es_admin_multi_marca()
returns boolean
language sql stable
as $$
  select private.rol_actual() = 'Admin' and private.marca_actual() is null;
$$;

-- Verdadero si la fila de esa marca_id es visible para el usuario actual.
create or replace function private.marca_visible(fila_marca_id uuid)
returns boolean
language sql stable
as $$
  select private.es_admin_multi_marca() or fila_marca_id = private.marca_actual();
$$;

-- ----------------------------------------------------------------------------
-- Activar RLS + política de aislamiento por marca en cada tabla operativa
-- (nombres reales de las tablas que ya existían en el proyecto)
-- ----------------------------------------------------------------------------
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'familias', 'subfamilias', 'insumos', 'subrecetas', 'recetas',
    'ingredientes_receta', 'fichas_tecnicas', 'historial_recetas',
    'precios_historicos', 'snapshot_detalle', 'snapshots_semanales',
    'Costos Restaurantes', 'configuracion'
  ]
  loop
    execute format('alter table public.%I enable row level security;', tabla);
    execute format('drop policy if exists marca_aislamiento on public.%I;', tabla);
    execute format(
      'create policy marca_aislamiento on public.%I
         for all
         using (private.marca_visible(marca_id))
         with check (private.marca_visible(marca_id));',
      tabla
    );
  end loop;
end $$;

-- `unidades_medida` es catálogo global: cualquier usuario autenticado puede
-- leer; solo Admin puede escribir (alta/edición de unidades).
alter table public.unidades_medida enable row level security;
drop policy if exists unidades_lectura on public.unidades_medida;
create policy unidades_lectura on public.unidades_medida
  for select
  using (private.rol_actual() is not null);
drop policy if exists unidades_escritura on public.unidades_medida;
create policy unidades_escritura on public.unidades_medida
  for all
  using (private.rol_actual() = 'Admin')
  with check (private.rol_actual() = 'Admin');

-- `marcas`: cualquier usuario autenticado ve las marcas; solo ve "la suya"
-- si no es Admin multi-marca. Solo Admin puede crear/editar marcas.
alter table public.marcas enable row level security;
drop policy if exists marcas_lectura on public.marcas;
create policy marcas_lectura on public.marcas
  for select
  using (private.es_admin_multi_marca() or id = private.marca_actual());
drop policy if exists marcas_escritura on public.marcas;
create policy marcas_escritura on public.marcas
  for all
  using (private.rol_actual() = 'Admin')
  with check (private.rol_actual() = 'Admin');

-- `usuarios`: cada quien ve su propia fila; Admin ve los usuarios de su
-- marca (o de todas si es multi-marca). Solo Admin administra usuarios.
alter table public.usuarios enable row level security;
drop policy if exists usuarios_lectura on public.usuarios;
create policy usuarios_lectura on public.usuarios
  for select
  using (
    id = private.usuario_actual()
    or private.es_admin_multi_marca()
    or (private.rol_actual() = 'Admin' and marca_id = private.marca_actual())
  );
drop policy if exists usuarios_escritura on public.usuarios;
create policy usuarios_escritura on public.usuarios
  for all
  using (private.rol_actual() = 'Admin')
  with check (private.rol_actual() = 'Admin');
