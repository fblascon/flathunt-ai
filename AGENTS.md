# FlatHunt AI — Guía para Agents

## Qué es este proyecto
App Angular 21 + Express + Supabase para buscar pisos en Madrid. Usa scraping de Idealista, embeddings con OpenRouter, y búsqueda semántica con pgvector.

## URLs

| Entorno | URL |
|---------|-----|
| Producción | https://flathunt-ai.vercel.app |
| GitHub | https://github.com/fblascon/flathunt-ai |

## Arquitectura rápida
```
Vercel (Hosting)
  ├── Frontend (Angular 21 static)
  └── API Serverless (Express 5 en api/index.js)
        ├── /api/ai/* → OpenRouter (Gemini + Embeddings)
        └── /api/ai/semantic-search → Supabase REST + pgvector
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

# Embeddings
python pipeline/embeddings.py --regenerate     # Regenerar todos
python pipeline/embeddings.py                 # Solo los que faltan

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

- **`ion-icon` roto (Ionicons 8.x)** → Reemplazar con `<mat-icon fontIcon="name">` de Angular Material. Ver lista completa de componentes afectados en commit `bf8e340`
- **Sub-barrios sin resultados (Sanchinarro, Valdebebas, etc.)** → Añadir al JSON de `madrid-districts.json` en su distrito padre. El frontend auto-expande sub-barrio a distrito padre y post-filtra por keyword en título/dirección
- **Scroll en listings** → No usar `height: 100%` en `html/body`. Mantener `body { padding-top: 64px }` para navbar fijo
- **`ng serve` no recarga cambios** → `rm -rf .angular` y reiniciar

## Decisiones arquitectónicas importantes (actualizado)

7. **Iconos: Material Icons en vez de Ionicons** — Ionicons 8.x falla con `[name]` bindings dinámicos. Todos los iconos usan `<mat-icon fontIcon="name">` o interpolación `{{ cond ? 'favorite' : 'favorite_border' }}`
8. **Sub-barrios informales** (Sanchinarro, Valdebebas) se mapean a distrito padre y se post-filtran por keyword. Barrios oficiales (Barrio del Pilar) no se post-filtran

Ver `cmtext.md` para estado detallado actual del proyecto.
