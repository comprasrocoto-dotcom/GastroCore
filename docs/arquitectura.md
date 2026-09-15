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

**Decisiones confirmadas con Mariluz (11-sep-2026, sesión 2):**

- Las otras 3 marcas nuevas **arrancan vacías**: no tienen hojas de Sheets
  propias que importar. Se cargan insumos/recetas manualmente desde la app
  una vez esté lista. El script `scripts/migrar-sheets-a-supabase.ts` queda
  como referencia pero no hace falta completarlo para esto.
- El hash de `usuarios.clave_hash` (Fase 4) será **bcrypt**. Como las claves
  actuales viven en texto plano en Sheets, cada usuario tendrá que
  restablecer su clave una vez, al momento del cambio.

**Hallazgo de seguridad encontrado y corregido en esta sesión (0004):**

Al verificar el estado real de Supabase antes de escribir código nuevo se
encontraron dos vistas que **ya existían antes de esta migración**
(`v_insumos_completos`, `v_recetas_completas` — no están en el código de
Next.js, no las creamos nosotros). Eran propiedad de `postgres` y el rol
público `anon` tenía permiso de leer **y también insertar/editar/borrar**
datos a través de ellas — como la vista corre con los permisos de su dueño,
esto ignoraba por completo las reglas de "cada marca ve solo lo suyo" (RLS).
En la práctica, cualquiera con la llave pública del proyecto (la misma que
va en el navegador) podía ver los costos de todos los insumos/recetas de
todas las marcas, y hasta modificar o borrar filas directamente.

Se corrigió de inmediato con confirmación de Mariluz: migración
`0004_revocar_acceso_publico_vistas.sql` le quita a `anon`/`authenticated`
todo acceso a esas dos vistas. Ya se aplicó en producción y se verificó que
el acceso quedó en cero. Las vistas siguen existiendo (por si algo interno
las usa con la service_role key), solo se les quitó el acceso público.

Apps Script y Google Sheets **no se tocan** durante esta migración — siguen
siendo el respaldo hasta que todo esté validado en producción (Fase 7, fuera
de alcance por ahora).

### Corrección importante: cuánto de la base de datos está realmente migrado

Antes de escribir la capa de datos de la Fase 3 se volvió a verificar,
tabla por tabla, cuántas filas tiene cada una hoy en Supabase (11-sep-2026).
El resumen anterior solo mencionaba `ingredientes_receta` como hueco — la
revisión completa muestra que el hueco es más grande:

| Tabla | Filas | Estado |
|---|---|---|
| marcas | 1 | ✅ |
| familias | 18 | ✅ |
| subfamilias | 18 | ✅ |
| insumos | 471 | ✅ |
| recetas | 87 | ✅ (solo los datos base: nombre, costo, precio — ver abajo) |
| unidades_medida | 4 | ✅ |
| precios_historicos | 7 | ⚠️ parcial |
| **subrecetas** | **0** | ❌ vacía |
| **ingredientes_receta** | **0** | ❌ vacía |
| **fichas_tecnicas** | **0** | ❌ vacía |
| **historial_recetas** | **0** | ❌ vacía |
| **configuracion** (parámetros: FC objetivo, impuesto, etc.) | **0** | ❌ vacía |
| **usuarios** | **0** | ❌ vacía |
| snapshot_detalle, snapshots_semanales | 0 | ❌ vacías (snapshots_semanales sí se usa en la app, hay que migrarla) |
| Costos Restaurantes | 385 | sin uso confirmado en el código |

En resumen: las 87 recetas existen en Supabase, pero **sin sus ingredientes,
sin ficha técnica, sin historial de cambios**. Tampoco hay parámetros de
negocio (Food Cost objetivo, impuesto) ni usuarios — el login y la
configuración no podrían funcionar contra Supabase todavía.

**Esto cambia el plan de la Fase 3:** en vez de reemplazar `lib/api/gastrocore.ts`
de una sola vez, se migra recurso por recurso, empezando por los que ya
tienen datos reales en Supabase (insumos, familias, subfamilias, unidades,
catálogo) y dejando temporalmente en Apps Script los que dependen de tablas
vacías (subrecetas, fichas técnicas, historial, parámetros, usuarios,
analytics) hasta completar su migración de datos real.

Para completar esa migración de datos correctamente (sin inventar valores)
hace falta llamar a la misma API de Apps Script que ya usa la app hoy
(`GASTROCORE_API_URL` / `GASTROCORE_API_TOKEN`, ya configuradas en
producción) para traer los datos reales de Sheets y escribirlos en Supabase
— así se completa `scripts/migrar-sheets-a-supabase.ts` con los datos
verdaderos en vez de un esqueleto. Para eso, y para poder probar
`lib/api/supabase.ts` contra la base real, esta sesión necesita las 4
variables de entorno que la app ya usa en producción (no son nuevas, ya
existen en Vercel): `GASTROCORE_API_URL`, `GASTROCORE_API_TOKEN`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 9. Chequeo de "qué falta para el despliegue" (15-sep-2026)

_Resumen en español simple. Este chequeo se hizo a pedido de Mariluz para revisar juntos el estado antes de desplegar. No se cambió nada en producción — es solo una foto del estado actual._

**Lo bueno: la app en vivo (`gastro-core.vercel.app`) sigue intacta y segura.**
El último commit desplegado en producción (`13565e9`, rama `main`) no tiene
ni una línea de código de Supabase todavía — sigue funcionando 100% contra
Google Sheets, tal como siempre. Solo se sumó al repo un archivo de ejemplo
(`.env.example`) con la lista de variables que hará falta configurar más
adelante, nada más. El arreglo de seguridad de la sección 8 (quitarle acceso
público a las dos vistas viejas) se volvió a verificar hoy directo en la
base de datos y **sigue en cero accesos** — el hallazgo de seguridad sigue
corregido.

**Lo que se descubrió: hay dos ramas con el mismo nombre en GitHub, con
trabajo distinto en cada una.** Mientras yo avanzaba en esta sesión (el
script de migración de datos, la documentación del hueco de datos), en
paralelo otra sesión de Claude hizo un trabajo más completo de la Fase 3
(capa de datos) y la Fase 6 (recetario público por marca), y logró subirlo a
GitHub con el mismo nombre de rama (`migracion-supabase-fase-3-6`). Esa otra
versión ya tiene un "interruptor" (`GASTROCORE_BACKEND=appsscript|supabase`)
para poder probar Supabase sin arriesgar producción — es un buen diseño — y
ya se armó una vista previa de esa rama en Vercel que compiló sin errores.
Pero mi rama local (con el arreglo de seguridad documentado y el script de
migración de datos) nunca pudo subirse a GitHub por un problema de permisos
de esta sesión (ver más abajo), así que las dos versiones nunca se juntaron.
**Antes de avanzar hace falta decidir cómo se combinan ambas** — lo ideal es
quedarse con la base más completa de la otra sesión (interruptor + Fase 6) y
sumarle el arreglo de seguridad y la documentación honesta del hueco de
datos que hizo esta rama. Esa decisión de reconciliar no se tomó todavía.

**Se encontraron 3 errores concretos en el mapeo de columnas de la otra
rama, ya confirmados contra la base de datos real de hoy** (antes de
corregirlos hacía falta confirmarlos con datos frescos, y ya se hizo). Si se
activara `GASTROCORE_BACKEND=supabase` hoy sin corregir esto, estas 3 cosas
se romperían:

| Archivo dice que existe la columna... | Columna real en Supabase | Tabla afectada |
|---|---|---|
| `unidad` | `subarticulo` | `insumos` |
| `familia_id` (no existe) | — | `subrecetas` |
| `costo_porcion` | `costo_unitario` | `subrecetas` |
| `descripcion` (no existe) | — | `fichas_tecnicas` |

Son correcciones puramente técnicas (nombres de columna mal escritos), no
implican ninguna decisión de negocio — se pueden corregir en cuanto se
decida qué rama es la base a usar.

**Los datos siguen incompletos, verificado de nuevo hoy con conteos
frescos** (no cambió nada respecto a la sección 8, se confirma que sigue
igual):

| Tabla | Filas hoy |
|---|---|
| marcas | 1 |
| familias | 18 |
| subfamilias | 18 |
| insumos | 471 |
| recetas | 87 |
| unidades_medida | 4 |
| precios_historicos | 7 |
| subrecetas | 0 |
| ingredientes_receta | 0 |
| fichas_tecnicas | 0 |
| historial_recetas | 0 |
| configuracion | 0 |
| usuarios | 0 |
| snapshots_semanales | 0 |

**Lo que bloquea seguir avanzando ahora mismo:**

1. **Esta sesión no puede subir código a GitHub.** El intento de `git push`
   de hoy dio exactamente el mismo error de permisos que en los intentos
   anteriores, incluso después de varios días y de que Mariluz ajustó los
   permisos de la app de GitHub. Confirma lo que ya se le había dicho: hace
   falta abrir una sesión nueva (no seguir reintentando en esta) para que el
   push funcione. Mientras tanto, los 4 commits de esta rama (arreglo de
   seguridad documentado, mapa de datos real, script de migración) quedan
   guardados localmente, listos para subir en cuanto se pueda.
2. **Siguen faltando las credenciales** (`SUPABASE_SERVICE_ROLE_KEY`,
   `GASTROCORE_API_TOKEN`, etc.) para poder correr el script de migración de
   datos reales y probar `lib/api/supabase.ts` contra la base. Sin esto no se
   puede migrar `fichas_tecnicas`, `historial_recetas`, `configuracion` ni
   `usuarios`.

**Conclusión — no está listo para desplegar todavía.** Producción sigue
segura y sin cambios. Antes de poder activar Supabase en la app real hacen
falta, en este orden: (1) una sesión nueva que pueda subir código a GitHub,
(2) decidir cómo se combinan las dos ramas divergentes, (3) corregir los 3
errores de columnas, (4) las credenciales para terminar de migrar los datos
que todavía están vacíos, y (5) recién ahí conectar cualquier Route Handler
a Supabase — nunca antes, para no mostrar datos a medias en la app real.
