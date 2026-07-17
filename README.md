# GastroCore v10.0

Sistema de costeo de recetas y recetario de cocina de **Restaurantes Rocoto**. Costeo en tiempo real, subrecetas con puente al maestro de insumos, recetario público con estilos por marca, y analítica de decisiones.

## Arquitectura

```
Next.js 14 (Vercel) ──POST──▶ Apps Script (Code.gs v10) ──▶ Google Sheets "Base de Costos"
        │                            │                              (única fuente de verdad, 14 hojas)
   3 capas de caché            CacheService por versión         Fotos → carpeta de Drive
```

- El frontend **nunca** toca el Sheet: todo pasa por la API de Apps Script con token (solo en el servidor de Vercel).
- Lecturas: `POST {mode:'read', resource, params}` · Escrituras: `POST {resource, action, data}`.
- Roles servidor (Admin / Chef / Lector) vía middleware + validación en backend.

## Módulos

| Vista | Qué hace |
|---|---|
| **Insumos** | Maestro de artículos con costos, clasificaciones, carga por plano (CSV) |
| **Subrecetas** | Calculadora de preparaciones; **EL PUENTE** empuja el costo calculado al insumo maestro (historial + recálculo en cascada); ficha técnica sin foto; modo lectura al entrar |
| **Recetas** | Platos por familia directa, costeo gross-up (merma ÷, desvío ×), precio sugerido con impuesto |
| **Recetario** | Vista pública de cocina: categorías, 🏷 centros de costo, sección **SUB. RECETAS**, fichas con foto+lupa, **6 estilos de color** por proyecto |
| **Panel** | KPIs + **🔬 Lectura de experto** (dinero en la mesa, frontera del objetivo, concentración, fichas incompletas, familia despareja) |
| **Análisis** | Simulador de impacto, alertas, tops, evolución semanal, **📣 Lectura del período** |
| **Configuración** | FC objetivo (+excepciones por familia), impuesto, identidad, 🎨 estilo del recetario, respaldo, rotación de token |

## Convenciones críticas

- **Despliegue backend:** editar Code.gs → *Implementar → Nueva versión* (misma URL). El botón ▶ ejecuta la función del **desplegable**.
- **Env vars Vercel:** `GASTROCORE_API_URL`, `GASTROCORE_API_TOKEN`, `AUTH_SECRET` — cambios requieren Redeploy.
- **Posicional:** el código lee las hojas por posición de columna (ESQUEMA). Renombrar cabeceras es seguro; **mover o insertar columnas rompe todo**.
- **Caché:** backend por versión (se invalida solo al escribir) · datos en Vercel por etiquetas `['recetario']` (5 min, purgados al guardar) · toda mutación limpia el caché TTL de lecturas.

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md) — el detalle técnico completo.
- Manual de usuario: en la app (`/manual`), portada del sistema.
