# FlatHunt AI — Guía para Agents

## Qué es este proyecto
App Angular 21 + Express + Supabase para buscar pisos en Madrid. Usa scraping de Idealista, embeddings con OpenRouter, y búsqueda semántica con pgvector.

## URLs

| Entorno | URL |
|---------|-----|
| Producción | https://madrent-ai.vercel.app |
| GitHub | https://github.com/fblascon/flathunt-ai |

## Arquitectura rápida
```
Vercel (Hosting)
  ├── Frontend (Angular 21 static)
  └── API Serverless (Express 5 en api/index.js)
        ├── /api/ai/* → OpenRouter (Gemini + Embeddings)
        ├── /api/ai/semantic-search → Supabase REST + pgvector
        └── /api/geocode/address → madrid-streets.json (callejero oficial)
```

Dev local:
```
Frontend (Angular :4200) ← Proxy (proxy.conf.json) → Express (:3001) ←→ Supabase REST API
```

## Archivos clave
- `server.js` — Express backend, endpoints `/api/ai/*`
- `api/index.js` — Entry point serverless para Vercel (require server.js + export)
- `vercel.json` — Configuración Vercel (framework: angular, rewrites para /api)
- `src/app/pages/listings/` — Página principal de búsqueda
- `src/app/pages/listing-detail/` — Página de detalle con carousel de fotos
- `pipeline/idealista_spain.py` — Scraper vía Decodo API (bypass Cloudflare)
- `pipeline/pipeline.py` — Orquestador del scraper
- `pipeline/embeddings.py` — Generación de embeddings
- `supabase/schema.sql` — Esquema de base de datos
- `src/environments/environment.ts` — Credenciales públicas (supabase anon key)
- `.env` — Credenciales sensibles (SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY) — no subir a git
- `pipeline/build-street-index.js` — Script para construir el índice callejero (descarga CSVs oficiales del Ayuntamiento de Madrid y genera madrid-streets.json)
- `madrid-streets.json` — Índice calle ← distrito/barrio generado automáticamente (~27k variantes de calles)
- `src/environments/environment.ts` — Credenciales públicas (supabase anon key)
- `.env` — Credenciales sensibles (SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY) — no subir a git

## Comandos útiles
```bash
# Arrancar todo (local)
npm start                    # Frontend + backend con concurrently

# Solo backend
node server.js

# Solo frontend
rm -rf .angular && npx ng serve --proxy-config proxy.conf.json

# Scraper (necesita DECODO_API_TOKEN en .env)
cd pipeline
python pipeline.py --pages 3          # Scrapear distritos (3 páginas c/u)
python pipeline.py --pages 1          # Scrapeo rápido (1 página)

# Verificar/actualizar barrios oficiales
npm run verify:districts              # Descarga CSV oficial de barrios y completa madrid-districts.json

# Embeddings
python pipeline/embeddings.py --regenerate     # Regenerar todos
python pipeline/embeddings.py                 # Solo los que faltan

# Callejero / Geocoding
npm run build:street-index                    # Descarga CSVs oficiales y genera madrid-streets.json
# Después de generarlo, el servidor Express carga el índice en memoria automáticamente

# Verificar build
npx ng build --configuration development

# Deploy Vercel (si no hay push a main)
vercel deploy --prod --yes
```

## Decisiones arquitectónicas importantes
1. **Todo en Vercel** — Angular como estático + Express como serverless function via `api/index.js`
2. **No agrupación de pisos** — cada piso es tarjeta individual. El indicador de edificio compartido es solo visual (`siblingCount`)
3. **Fotos como URLs, no descargadas** — la columna `images` en Supabase es `text[]` con links a Idealista
4. **Filtro de barrios en backend** — el RPC `search_listings` acepta `neighborhoods[]` para filtrar en SQL
5. **Keyword post-filter** — el embedding busca semanticamente, luego el servidor filtra keywords (plural/accent-tolerant)
6. **Scraper vía Decodo API** — Idealista bloquea scraping directo (Cloudflare JS challenge). La Decodo API usa proxies premium residenciales que bypassan Cloudflare. Plan gratuito: $1 de crédito (~1000 requests proxy premium)

## Variables de entorno

### Vercel Dashboard (necesarias para producción)
| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (secreta, solo backend) |
| `OPENROUTER_API_KEY` | API key de OpenRouter |
| `DECODO_API_TOKEN` | Token de la Decodo Web Scraping API |

### .env (local)
Mismas variables más `SUPABASE_ANON_KEY` (pública, también en environment.ts).

## Problemas comunes
- `ng serve` congelado → `rm -rf .angular`
- `write EPIPE` en Angular → reiniciar `node server.js`
- Embeddings lentos → timeout de 60s + retry en `embeddings.py`
- API Vercel timeout → serverless functions tienen límite de 60s en plan Hobby
- Scraper "no response" en algunos distritos → Idealista no tiene listings en ese distrito o la Decodo API rate-limited. Reintentar más tarde

## SQL mínimo para nuevas sesiones
```sql
DROP FUNCTION IF EXISTS search_listings(vector,integer);
CREATE OR REPLACE FUNCTION search_listings (
  query_embedding vector(1536),
  match_count int default 10,
  neighborhoods text[] default null
)
RETURNS TABLE (...con floor, description, images...)
```

## Problemas comunes (actualizados Jun 2026)

- **`madrid-streets.json` no existe** → Ejecutar `npm run build:street-index` para generarlo. Si falta, el endpoint `/api/geocode/address` devuelve 404 y server.js muestra un warning al arrancar

- **`ion-icon` roto (Ionicons 8.x)** → Reemplazar con `<mat-icon fontIcon="name">` de Angular Material. Ver lista completa de componentes afectados en commit `bf8e340`
- **Sub-barrios sin resultados (Sanchinarro, Valdebebas, etc.)** → Añadir al JSON de `madrid-districts.json` en su distrito padre. El frontend auto-expande sub-barrio a distrito padre y post-filtra por keyword en título/dirección
- **Scroll en listings** → No usar `height: 100%` en `html/body`. Mantener `body { padding-top: 64px }` para navbar fijo
- **`ng serve` no recarga cambios** → `rm -rf .angular` y reiniciar
- **`<ion-content>` no renderiza contenido** → El proyecto no tiene `<ion-app>` wrapper, por lo que `ion-content` (Shadow DOM) no proyecta su slot. Usar `<div class="page-container">` con `height: 100vh; overflow-y: auto` en vez de `ion-content`
- **Favorites/History sin datos visibles (aunque la query devuelva rows)** → Dos causas: (1) `ion-content` ocultaba el render (ver arriba), (2) las queries sin `.eq('user_id', userId)` dependían solo de RLS, que falla si el JWT no está hidratado. Solución: filtrar siempre explícitamente por `user_id` en todas las queries de Supabase desde el frontend
- **Fallback de sesión no asigna `userId`** → En servicios como `favorites.service.ts`, cuando `getUserId()` retorna null y se hace fallback con `auth.getSession()`, la variable `userId` no se reasignaba, causando inserts con `user_id: null`. Usar `let userId` en vez de `const`

## Decisiones arquitectónicas importantes (actualizado)

6. **Callejero oficial** — Se usa el callejero oficial del Ayuntamiento de Madrid (CSVs descargables) para geocodificar direcciones de Idealista. El script `pipeline/build-street-index.js` descarga `vialesvigentesdistritosbarrios.csv` (~11k calles) y `barrios_municipio_madrid.csv` (~128 barrios), los cruza, y genera `madrid-streets.json` (~27k variantes). El servidor carga el JSON en memoria al arrancar y expone `GET /api/geocode/address?q=Calle+de+Serrano+10` que devuelve `{ distrito, barrio, distritoCode }`.
7. **Iconos: Material Icons en vez de Ionicons** — Ionicons 8.x falla con `[name]` bindings dinámicos. Todos los iconos usan `<mat-icon fontIcon="name">` o interpolación `{{ cond ? 'favorite' : 'favorite_border' }}`
8. **Sub-barrios informales** (Sanchinarro, Valdebebas) se mapean a distrito padre y se post-filtran por keyword. Barrios oficiales (Barrio del Pilar) no se post-filtran
9. **Sin `<ion-app>` wrapper** — El proyecto no usa `<ion-app>`. Todas las páginas usan `<div class="page-container">` con `height: 100vh; overflow-y: auto` en vez de `<ion-content>`, que requiere `ion-app` para renderizar su Shadow DOM slot
10. **Filtro `user_id` explícito en queries frontend** — Todas las queries a Supabase desde el frontend llevan `.eq('user_id', userId)` como doble seguridad (además de RLS). Esto evita que un JWT no hidratado devuelva 0 resultados

11. **Sin login requerido** — El proyecto usa `signInAnonymously()` de Supabase para crear sesiones automáticas sin fricción. El usuario anónimo tiene rol `authenticated`, por lo que las RLS y grants existentes funcionan igual. Requiere que la opción **Anonymous sign-ins** esté activada en Supabase → Authentication → Settings (si no, el app funciona sin favoritos/historial).

Ver `cmtext.md` para estado detallado actual del proyecto.
