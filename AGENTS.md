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
- `pipeline/pipeline.py` — Scraper de Idealista
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

# Scraper
cd pipeline
python pipeline.py --pages 5          # Scrapear distritos
python pipeline.py --full-madrid       # Scrapear Madrid completo
python pipeline.py --detail-limit 50   # Extraer fotos de detalle

# Embeddings
python embeddings.py --regenerate     # Regenerar todos
python embeddings.py                 # Solo los que faltan

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
6. **Scraper con delays** — 5 segundos entre requests para evitar bloqueo de Idealista

## Variables de entorno

### Vercel Dashboard (necesarias para producción)
| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (secreta, solo backend) |
| `OPENROUTER_API_KEY` | API key de OpenRouter |

### .env (local)
Mismas variables más `SUPABASE_ANON_KEY` (pública, también en environment.ts).

## Problemas comunes
- `403 Forbidden` en Idealista → cambiar IP con VPN o esperar
- `ng serve` congelado → `rm -rf .angular`
- `write EPIPE` en Angular → reiniciar `node server.js`
- Embeddings lentos → timeout de 60s + retry en `embeddings.py`
- API Vercel timeout → serverless functions tienen límite de 60s en plan Hobby

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

Ver `cmtext.md` para estado detallado actual del proyecto.
