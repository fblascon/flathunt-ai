# FlatHunt AI — Estado Actual del Proyecto

Angular 21 app que busca pisos en Madrid con IA, scraping de Idealista (vía Decodo API), Supabase backend.

**Producción:** https://flathunt-ai.vercel.app
**GitHub:** https://github.com/fblascon/flathunt-ai

## Fases Completadas

1. ✅ **Frontend Angular 21** con Material UI, Supabase auth, Express backend proxy
2. ✅ **Scraping de Idealista vía Decodo API** — bypass Cloudflare con proxies residenciales premium. ~2407+ listings en Supabase
3. ✅ **Embeddings** — ~2500 listings con embeddings generados vía OpenRouter (text-embedding-3-small)
4. ✅ **Búsqueda semántica** — pgvector con filtrado por barrio, tipo de piso, keywords
5. ✅ **Carousel de fotos** — galería de imágenes en página de detalle con navegación y thumbnails
6. ✅ **Paginación** — en página de listings con prev/next, total count
7. ✅ **Historial de pisos vistos** — tabla `viewed_listings` con pestañas en página de History
8. ✅ **Favoritos funcional** — corregido bug de RLS (faltaba user_id)
9. ✅ **Husky pre-commit + pre-push** — lint-staged, format:check, lint, test
10. ✅ **GitHub Actions CI** — push/PR a master: format:check → ng lint → ng build → vitest
11. ✅ **GitHub Actions scraper semanal** — workflow con cron (domingo 8:00 UTC) + workflow_dispatch
12. ✅ **Google OAuth** — configurado en Supabase Auth + Google Cloud Console, login funcional
13. ✅ **Deploy Vercel** — frontend Angular estático + Express serverless en `api/index.js`

---

## Código Principal

| Archivo | Qué hace |
|---------|----------|
| `src/app/pages/listings/listings.component.ts` | Grid de pisos con paginación, búsqueda IA con filtro de barrios |
| `src/app/components/listing-card/listing-card.component.ts` | Tarjeta individual con badge de barrio, planta, indicador de edificio compartido |
| `src/app/pages/listing-detail/listing-detail.component.ts` | Detalle del piso con carousel de fotos, análisis IA, registro de vista |
| `server.js` | Express con endpoints AI, semantic search con fallback por barrio |
| `api/index.js` | Entry point serverless Vercel (require + export de server.js) |
| `pipeline/pipeline.py` | Scraper orquestador (Decodo API + Supabase upsert) |
| `pipeline/idealista_spain.py` | Scraper de Idealista vía Decodo API (proxy premium) |
| `pipeline/embeddings.py` | Genera embeddings vía OpenRouter, guarda en pgvector |
| `supabase/schema.sql` | SQL de la base de datos + RPC `search_listings` con neighborhoods |

---

## Configuración Activa

- **Producción**: https://flathunt-ai.vercel.app
- **GitHub**: https://github.com/fblascon/flathunt-ai
- **Supabase**: `quipyyrmhzbcxlksthpo.supabase.co`
- **OpenRouter**: API key en dashboard Vercel (modelo `google/gemini-2.0-flash-001`)
- **Decodo API**: plan gratuito ($1 crédito, ~1000 requests proxy premium/mes)
- **Google OAuth**: configurado en Supabase Auth + Google Cloud Console
- **Env Vars Vercel**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `DECODO_API_TOKEN`

---

## Cómo arrancar el proyecto

### Local

```bash
npm start   # Frontend + backend (concurrently)
```

### Scraper (necesita DECODO_API_TOKEN en .env)

```bash
cd pipeline
python pipeline.py --pages 3          # 21 distritos x 3 páginas
python pipeline.py --pages 1          # Scrapeo rápido (1 página)
```

### Embeddings

```bash
cd pipeline
python embeddings.py                  # Solo los que faltan
python embeddings.py --regenerate     # Regenerar todos
```

---

## Pipeline de Scraping

### Flujo actual
1. **Decodo API** recibe URL de Idealista, la renderiza con proxy premium (residencial)
2. Devuelve HTML completo (bypassea Cloudflare sin JS challenge)
3. BeautifulSoup extrae listings: título, precio, habitaciones, tamaño, barrio
4. **Detalle** (opcional, limitado): 1 request extra por listing para descripción + OG image
5. Se hace upsert a Supabase (merge-duplicates por id)
6. Workflow semanal en GitHub Actions marca como inactivos listings no vistos en 7 días

### Plan gratuito: limitaciones
- ~1000 requests con proxy premium (sin JS rendering)
- Las páginas de detalle sin JS devuelven: descripción + 1 imagen (OG image)
- **Sin galería completa** de fotos (necesita JS rendering → plan de pago $19/mes)
- **Sin coordenadas** (necesita JS rendering)
- Rate limit: 10 req/s

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
image_url text          -- foto principal (thumbnail de search)
images text[]           -- array de URLs de galería (lleno solo en listings viejos)
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

## Problemas Conocidos / Mejoras Futuras

1. **Galería de fotos limitada** — listings nuevos solo tienen 1 imagen (OG image). Los existentes conservan su galería completa. Solución: plan de pago Decodo ($19/mes con JS rendering) o extraer imágenes de otra forma
2. **Sin coordenadas** — Idealista carga el mapa vía JS, no disponible sin JS rendering
3. **Algunos distritos sin datos** — Chamberí, Salamanca, Fuencarral, etc. devuelven "no response" ocasionalmente (Idealista sin listings o rate limit)
4. **Vercel Hobby limits** — serverless functions timeout a 60s (suficiente para semantic-search)
5. **Scraper solo Idealista** — no cubre Fotocasa, Milanuncios, etc.

---

## Notas Técnicas para Agents

- `ng serve` a veces no recarga cambios → `rm -rf .angular` y reiniciar
- `.env` tiene `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `DECODO_API_TOKEN` — no subir a git
- En Vercel, las env vars se configuran en el dashboard, no en `.env`
- El scraper usa **Decodo API** (no scraping directo) — necesita `DECODO_API_TOKEN` en env
- `DECODO_API_TOKEN` debe añadirse a **GitHub Secrets** para que funcione el CI/CD semanal
- La columna `images` en Supabase es `text[]` (array de URLs), no se descargan fotos localmente
- El frontend filtra barrios en la query natural usando `extractNeighborhoodsFromQuery()`
- `server.js` exporta `app` (module.exports) para que `api/index.js` lo use en serverless
- El `listen()` en `server.js` está condicionado a `!process.env.VERCEL`
