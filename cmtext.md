# FlatHunt AI — Estado Actual del Proyecto

Angular 21 app que busca pisos en Madrid con IA, scraping de Idealista, Supabase backend.

**Producción:** https://flathunt-ai.vercel.app
**GitHub:** https://github.com/fblascon/flathunt-ai

## Fases Completadas

1. ✅ **Frontend Angular 21** con Material UI, Supabase auth, Express backend proxy
2. ✅ **Scraping de Idealista** — 2407+ listings de 19/21 distritos de Madrid
3. ✅ **Embeddings** — 2512 listings con embeddings generados vía OpenRouter
4. ✅ **Búsqueda semántica** — pgvector con filtrado por barrio, tipo de piso, keywords
5. ✅ **Carousel de fotos** — galería de imágenes en página de detalle con navegación y thumbnails
6. ✅ **Scraper de detalle con fotos múltiples** — `fetch_detail_page()` extrae galería completa, pipeline incluye `--detail-limit` (default 100) para poblar `images[]` en Supabase
7. ✅ **UI sin agrupación** — cada piso como tarjeta individual con indicador visual de edificio compartido
8. ✅ **Fallback por barrio** — si no hay resultados en un barrio, opción de buscar en toda Madrid
9. ✅ **Deploy Vercel** — frontend Angular estático + Express serverless en `api/index.js`
10. ✅ **Google OAuth** — configurado en Supabase Auth + Google Cloud Console, login funcional

---

## Código Principal

| Archivo | Qué hace |
|---------|----------|
| `src/app/pages/listings/listings.component.ts` | Grid de pisos individuales, búsqueda IA con filtro de barrios |
| `src/app/components/listing-card/listing-card.component.ts` | Tarjeta individual con badge de barrio, planta, indicador de edificio compartido |
| `src/app/pages/listing-detail/listing-detail.component.ts` | Detalle del piso con carousel de fotos, análisis IA |
| `server.js` | Express con endpoints AI, semantic search con fallback por barrio |
| `api/index.js` | Entry point serverless Vercel (require + export de server.js) |
| `vercel.json` | Config Vercel: framework angular, rewrites /api → serverless function |
| `pipeline/pipeline.py` | Scraper principal con opción `--full-madrid` y `--detail-limit` |
| `pipeline/idealista_spain.py` | Scraper de Idealista usando `curl_cffi` |
| `pipeline/embeddings.py` | Genera embeddings vía OpenRouter, guarda en pgvector |
| `supabase/schema.sql` | SQL de la base de datos + RPC `search_listings` con neighborhoods |

---

## Configuración Activa

- **Producción**: https://flathunt-ai.vercel.app
- **GitHub**: https://github.com/fblascon/flathunt-ai
- **Supabase**: `quipyyrmhzbcxlksthpo.supabase.co`
- **OpenRouter**: API key en dashboard Vercel (modelo `google/gemini-2.0-flash-001`)
- **Google OAuth**: configurado en Supabase Auth + Google Cloud Console
- **Env Vars Vercel**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`
- **Scraping**: `curl_cffi` con impersonate `chrome124`, delays de 5s entre requests

---

## Base de Datos Supabase

### Tabla `listings`
```sql
id text primary key
title text
price numeric
rooms integer
size_m2 integer
floor text
address text
neighborhood text
image_url text          -- foto principal
images text[]           -- array de URLs de galería completa (opcional)
description text
external_url text
latitude numeric
longitude numeric
features text[]
embedding vector(1536)
is_active boolean
created_at / first_seen / last_seen
```

### Función RPC `search_listings`
```sql
create or replace function search_listings (
  query_embedding vector(1536),
  match_count int default 10,
  neighborhoods text[] default null
)
```
Filtra por barrios (`neighborhoods`) y devuelve `similarity`, `floor`, `description`, `images`.

---

## Cómo arrancar el proyecto

### Local

```bash
# Frontend + backend (concurrently)
npm start

# o manualmente:
# Terminal 1 — Frontend Angular
rm -rf .angular && npx ng serve --proxy-config proxy.conf.json
# Terminal 2 — Backend Express
node server.js
```

### Pipeline (scraper Python)

Las dependencias (`curl_cffi`, `beautifulsoup4`, etc.) están instaladas globalmente — no necesita venv.

```bash
cd pipeline
python pipeline.py --pages 5          # Scrapear 21 distritos + 100 detalles
python pipeline.py --pages 5 --detail-limit 0   # Solo listings, sin detalles
python pipeline.py --full-madrid --pages 10     # Madrid completo
python embeddings.py --regenerate     # Regenerar embeddings
```

---

## Pipeline de Scraping

### Scrapear por distritos (recomendado, más preciso)
```bash
cd pipeline
python pipeline.py --pages 5
```
~3150 listings, 5 páginas × 21 distritos, tarda ~10-15 minutos.

### Scrapear toda Madrid (más rápido, menos preciso en barrios)
```bash
cd pipeline
python pipeline.py --full-madrid --pages 10
```

### Extraer fotos de detalle (lento, 1 request por listing)
```bash
cd pipeline
python pipeline.py --pages 1 --detail-limit 50
```
Por defecto se extraen 100 detalles. Usar `--detail-limit 0` para omitir.

### Regenerar embeddings
```bash
cd pipeline
python embeddings.py --regenerate
```

---

## Deploy (Vercel)

```bash
# Manual (si no hay push a main)
vercel deploy --prod --yes

# Automático: cada push a main en GitHub redeploya
```

### Estructura Vercel
- `vercel.json` → framework angular, build command, rewrites `/api/*` → serverless function
- `api/index.js` → `require('../server')` + `module.exports = app`
- `server.js` → `if (!process.env.VERCEL)` condiciona el `listen()` para serverless
- Variables de entorno configuradas en dashboard Vercel (no en .env para producción)

### OAuth en Producción
- Google Cloud Console: Client ID nuevo con Authorized redirect URIs apuntando a Supabase callback
- Supabase Auth: Google provider habilitado, Redirect URLs incluyen `https://flathunt-ai.vercel.app/**`
- Auth redirige a `window.location.origin + '/home'`

---

## Endpoints del Backend Express

### Local (port 3001)
| Endpoint | Descripción |
|----------|-------------|
| `POST /api/ai/semantic-search` | Búsqueda semántica. Body: `{query, limit, keyword, neighborhoods}` |
| `POST /api/ai/analyze-listing` | Análisis IA de un piso. Body: `{listing, preferences}` |
| `POST /api/ai/score-listings` | Puntuación IA de múltiples pisos |
| `POST /api/ai/compare` | Comparación IA de 2-3 pisos |
| `GET /api/health` | Health check |

### Producción (Vercel)
Mismos endpoints en `https://flathunt-ai.vercel.app/api/...`

---

## Bugs Arreglados Recientemente

- **Agrupación por edificio eliminada** — ahora cada piso es tarjeta individual con indicador visual si hay más pisos en el mismo edificio
- **Búsqueda semántica con filtro de barrios** — el frontend extrae barrios de la query natural y los pasa al RPC
- **Keyword filter robusto** — soporta plurales (ático/áticos), acentos, filtra por tipo de piso en título
- **Scraper funcional** — homepage puede devolver 403 pero los distritos devuelven 200; session se mantiene entre requests
- **Embeddings con retry** — timeout de 60s + 3 reintentos con backoff exponencial

---

## Problemas Conocidos / Mejoras Futuras

1. **Scraper bloqueado por Idealista 403** — algunos distritos (Salamanca, Fuencarral) fallan ocasionalmente. Solución: cambiar IP con VPN o esperar unas horas y reintentar.
2. **Fotos de detalle** — los listings existentes solo tienen 1 foto (thumbnail). Los nuevos scraps extraen hasta 100 galerías completas automáticamente vía `--detail-limit`. Ejecutar `python pipeline.py --detail-limit 100` en datos existentes para rellenar `images[]`.
3. **Sin paginación** — la lista muestra todos los listings en memoria. Con 2500+ funciona bien, pero >5000 puede ralentizarse.
4. **Re-scrapeo periódico** — no hay cron job ni GitHub Actions configurado. Idealista cambia listings diariamente.
5. **Scraper solo Idealista** — no cubre Fotocasa, Milanuncios, etc.
6. **Vercel Hobby limits** — serverless functions timeout a 60s (suficiente para semantic-search, pero embeddings desde el backend no funcionarían)
7. **Sin GitHub Actions** — el pipeline de scraping/embeddings solo se ejecuta manualmente en local

---

## Notas Técnicas para Agents

- `ng serve` a veces no recarga cambios → `rm -rf .angular` y reiniciar
- `.env` tiene `SUPABASE_SERVICE_ROLE_KEY` y `OPENROUTER_API_KEY` — no subir a git
- En Vercel, las env vars se configuran en el dashboard, no en `.env`
- El scraper usa `curl_cffi` para bypass Cloudflare — requiere `pip install curl_cffi`
- La columna `images` en Supabase es `text[]` (array de URLs), no se descargan fotos localmente
- El frontend filtra barrios en la query natural usando `extractNeighborhoodsFromQuery()`
- El indicador visual de edificio compartido es `siblingCount > 1` en `listing-card`, no agrupación real
- `server.js` exporta `app` (module.exports) para que `api/index.js` lo use en serverless
- El `listen()` en `server.js` está condicionado a `!process.env.VERCEL`
- Angular environment es único (sin fileReplacements), usa `/api` en todos los entornos (proxy en dev)
