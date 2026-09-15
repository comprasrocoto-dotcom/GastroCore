## Qué trae esta rama

5 commits de una sesión anterior de trabajo sobre la migración a Supabase, centrados en seguridad y estado real de los datos (no en completar la Fase 3/6 de lógica de negocio):

1. **Integrar migraciones de Supabase al repo** — copia `supabase/migrations/`, `scripts/migrar-sheets-a-supabase.ts` y `.env.example` desde el zip de la sesión previa (fases 1-2 ya aplicadas).
2. **Revocar acceso público a vistas heredadas con hueco de RLS** — `v_insumos_completos` y `v_recetas_completas` le daban a `anon` acceso de lectura a costos e incluso de insertar/editar/borrar, sin pasar por RLS ni `marca_id`. Ya aplicado en producción (0004_revocar_acceso_publico_vistas.sql); verificado en Supabase: 0 permisos restantes para anon/authenticated sobre esas vistas.
3. **Documentar el mapa real de datos en Supabase antes de la Fase 3** — verificación tabla por tabla (11-sep-2026): además de `ingredientes_receta`, están vacías `subrecetas`, `fichas_tecnicas`, `historial_recetas`, `configuracion` y `usuarios`. Solo `insumos`, `familias`, `subfamilias`, `unidades`, `recetas` (campos base) y una muestra de `precios_historicos` tienen datos reales.
4. **Completar el script de migración de datos reales** — `scripts/migrar-sheets-a-supabase.ts` deja de ser un esqueleto y pasa a migrar, para Rocoto, los recursos vacíos en Supabase (fichas_tecnicas, historial_recetas, configuracion, usuarios), reutilizando las funciones de lectura existentes en `lib/api/gastrocore.ts`. Para `subrecetas` e `ingredientes_receta` solo hace diagnóstico (no adivina el mapeo real). Sigue pendiente de credenciales para correr `--dry-run`.
5. **Documentar chequeo de despliegue** — verificado en vivo (15-sep-2026) que producción sigue intacta y el fix de RLS sigue activo.

## ⚠️ Existe otra rama con una versión más completa de esta misma fase — necesita reconciliación antes de mergear cualquiera de las dos

La rama [`migracion-supabase-fase-3-6`](../../tree/migracion-supabase-fase-3-6) (commit `7f6d98e`, de otra sesión en paralelo) tiene una implementación más completa de las Fases 3 y 6 (capa de datos sobre Supabase y recetario por marca), pero el commit `882e891` de esta rama documenta **3 errores de nombres de columna confirmados contra el esquema real** en esa implementación: `insumos.unidad`, `subrecetas.familia_id`/`costo_porcion`, `fichas_tecnicas.descripcion`.

Ninguna de las dos ramas debería mergearse a `main` sin que alguien del equipo (Diego/Mariluz) decida cómo combinarlas primero. Puntos concretos a resolver:

- Ambas ramas parten de un ancestro común (`d04dcbf`) pero `main` avanzó desde entonces con cambios propios en `.env.example` — **esta rama va a tener un conflicto de merge real en `.env.example`** contra `main` (ambas crean el archivo de forma independiente, con contenido distinto). Va a necesitar resolución manual sí o sí.
- El fix de seguridad RLS (commit 2 de esta lista) ya está aplicado en producción independientemente del resultado de esta reconciliación — no depende de qué rama se elija como base para el resto.
- La rama `migracion-supabase-fase-3-6` probablemente necesita los 3 fixes de columnas antes de ser mergeable, independientemente de si se toma como base.

**No se está pidiendo mergear este PR todavía** — se abre para que el trabajo quede visible y respaldado en GitHub mientras se decide la reconciliación.
