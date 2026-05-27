# FlatHunt AI — Guía para Agents

## Qué es este proyecto
App Angular 21 + Express + Supabase para buscar pisos en Madrid. Usa scraping de Idealista, embeddings con OpenRouter, y búsqueda semántica con pgvector.

## Arquitectura rápida
```
Frontend (Angular 21) ← Proxy → Express (3001) ←→ Supabase REST API
                                      ↓
                              OpenRouter (AI + Embeddings)
```

## Archivos clave
- `server.js` — Express backend, endpoints `/api/ai/*`
- `src/app/pages/listings/` — Página principal de búsqueda
- `src/app/pages/listing-detail/` — Página de detalle con carousel de fotos
- `pipeline/pipeline.py` — Scraper de Idealista
- `pipeline/embeddings.py` — Generación de embeddings
- `supabase/schema.sql` — Esquema de base de datos
- `.env` — Credenciales (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY)

## Convenciones de código
- Angular standalone components (no NgModules)
- Signals para estado reactivo (no RxJS para estado simple)
- Material UI para todos los componentes
- Python 3.10 en pipeline, usa `urllib.request` (no requests)
- Supabase REST API directa (no SDK en Python)

## Comandos útiles
```bash
# Arrancar todo
npm start                    # Frontend + backend con concurrently

# Solo backend
node server.js

# Solo frontend
rm -rf .angular && npx ng serve --proxy-config proxy.conf.json

# Scraper
cd pipeline
python pipeline.py --pages 5          # Scrapear distritos
python pipeline.py --full-madrid       # Scrapear Madrid completo
python pipeline.py --detail-limit 50   # Extraer fotos de detalle (default: 100, 0 para skip)

# Embeddings
python embeddings.py --regenerate     # Regenerar todos
python embeddings.py                 # Solo los que faltan

# Verificar
npx ng build --configuration development   # Compilar Angular
```

## Decisiones arquitectónicas importantes
1. **No agrupación de pisos** — cada piso es tarjeta individual. El indicador de edificio compartido es solo visual (`siblingCount`)
2. **Fotos como URLs, no descargadas** — la columna `images` en Supabase es `text[]` con links a Idealista
3. **Filtro de barrios en backend** — el RPC `search_listings` acepta `neighborhoods[]` para filtrar en SQL
4. **Keyword post-filter** — el embedding busca semanticamente, luego el servidor filtra keywords (plural/accent-tolerant)
5. **Scraper con delays** — 5 segundos entre requests para evitar bloqueo de Idealista

## Problemas comunes
- `403 Forbidden` en Idealista → cambiar IP con VPN o esperar
- `ng serve` congelado → `rm -rf .angular`
- `write EPIPE` en Angular → reiniciar `node server.js`
- Embeddings lentos → timeout de 60s + retry en `embeddings.py`

## SQL mínimo para nuevas sesiones
```sql
-- Si la función RPC no existe o necesita actualización:
DROP FUNCTION IF EXISTS search_listings(vector,integer);
CREATE OR REPLACE FUNCTION search_listings (
  query_embedding vector(1536),
  match_count int default 10,
  neighborhoods text[] default null
)
RETURNS TABLE (...con floor, description, images...)
```

Ver `cmtext.md` para estado detallado actual del proyecto.
