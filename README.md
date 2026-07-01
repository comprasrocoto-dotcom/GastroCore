# Recetario ERP — Fase 0 + esqueleto Fase 1

Scaffold inicial del sistema, siguiendo el documento de arquitectura
(`docs/arquitectura-erp-recetas.md`).

## Qué incluye este scaffold

- **Proyecto Next.js 14 (App Router) + TypeScript + TailwindCSS**, con
  identidad visual propia (paleta ámbar/salvia sobre base neutra, tipografía
  Zilla Slab + Inter + JetBrains Mono, y un panel de costeo con estética de
  "ticket de cocina" como elemento distintivo).
- **Migración SQL completa de la Fase 1 (MVP)**: organizaciones, usuarios,
  roles, catálogos (familias, subfamilias, unidades de medida, proveedores,
  etiquetas), insumos con historial de precios, recetas, ingredientes de
  receta (con soporte para subrecetas desde el modelo, aunque la lógica de
  cascada se activa en Fase 2), auditoría y Row Level Security básico.
- **Motor de costeo puro** (`lib/costeo/`): conversión de unidades, cálculo
  de costo por ingrediente, costo total, costo por porción, food cost y
  precio sugerido — sin dependencias de UI, listo para reusarse en API
  routes o Edge Functions.
- **Clientes de Supabase** (browser y server) listos para conectar.
- **Pantallas del MVP** (con datos de ejemplo, aún sin conectar a Supabase):
  Login, Dashboard, Listado de recetas, Detalle de receta (con el panel de
  costeo), Listado de insumos.

## Cómo ponerlo en marcha

```bash
cd apps/web
npm install
cp .env.example .env.local   # y completa con tus credenciales de Supabase
npm run dev
```

Para la base de datos, en el panel de Supabase (SQL Editor) o con la CLI:

```bash
supabase link --project-ref tu-proyecto
supabase db push   # aplica supabase/migrations/0001_init.sql
```

Después de aplicar la migración necesitas:
1. Crear una fila en `organizaciones`.
2. Crear tu primer usuario desde Supabase Auth y luego insertar su fila en
   `usuarios` con `rol_id` de Administrador y el `organizacion_id` creado.

## Qué falta (siguiente iteración)

Las pantallas actuales usan datos de ejemplo embebidos para poder validar
el diseño y la navegación primero. El siguiente paso natural es:

1. Conectar `recetas`, `insumos`, `familias` a Supabase con Server
   Components (`lib/supabase/server.ts`) reemplazando los arrays estáticos.
2. Formularios reales (crear/editar receta, crear/editar insumo) con
   `react-hook-form` + `zod`, ya incluidos en las dependencias.
3. Conectar el motor de costeo (`lib/costeo/calculo.ts`) a los datos reales
   para que el panel de costeo se recalcule en vivo.
4. Autenticación real con Supabase Auth en `/login` y middleware de
   protección de rutas.

Dime cuál de estos puntos quieres que ataquemos primero y seguimos.
