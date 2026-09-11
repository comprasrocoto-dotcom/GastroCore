# GastroCore — Arquitectura técnica (v10.0)

## 1. El flujo de datos

**Sheets es la única fuente de verdad** (14 hojas). Apps Script expone una API HTTP (`doPost`) con un router `CONTROLADORES` por recurso: `insumos`, `recetas`, `subrecetas`, `familias`, `fichas`, `recetario`, `analytics`, `parametros`, `usuarios`, `historial`, `snapshots`. Cada controller implementa `list / getById / create / update / setActivo` (+ acciones propias como `actualizarinsumo` del puente o `restaurar` de snapshots).

## 2. Costeo (gross-up)

- **Merma divide:** cantidad real = cantidad ÷ (1 − merma%). Servir 100 g con 10% de merma cuesta como 111 g.
- **Desvío multiplica** el costo de ingredientes.
- **Precio sugerido** = (costo porción ÷ FC objetivo) × (1 + impuesto). FC objetivo global con excepciones por familia (`FC_POR_FAMILIA` en Configuración).
- Guardar parámetros con cambios ejecuta `recalcularTodo()` y sincroniza `margen_objetivo` en las 86+ recetas.

## 3. Subrecetas: maestro-calculadora (v9.0 → v10)

Toda preparación vive en **Insumos** como artículo `SUB.` — la subreceta (hoja `SubRecetas`) es su **calculadora**: ingredientes (en `IngredientesReceta`, columna `subreceta_id`) + rendimiento → `costo_unitario`. **EL PUENTE** (`actualizarinsumo`) empuja ese costo al insumo maestro con: registro en `PreciosHistoricos` ("Actualizado desde subreceta X"), y recálculo en cascada de las recetas que lo usan. Desde v9.11 el puente es un **botón consciente** dentro de la subreceta (sin pregunta al guardar). Las fichas técnicas de subrecetas comparten la hoja `FichaTecnica` (`receta_id = SUBR-…`), sin foto por diseño.

## 4. Recetario público

`construirRecetario_()` arma el agregado: recetas activas por familia (con `centro_costo` de la familia) + subrecetas activas bajo la categoría **`SUB. RECETAS`** (ingredientes indexados por `subreceta_id`, `foto_url` forzada vacía, sin precios). El **estilo** (`RECETARIO_TEMA` en Configuración, lista blanca de 6 ids) viaja en `parametros` y se aplica en `lib/temasRecetario.ts` → banda con degradado, fondo, títulos, bordes y placeholder.

## 5. Las tres capas de caché

1. **Backend (CacheService):** el recetario y catálogos se cachean por `CACHE_VER`; toda escritura vía `Repo_` incrementa la versión → invalidación automática.
2. **Datos en Vercel:** `unstable_cache` con `tags:['recetario']`, revalidate 300 s. Guardar ficha/foto/parámetros ejecuta `revalidateTag('recetario')` → purga inmediata.
3. **TTL en memoria** (`lib/api/gastrocore.ts`): lecturas con TTL por recurso (catálogo 120 s, etc.) y *stale-while-revalidate*; **toda mutación exitosa hace `readCache.clear()`** (v9.13.1).
Las páginas del recetario usan `dynamic = 'force-dynamic'`: render por petición sobre datos cacheados — tras una purga, el primer refresco ya trae lo nuevo.

## 6. Seguridad y auditoría

- Token de API solo en el servidor (nunca en el cliente); rotación desde Configuración (se muestra una vez).
- Roles servidor: Admin (todo) / Chef (recetas, subrecetas, fichas, fotos, puente) / Lector (solo ver).
- `HistorialRecetas` con snapshot JSON completo por versión → diff y **restaurar**. `SnapshotsSemanales` (trigger lunes 6 AM, instalar a mano) alimenta la evolución del Análisis.
- Fechas como texto `yyyy-MM-dd` (apóstrofo) donde aplica; `LockService` en escrituras.

## 7. Lecciones de guerra (para el mantenedor)

- Parches por reemplazo **siempre con asserts** — un replace que no encuentra su ancla falla en silencio.
- El código es **posicional**: renombrar cabeceras ok, mover columnas jamás.
- `/recetas` y los editores son client components: `curl` no ejecuta JS.
- El detalle del recetario vive en `DetalleReceta` (el modal es solo el marco).
- El fósil `getSubreceta→getReceta` durmió desde v9.0 hasta la primera subreceta real: **los bugs dormidos despiertan cuando el sistema se usa.**

## 8. Migración a Supabase multi-marca (en curso, desde 11-sep-2026)

_Resumen en español simple, para Diego y Mariluz. El detalle técnico completo de las migraciones SQL vive en `supabase/migrations/`._

**Por qué:** pasar de Google Sheets a una base de datos real (Postgres/Supabase) y agregar soporte para 4 marcas compartiendo una sola base, cada una viendo solo lo suyo.

**Lo que ya se hizo (lado Supabase, sesión 1):**

- El proyecto de Supabase (`pnotebuwhcuqapynjgrk`) ya tenía los datos reales de
  la marca **Rocoto** migrados desde antes (471 insumos, 87 recetas, 18
  familias). No estaba vacío como se pensaba al empezar.
- Se agregó una tabla `marcas` y una columna `marca_id` a las 13 tablas
  operativas, con todo lo existente asignado a "Rocoto" automáticamente.
- Se activó seguridad a nivel de base de datos (Row Level Security): cada fila
  solo es visible para su propia marca, o para un Admin que ve varias marcas
  a la vez.
- Se crearon dos vistas públicas de solo lectura para el recetario de cocina
  (`recetario_publico` y `recetario_publico_ingredientes`) que **nunca**
  incluyen costos, precios ni márgenes — el recetario público solo debe leer
  de ahí.
- **Hallazgo pendiente de resolver:** la tabla `ingredientes_receta` tiene 0
  filas en Supabase. Hay 87 recetas pero ninguna tiene todavía su detalle de
  ingredientes ahí — ese detalle hoy solo vive en Google Sheets. Hay que
  migrarlo antes de que el recetario público (Fase 6) pueda mostrar
  ingredientes correctamente.

**Lo que se confirmó revisando el código de este repo (sesión 2, búsqueda por
grep en `lib/api/gastrocore.ts` y en todo `app/`/`lib/`):**

- `precios_historicos` **sí se usa** — lo lee `getHistorialInsumo()` (llama al
  recurso `preciosHistoricos` de Apps Script).
- `snapshots_semanales` **sí se usa** — lo lee `getSnapshots()` (recurso
  `snapshots`).
- `Costos Restaurantes` y `snapshot_detalle` **no tienen ninguna referencia**
  en el código de Next.js (`.ts`/`.tsx`). Todo indica que no están en uso hoy,
  pero se dejaron con `marca_id` igual por seguridad, a confirmar con Diego.

**Cómo funciona hoy la sesión de usuario (importante para las fases que
faltan):** el login no usa Supabase Auth — es una cookie propia firmada con
HMAC (`lib/auth.ts`, `AUTH_SECRET`), y hoy valida el email/clave contra Apps
Script (`app/api/auth/login/route.ts`). La sesión guarda usuario, rol y
(desde v10.1) el email, pero todavía no guarda `marca_id`. Para que las
reglas de seguridad de Supabase (RLS) funcionen fuera de la `service_role
key`, hace falta emitir un JWT con `rol`/`marca_id`/`usuario_id` — ese es el
trabajo de la Fase 4.

**Lo que falta (fases 3 a 6, este repo):**

1. **Fase 3** — Reemplazar `lib/api/gastrocore.ts` por `lib/api/supabase.ts`
   (mismas funciones, mismos nombres), leyendo directo de Postgres con la
   `service_role key` y filtrando cada consulta por `marca_id` a mano.
2. **Fase 4** — Validar login contra la tabla `usuarios` de Supabase, guardar
   `marca_id` en la sesión, y emitir el JWT para RLS.
3. **Fase 5** — Selector de marca en la UI, solo para el Admin que ve varias
   marcas.
4. **Fase 6** — Cambiar el recetario público a `/recetario/[marca]`, leyendo
   solo de las vistas públicas. Bloqueado hasta resolver el hueco de
   `ingredientes_receta`.

**Preguntas todavía abiertas para Diego/Mariluz:**

- ¿Las otras 3 marcas nuevas tienen sus propias hojas de Google Sheets para
  importar, o arrancan vacías y se cargan desde la app?
- ¿Qué algoritmo de hash usar para `usuarios.clave_hash` en Supabase? (hoy
  esa columna no existe todavía; el login sigue pasando por Apps Script
  mientras tanto).

Apps Script y Google Sheets **no se tocan** durante esta migración — siguen
siendo el respaldo hasta que todo esté validado en producción (Fase 7, fuera
de alcance por ahora).
