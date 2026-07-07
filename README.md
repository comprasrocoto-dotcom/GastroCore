# GastroCore — Costeo de recetas y recetario de cocina · Rocoto

Sistema de gestión gastronómica de **Restaurantes Rocoto**: costeo de recetas en tiempo
real, análisis de variación de precios de insumos, y recetario en línea para el equipo
de cocina.

- **Producción:** https://gastro-core.vercel.app
- **Recetario público (cocina, sin login):** https://gastro-core.vercel.app/recetario

## Arquitectura

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  Next.js 14 (App Router)│  POST  │  Google Apps Script      │
│  TypeScript + Tailwind  │ ─────► │  (Code.gs, API JSON)     │
│  Deploy: GitHub→Vercel  │  token │  Web App /exec           │
└─────────────────────────┘        └───────────┬──────────────┘
                                               │
                                   ┌───────────▼──────────────┐
                                   │  Google Sheets           │
                                   │  "Base de Costos"        │
                                   │  (única fuente de verdad)│
                                   └──────────────────────────┘
                                   Fotos: carpeta de Google Drive
```

- El frontend **nunca** habla con el Sheet directamente: todo pasa por la API de Apps
  Script, autenticada con un token que solo vive en el servidor de Vercel.
- Las **lecturas** viajan por POST (`{ mode:'read', resource, token, params }`) para que
  el token jamás quede en una URL.
- **Borrado lógico** en todas las entidades (`activo=FALSE`); nada se elimina físicamente,
  con una única excepción documentada (ver Mantenimiento).

## Módulos

| Ruta | Qué es | Acceso |
|---|---|---|
| `/recetario` | Galería de cocina con tema Rocoto: tarjetas, buscador, modal con ingredientes (sin costos), preparación y emplatado numerados | **Público** |
| `/recetas` | Recetas de carta: ingredientes, costo total/porción, food cost, precio sugerido, historial con versiones y restauración | Sesión |
| `/recetas/[id]/ficha` | **Ficha técnica**: descripción, preparación, emplatado, notas, tiempo, gramaje y foto (se sube desde aquí a Drive) | Sesión (guarda: Admin) |
| `/subrecetas` | Preparaciones base costeadas por unidad de rendimiento, anidables en recetas | Sesión |
| `/insumos` | Maestro de insumos con historial de precios; cambiar un coste recalcula en cascada las recetas afectadas | Sesión |
| `/analisis` | BI de variación de costos: top aumentos, impacto en el menú, alertas de food cost | Sesión |
| `/usuarios`, `/proveedores`, `/configuracion` | Gestión de usuarios (roles/claves), directorio de proveedores, carpeta de fotos de Drive | Sesión (muta: Admin) |

**Costeo:** food cost objetivo fijo 35 % · impuesto al consumo 8 % · detección de ciclos
en subrecetas · recálculo en cascada al cambiar un insumo o subreceta.

**Separación clave:** la ficha técnica (narrativa de cocina) vive en la hoja
`FichaTecnica`, separada de los números. Editarla **no** dispara recálculos ni versiones.

## Seguridad y roles

Login por usuario (hoja `Usuarios`: email + clave). La cookie `gc_session` va firmada con
HMAC-SHA256 (Web Crypto, compatible con Edge) e incluye el rol; expira a las 12 h. El
middleware exige sesión en todo excepto `/login` y `/recetario`, y rol **Admin** para
cualquier POST/PUT/DELETE de `/api/*`. La columna `clave` jamás sale del backend
(sanitización en `Code.gs`). Roles: `Admin` (todo), `Usuario`/`Consulta` (solo lectura).

## Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Descripción |
|---|---|
| `GASTROCORE_API_URL` | URL `/exec` de la implementación de Apps Script |
| `GASTROCORE_API_TOKEN` | Token compartido (mismo valor que `API_TOKEN` en Script Properties) |
| `AUTH_SECRET` | Secreto HMAC de las cookies de sesión |

⚠️ Tras crear o cambiar una variable hay que hacer **Redeploy**: no aplican al deploy activo.

## Despliegue

**Frontend:** push a `main` → Vercel construye y publica solo.

**Backend:** pegar `Code.gs` en el editor de Apps Script → **Implementar → Gestionar
implementaciones → editar → Nueva versión** (la URL no cambia, pero sin "Nueva versión"
el código nuevo NO queda en vivo). Acceso: "Ejecutar como: Yo" + "Cualquier persona".

### Funciones de setup (ejecutar una vez desde el editor, botón ▶)

| Función | Qué hace |
|---|---|
| `setupBase()` | Crea las hojas del esquema y normaliza el maestro de insumos |
| `configurarToken()` | Genera y guarda el `API_TOKEN` en Script Properties |
| `setupRecetario()` | Crea la hoja `FichaTecnica` y la carpeta de fotos en Drive (pide autorizar Drive) |
| `instalarTriggerSemanal()` | Programa lunes 6 AM: snapshot de costos + purga (pide autorizar activadores) |
| `importarPreparaciones()` | Importa fichas del recetario viejo desde `recetario_import.json` en Drive (idempotente, nunca sobrescribe) |

### Mantenimiento

`purgarEliminados()` borra físicamente las filas `_ELIMINADO` de `IngredientesReceta`
(basura operativa de cada edición; la auditoría real vive en `HistorialRecetas` con
snapshots completos — es la única excepción al borrado lógico). `limpiarConfiguracion()`
retira datos basura detectados en auditoría. Ambas corren también con el trigger semanal.

## Convenciones del código

IDs con prefijo por entidad (`INS-000123`, `REC-000011`, `FT-000001`) generados con
contador atómico. Las mutaciones se serializan con un lock global en el router (v5).
`lib/auth.ts` no importa `next/headers` para poder usarse desde el middleware Edge; la
lectura de sesión en Server Components vive en `lib/session.ts`. El recetario público se
cachea 5 minutos en el servidor (`unstable_cache`); el navegador de cocina nunca ve el token.

## Pendientes conocidos

Rotar `API_TOKEN`, `AUTH_SECRET` y claves iniciales al estabilizar · validación estricta
unidad ingrediente = unidad insumo (hoy por convención: insumos costeados por unidad
base) · `unidad_id` en `IngredientesReceta` guarda el código ("GRAMOS") en vez del ID
(cosmético) · rol `Consulta` con vistas diferenciadas.
