# Arquitectura GastroCore — migración a Supabase multi-marca

_Resumen de lo hecho en esta sesión (11-sep-2026), para Diego y Mariluz._

## Qué encontramos (importante)

El plan original asumía un proyecto de Supabase vacío. **No lo estaba.**

El proyecto `comprasrocoto-dotcom's Project` (`pnotebuwhcuqapynjgrk`) ya tenía
el esquema completo de **una sola marca (Rocoto)**, con datos reales:

| Tabla | Filas | Qué es |
|---|---|---|
| insumos | 471 | Materia prima |
| recetas | 87 | Recetas |
| familias | 18 | Categorías de recetas/insumos |
| Costos Restaurantes | 385 | Tabla sin llave primaria, parece una importación cruda separada de "insumos" — **no se sabe con certeza si el frontend la usa** |
| subfamilias, subrecetas, unidades_medida, configuracion, usuarios, fichas_tecnicas, historial_recetas, precios_historicos, snapshot_detalle, snapshots_semanales | — | Resto del esquema, todas vacías o con datos de Rocoto |

Los IDs de estas tablas son texto tipo Sheets (`FAM-000001`, `INS-000001`,
`REC-000011`...), no UUID. Por eso el plan cambió: en vez de crear tablas
nuevas desde cero, **se extendió lo que ya existía**.

El proyecto también estaba **pausado** (plan gratuito) — se reactivó al
empezar este trabajo.

## Qué se decidió con Mariluz

1. **Unidades de medida son compartidas** entre las 4 marcas (no se les
   agregó marca_id).
2. **Un Admin puede ver varias marcas a la vez** (marca_id = NULL en su
   usuario). Chef y Lector siempre están atados a una sola marca.
3. **El recetario público se sirve una marca a la vez**, por URL
   (`/recetario/[marca]`).
4. La marca de los datos que ya existían se llama **"Rocoto"**.
5. Tablas dudosas ("Costos Restaurantes", precios_historicos,
   snapshot_detalle, snapshots_semanales): se tratan como activas por
   seguridad (se les agrega marca_id igual que al resto) hasta confirmar
   con quien tenga el repo de Next.js si el frontend las usa.

## Qué se aplicó (ya corrió en producción, 11-sep-2026)

Las tres migraciones de abajo **ya se ejecutaron** contra la base de datos
real y se verificaron después de correr: los conteos de filas quedaron
intactos (471 insumos, 87 recetas, 18 familias, 385 en "Costos
Restaurantes", todos con `marca_id` = Rocoto) y las vistas públicas
responden correctamente.

Un hallazgo importante durante la verificación: la tabla
`ingredientes_receta` tiene **0 filas**. Hay 87 recetas pero ninguna tiene
todavía su detalle de ingredientes cargado en Supabase — probablemente ese
detalle solo exista hoy en Google Sheets. No es un problema de la
migración, es un hueco de datos a revisar antes de depender del recetario
público para mostrar ingredientes.

Migraciones aplicadas, en `supabase/migrations/`:

- **0001_esquema_multi_marca.sql** — crea la tabla `marcas`, inserta la fila
  "Rocoto", y agrega la columna `marca_id` a las 13 tablas operativas que ya
  existían (con backfill automático: todo lo que ya había pasa a ser de
  Rocoto). También corrige un problema técnico de la tabla "Costos
  Restaurantes" (no tenía llave primaria).
- **0002_rls_multi_marca.sql** — activa Row Level Security en todas esas
  tablas: cada fila solo es visible para su propia marca (o para un Admin
  multi-marca). Es la misma idea de "cada restaurante solo ve lo suyo", pero
  aplicada directamente en la base de datos, no solo en el código.
- **0003_recetario_publico.sql** — crea dos vistas de solo lectura
  (`recetario_publico` y `recetario_publico_ingredientes`) que NO incluyen
  ninguna columna de costo, precio o margen. El endpoint público
  `/recetario/[marca]` debe leer de ahí, nunca de las tablas completas.

Al aplicar 0002 apareció un error real de sintaxis (`for insert, update,
delete` no es válido en Postgres; la forma correcta es `for all`), ya
corregido en el archivo antes de este resumen.

## Qué falta (fuera del alcance de esta sesión)

Esta sesión trabajó **solo del lado de Supabase** — no hubo acceso al
repositorio de Next.js de GastroCore. Falta, siguiendo las fases del plan
original:

- **Fase 3** — reemplazar `lib/api/gastrocore.ts` por una capa que hable
  con Supabase (manteniendo los mismos nombres de función).
- **Fase 4** — cambiar el login para validar contra la tabla `usuarios` de
  Supabase (hoy está vacía y sin columna de contraseña) e incluir
  `marca_id` en la sesión. Para que las políticas RLS funcionen con
  llamadas que no usen la `service_role key`, hay que emitir un JWT con los
  claims `rol`, `marca_id` y `usuario_id` (ver comentario al inicio de
  `0002_rls_multi_marca.sql`).
- **Fase 5** — selector de marca en la UI para el Admin multi-marca.
- **Fase 6** — cambiar la ruta pública a `/recetario/[marca]`.
- **Fase 7** — apagar Apps Script una vez todo esté validado en producción.
- **Confirmar con quien tenga el repo** si "Costos Restaurantes",
  precios_historicos, snapshot_detalle y snapshots_semanales siguen en uso.
- **Definir las otras 3 marcas**: ¿tienen sus propias hojas de Sheets para
  migrar, o arrancan vacías y se cargan manualmente desde la app? El script
  `scripts/migrar-sheets-a-supabase.ts` quedó listo como esqueleto para el
  primer caso.
- **Definir el algoritmo de hash de contraseñas** para `usuarios.clave_hash`
  (no se agregó esa columna todavía porque no se confirmó con qué hash
  validar — hoy el login sigue pasando por Apps Script).

---

# Fases 3 y 6 — hechas en el repo (11-sep-2026)

_Continuación de lo anterior, ya del lado de Next.js. La Fase 4 (login) queda
pendiente a propósito: sigue bloqueada por la decisión del hash de contraseñas._

## Lo primero: el zip ya no existe

El trabajo de Supabase venía como `gastrocore-supabase-migracion.zip` en la raíz
del repo, sin desempaquetar. Ahora está donde debe estar:

- `supabase/migrations/` — las tres migraciones ya aplicadas en producción
- `scripts/migrar-sheets-a-supabase.ts` — el esqueleto para las otras 3 marcas
- `docs/migracion-supabase.md` — este archivo

## Fase 3 — capa de datos

La app importa la capa de datos desde `@/lib/api/gastrocore` en **29 archivos**.
Ninguno de esos 29 cambió. Lo que cambió es lo que hay detrás:

```
  lib/api/tipos.ts        Los 24 tipos del dominio. Una sola definición.
  lib/api/appsScript.ts   El cliente de siempre (antes era gastrocore.ts).
  lib/api/supabase.ts     El cliente nuevo. Mismas 41 funciones.
  lib/api/gastrocore.ts   Conmutador: elige uno de los dos.
```

El conmutador se maneja con `GASTROCORE_BACKEND` (`supabase` | `appsscript`).
**El valor por defecto es `appsscript`**: desplegar esta rama sin configurar
nada no cambia de base de datos. Volver atrás es una variable de entorno y un
redeploy, no un revert de código — que es lo que uno quiere cuando la base
tiene 471 insumos y 87 recetas de un restaurante que está operando.

Los dos backends exportan exactamente las mismas 41 funciones (verificado, sin
desajustes en ninguna dirección).

### El aislamiento por marca lo sostiene el código, no la base

La migración 0002 lo dejó escrito: mientras no exista la Fase 4, las llamadas
usan `SUPABASE_SERVICE_ROLE_KEY`, **que ignora RLS por diseño**. Así que RLS
todavía no está protegiendo nada en la práctica — es una segunda capa esperando
a que la Fase 4 le dé los claims.

Quien protege hoy es `lib/supabase/cliente.ts`: toda consulta a una tabla
operativa pasa por `porMarca(tabla, marcaId)`, que *lanza excepción* si el
`marca_id` viene vacío. Una query que se olvide del filtro no devuelve datos de
más: revienta.

### Los nombres de columna no coincidían

El esquema de Supabase y los tipos del frontend no usan los mismos nombres:

| frontend | Supabase |
|---|---|
| `Receta.unidad_rendimiento_id` | `recetas.unidad_rendimiento_codigo` |
| `IngredienteReceta.unidad_id` | `ingredientes_receta.unidad_codigo` |
| `Insumo.subfamilia` | no es columna: se resuelve por join |

Todo ese desajuste vive en **`lib/supabase/mapeo.ts`** y en ningún otro lado.

⚠ **Ese mapeo está deducido de las migraciones, no de la base real** — esta
sesión no tuvo credenciales de Supabase. Columnas como `insumos.referencia` o
`familias.centrocosto` se infirieron de los tipos del frontend y pueden
llamarse distinto.

Por eso existe `npm run verificar-esquema`: compara el mapeo contra la base de
verdad y dice exactamente qué no calza. **Correrlo es obligatorio antes de
poner `GASTROCORE_BACKEND=supabase`.**

### Lo que la Fase 3 NO migró

`getAnalytics`, `simularImpacto` y `generarSnapshot` siguen yendo a Apps Script,
marcadas con `PENDIENTE-FASE-3B`. No son lecturas de tabla: son un motor de
agregación (top movers, impacto en menú, alertas) que vive en Code.gs. Portarlo
sin acceso a la base ni a ese código habría producido KPIs plausibles pero no
verificables, que es peor que una costura visible.

`getSnapshots` y `getHistorialInsumoGrafica` **sí** salen ya de Supabase.

Consecuencia: `GASTROCORE_API_URL` y `GASTROCORE_API_TOKEN` siguen siendo
obligatorias aunque el backend principal sea Supabase.

## Fase 6 — recetario por marca

```
  /recetario              → si hay una sola marca activa, redirige a ella
                            (la cocina no aprende URL nueva); si hay varias,
                            muestra el selector
  /recetario/[marca]      → la carta de esa marca
  /recetario/[marca]/[id] → el detalle
```

Next.js no permite `[id]` y `[marca]` como hermanos, así que la ruta vieja
`/recetario/[id]` se movió a `/recetario/[marca]/[id]`.

**Los enlaces viejos siguen funcionando**: `/recetario/REC-000011` detecta que
el slug es un id de receta y redirige a la marca por defecto. Importa porque
esos enlaces están en el botón "👁 Ver como cocina" del admin y en cualquier QR
ya impreso en la cocina.

### La ganancia de seguridad real

El recetario viejo (`lib/recetario.ts`) le pide a Apps Script la receta
**entera**, con `costo_total`, `food_cost`, `precio_real` y `precio_sugerido`
incluidos, y confía en que el componente de galería no los pinte. O sea: los
márgenes de la carta viajaban al servidor de una vista pública, y bastaba un
cambio descuidado en el componente para exponerlos.

`lib/recetarioMarca.ts` lee de las vistas `recetario_publico*`, que no tienen
esas columnas. No es que se oculten: no existen en la respuesta.

Si algún día el recetario público necesita mostrar el precio de venta, lo
correcto es agregar **solo** `precio_real` a la vista en una migración 0004, no
leer de `recetas` desde ahí.

## Respondido: las tablas dudosas

La sesión anterior dejó pendiente "confirmar con quien tenga el repo". Revisado:

- `snapshots_semanales` y `snapshot_detalle` — **en uso** (`getSnapshots`,
  `/api/snapshots`, dashboard de Análisis).
- `precios_historicos` — **en uso** ("Ver historial de precios" y la gráfica de
  evolución). La Fase 3 además ya escribe ahí en cada cambio de coste.
- `Costos Restaurantes` (385 filas) — **sin una sola referencia** en todo el
  frontend. Candidata a borrar, previa confirmación de que no la use nadie más.

## Cómo activar esto

1. `npm install` (entran `@supabase/supabase-js` y `server-only`).
2. Llenar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
   `SUPABASE_SERVICE_ROLE_KEY`.
3. `npm run verificar-esquema` → **tiene que pasar en verde.**
4. Recién ahí `GASTROCORE_BACKEND=supabase` + redeploy.
5. Si algo sale mal: `GASTROCORE_BACKEND=appsscript` + redeploy.

## Lo que sigue bloqueado

- **Fase 4** — login contra `usuarios` (hoy vacía, sin columna de contraseña) y
  JWT con los claims `rol`, `marca_id`, `usuario_id`. Falta decidir el algoritmo
  de hash. Mientras tanto `GASTROCORE_MARCA` fija la marca por variable de
  entorno: la app es de una marca a la vez aunque la base soporte cuatro.
- **Fase 5** — selector de marca en la UI. Depende de la 4.
- **`ingredientes_receta` sigue en 0 filas.** Hay 87 recetas sin detalle de
  ingredientes en Supabase. Con `GASTROCORE_BACKEND=supabase` las fichas y el
  recetario público saldrían **sin ingredientes**. Este es el bloqueante real
  para activar Supabase, y no se arregla con código.
