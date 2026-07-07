# GastroCore — Costeo de recetas y recetario de cocina · Restaurantes Rocoto

Sistema de gestión gastronómica: costeo de recetas en tiempo real con la fórmula de
merma por rendimiento (gross-up, igual que HioPOS), análisis de variación de precios de
insumos con impacto en el menú, fichas técnicas con fotos, y recetario público en línea
para el equipo de cocina.

- **Producción:** https://gastro-core.vercel.app
- **Recetario público (cocina, sin login):** https://gastro-core.vercel.app/recetario

---

## 1. Arquitectura general

```
┌──────────────────────────┐   POST { mode, resource,   ┌──────────────────────────┐
│  FRONTEND                │       action, token }      │  BACKEND                 │
│  Next.js 14 App Router   │ ─────────────────────────► │  Google Apps Script      │
│  TypeScript + Tailwind   │                            │  Code.gs (v7.2)          │
│  Deploy: GitHub → Vercel │ ◄───────────────────────── │  Web App /exec           │
└──────────────────────────┘   { ok, data, meta }       └────────────┬─────────────┘
                                                                     │
                                                        ┌────────────▼─────────────┐
                                                        │  Google Sheets           │
                                                        │  "Base de Costos"        │
                                                        │  (única fuente de verdad)│
                                                        └──────────────────────────┘
                                                        Fotos: carpeta de Google Drive
```

Principios de diseño:

1. **El frontend jamás toca el Sheet.** Todo pasa por la API de Apps Script con un token
   que solo existe en el servidor de Vercel. Las lecturas viajan por POST
   (`{ mode:'read', ... }`) para que el token nunca quede en una URL ni en logs.
2. **Una sola fuente de verdad.** El Sheet es la base de datos; no hay estado duplicado.
3. **Borrado lógico.** Nada se elimina físicamente (`activo=FALSE`), con una única
   excepción documentada (§5, purga de `_ELIMINADO`).
4. **Capa de datos desacoplada.** `Repo_` abstrae el acceso a Sheets; migrar a Postgres
   el día que haga falta no toca controladores ni el motor de costeo.

## 2. Backend (`Code.gs` v7.2)

### 2.1 Router HTTP

`doGet`/`doPost` → `handleRequest_`. Cada petición trae `resource` (la "tabla" o
agregado) y `action`. Acciones: `read` (con `id` opcional), `create`, `update`,
`delete` (lógico), `setactivo`, `restaurar`, `simular`, `snapshot`, `login`,
`guardar`, `subirfoto`, `renombrar`.

Recursos: `insumos · recetas · subrecetas · catalogo · dependencias · analytics ·
snapshots · ingredientes · familias · subfamilias · unidades · conversiones ·
proveedores · usuarios · preciosHistoricos · configuracion · historialRecetas ·
fichas · recetario · configfotos · bootstrap`.

### 2.2 Concurrencia (v5/v6)

- **Lock global de escritura:** toda mutación toma `LockService` (espera máx. 20 s).
  Dos admins guardando a la vez no pueden corromper contadores ni dejar recálculos a
  medias. La bandera `LOCK_GLOBAL_ACTIVO_` evita el deadlock con `nextId_` (LockService
  no es reentrante).
- **Caché de tablas por ejecución (`TABLA_CACHE_`):** cada petición lee cada hoja UNA
  sola vez; consistencia por write-through (create agrega, update muta el registro
  cacheado y escribe la fila completa en un solo `setValues`).

### 2.3 Motor de costeo (v7.2 — fórmula de merma por rendimiento)

```
factorMerma(m)   = 1 / (1 − m/100)          ← gross-up, igual que HioPOS y GFM
costo_línea      = coste_insumo × cantidad_neta × factorMerma(merma_ingrediente)
costo_total      = Σ costo_línea × factorMerma(merma_global) × (1 + desvío/100)
costo_porción    = costo_total / rendimiento
precio_sugerido  = (costo_porción / 0.35) × 1.08     ← FC objetivo 35% · impoconsumo 8%
food_cost_real   = costo_porción / (precio_venta / 1.08)
```

Reglas: la merma es pérdida física sobre lo BRUTO manipulado (por eso divide); el
desvío es un recargo porcentual (por eso multiplica). Merma ≥ 95% se rechaza ANTES de
escribir nada. Subrecetas anidadas se costean recursivamente con detección de ciclos y
memoización; cambiar el coste de un insumo recalcula EN CASCADA todas las recetas que
lo usan (directa o indirectamente) y registra el histórico de precio.

### 2.4 Versionado y auditoría

Cada creación/edición/restauración de receta escribe en `HistorialRecetas`: una fila
maestra con `version` incremental y un `snapshot` JSON completo (receta + ingredientes),
más una fila por cada campo modificado (diff automático). `restaurar` reconstruye la
receta desde cualquier snapshot. `recalcularTodo()` recalcula el menú completo dejando
rastro auditable.

### 2.5 Caché compartido entre peticiones (v7)

Las respuestas caras (`catalogo`, `analytics`, `recetario`, `bootstrap`) se guardan en
`CacheService` y sobreviven entre peticiones e instancias de Vercel. Valores grandes se
parten en trozos de 90 KB. Invalidación por VERSIÓN: cualquier mutación sube
`CACHE_VER` y todas las claves viejas mueren solas — sin listas de claves que mantener.

### 2.6 Recetario y fichas (v4)

`fichas` hace upsert por `receta_id`; editar la ficha NO dispara recálculos ni
versiones (números y narrativa son mundos separados). `subirFoto` recibe base64, guarda
en la carpeta de Drive configurada (clave `FOTOS_FOLDER_ID` en `Configuracion`), manda
la foto anterior a la papelera y devuelve la URL estable
`lh3.googleusercontent.com/d/ID` (ancho bajo demanda con `=wNNN`). `recetario` es un
agregado de solo lectura que arma TODO lo que la vista de cocina necesita en una llamada.

### 2.7 Funciones de setup y mantenimiento (ejecutar desde el editor, botón ▶)

| Función | Cuándo | Qué hace |
|---|---|---|
| `setupBase()` | Una vez (hecho) | Crea hojas del esquema y normaliza el maestro |
| `configurarToken()` | Una vez / al rotar | Genera `API_TOKEN` en Script Properties |
| `setupRecetario()` | Una vez (hecho) | Hoja `FichaTecnica` + carpeta Drive (autoriza Drive) |
| `instalarTriggerSemanal()` | Una vez (hecho) | Lunes 6 AM: snapshot de costos + purga |
| `importarPreparaciones()` | Opcional | Importa fichas del recetario viejo (idempotente, nunca sobrescribe) |
| `recalcularTodo()` | Tras desplegar v7.2 | Recalcula el menú completo con la fórmula corregida |
| `purgarEliminados()` | Automático (trigger) | Borra físicamente filas `_ELIMINADO` |
| `limpiarConfiguracion()` | Puntual | Limpieza de datos basura detectados en auditoría |

## 3. Frontend (Next.js 14, App Router)

### 3.1 Mapa de rutas

| Ruta | Tipo | Acceso | Descripción |
|---|---|---|---|
| `/recetario`, `/recetario/[id]` | Server + client | **Público** | Galería Rocoto y detalle modal, sin costos |
| `/login` | Client | Público | Email + clave contra la hoja `Usuarios` |
| `/` , `/insumos`, `/analisis` | Server (SSR) | Sesión | Dashboard, maestro con histórico, BI |
| `/recetas`, `/recetas/resumen` | Client | Sesión | Listado con KPIs y panel ejecutivo |
| `/recetas/nueva` | Client | Sesión (guarda: Admin) | Editor con costeo en vivo (carga vía `bootstrap`) |
| `/recetas/[id]`, `/[id]/trazabilidad`, `/[id]/ficha` | Mixto | Sesión | Detalle, historial de versiones, ficha técnica |
| `/subrecetas`, `/subrecetas/nueva`, `/recetas/familias` | Client | Sesión | Preparaciones base y clasificación |
| `/usuarios`, `/proveedores`, `/configuracion` | Client | Sesión (muta: Admin) | Administración |

### 3.2 Sesión y seguridad

`lib/auth.ts` firma la cookie `gc_session` con HMAC-SHA256 (Web Crypto — compatible con
el runtime Edge del middleware; por eso NO importa `next/headers`). Payload `{u, r, exp}`,
12 h. `middleware.ts` (v4.1): públicos solo `/login`, su API y `/recetario`; el resto
exige cookie válida, y todo POST/PUT/DELETE de `/api/*` exige rol **Admin**. La columna
`clave` jamás sale del backend. `lib/session.ts` (`getUsuario/getRol/esAdmin`) lee la
sesión en Server Components y route handlers.

### 3.3 Capa de datos y las TRES capas de caché

`lib/api/gastrocore.ts` es el único cliente de la API (server-only). El sistema apila
tres cachés — cada una cubre el punto ciego de la anterior:

| Capa | Dónde vive | TTL | Cubre |
|---|---|---|---|
| 1. `readCache` + stale-while-revalidate | Memoria de la instancia Vercel | 45 s – 5 min por recurso | Navegación repetida: respuesta en 0 ms; vencido el TTL sirve lo viejo YA y refresca en background |
| 2. `CacheService` | Dentro de Google | 2–5 min | Arranques en frío de Vercel: hasta la primera visita del día responde <1 s |
| 3. `unstable_cache` | Next (recetario público) | 5 min | La galería de cocina no toca Apps Script por cada visita |

Reglas de oro de la capa 1: **jamás se cachean respuestas de error** (`ok:false`), toda
mutación borra el caché completo (`limpiarCacheLecturas`), y peticiones idénticas
simultáneas se deduplican (`enVuelo`). `/api/bootstrap` entrega los 4 catálogos del
editor en UNA llamada.

## 4. Modelo de datos (Google Sheets como base de datos relacional)

Cada pestaña es una tabla; la fila 1 son las columnas; los IDs con prefijo son las
llaves primarias (`INS-000123`, `REC-000011`, `FT-000001`), generadas con contador
atómico en `PropertiesService`.

```
Familias (tipo: insumo|receta|subreceta)
   └─< Subfamilias
          ├─< INSUMOS (maestro: referencia, articulo, unidad, coste)
          │      └─< PreciosHistoricos (cada cambio de coste, con motivo y usuario)
          └─< Recetas (costos calculados, food cost, precios)
                 ├─< IngredientesReceta (tipo_item: insumo|subreceta → item_id)
                 ├─── FichaTecnica (1:1, narrativa de cocina + foto)
                 └─< HistorialRecetas (versiones con snapshot JSON + diffs)

UnidadesMedida · Conversiones · Proveedores · Usuarios (email, rol, clave)
Configuracion (clave/valor: FOTOS_FOLDER_ID, …)
SnapshotsSemanales ─< SnapshotDetalle (foto semanal de costos del maestro)
```

Detalles clave del modelo en §5 y en el chat de arquitectura del proyecto.

## 5. Convenciones y particularidades

- **`_ELIMINADO`:** al editar los ingredientes de una receta, las líneas viejas se
  marcan `receta_id='_ELIMINADO'` (no se borran en caliente para no mover `_fila` de
  otras). El trigger semanal las purga físicamente — única excepción al borrado lógico,
  posible porque la auditoría real vive en los snapshots de `HistorialRecetas`.
- **Polimorfismo de ingredientes:** `IngredientesReceta.tipo_item` decide si `item_id`
  apunta a INSUMOS o a Recetas (subreceta). El costo unitario de una subreceta es su
  `costo_total / rendimiento`, recursivo.
- **Herencia del sistema viejo:** existen ~124 insumos "SUB. …" (preparaciones con
  costo fijo digitado) en subfamilias SUB-RECETAS del maestro. Funcionan, pero NO se
  recalculan al cambiar sus ingredientes reales — candidatos a migrar gradualmente a
  subrecetas nativas.
- **`unidad_id` en IngredientesReceta** guarda el código (`GRAMOS`) y no el ID
  (`UND-xxxxx`) — inconsistencia cosmética conocida, nada la lee mal.
- **Configuracion** no tiene PK `id`: se accede con `getConfig_/setConfig_` directos.

## 6. Variables de entorno y despliegue

| Variable (Vercel) | Descripción |
|---|---|
| `GASTROCORE_API_URL` | URL `/exec` de la implementación de Apps Script |
| `GASTROCORE_API_TOKEN` | Mismo valor que `API_TOKEN` en Script Properties |
| `AUTH_SECRET` | Secreto HMAC de las cookies de sesión |

⚠️ Los dos rituales que no perdonan: en Vercel, cambiar una variable exige **Redeploy**;
en Apps Script, cambiar `Code.gs` exige **Implementar → Gestionar implementaciones →
Nueva versión** (misma URL). Y el botón ▶ ejecuta la función seleccionada en el
desplegable, no la que está visible en pantalla.

## 7. Pendientes conocidos

Rotar `API_TOKEN`/`AUTH_SECRET`/claves iniciales · migración gradual de insumos "SUB."
a subrecetas nativas · validación unidad ingrediente = unidad insumo (hoy por
convención) · respaldo mensual del Sheet fuera de Google · integración
agent-factura → coste de insumos · ingeniería de menú (food cost × ventas HioPOS).
