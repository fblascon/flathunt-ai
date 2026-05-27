# FlatHunt AI

Búsqueda semántica de pisos en Madrid con IA. Angular 21 + Express + Supabase + OpenRouter.

**Producción:** https://flathunt-ai.vercel.app

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Angular 21 (standalone, Signals, Material UI) |
| Backend | Express 5 (Vercel Serverless Functions) |
| DB | Supabase PostgreSQL + pgvector |
| AI | OpenRouter (Gemini 2.0 Flash + text-embedding-3-small) |
| Scraper | Python 3.10 + curl_cffi |
| Hosting | Vercel (frontend + API serverless) |

## Desarrollo local

```bash
# Frontend + backend simultáneamente
npm start

# Solo frontend (necesita backend aparte)
rm -rf .angular && npx ng serve --proxy-config proxy.conf.json

# Solo backend
node server.js
```

## Producción (Vercel)

El proyecto tiene un `vercel.json` que despliega Angular como frontend estático y el Express como serverless function en `/api/*`.

Las variables de entorno están configuradas en el dashboard de Vercel:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`

Cada push a `main` redeploya automáticamente en https://flathunt-ai.vercel.app.

## Scraper

```bash
cd pipeline
python pipeline.py --pages 5          # Scrapear distritos
python pipeline.py --full-madrid       # Scrapear Madrid completo
python pipeline.py --detail-limit 50   # Extraer fotos de detalle
python embeddings.py                   # Generar embeddings de listings nuevos
```

## Autenticación

- Google OAuth configurado via Supabase Auth
- Cliente OAuth en Google Cloud Console con redirect a Supabase callback
- Session persistida via `@supabase/supabase-js`

## Estructura del proyecto

```
flathunt-ai/
├── api/index.js              # Entry point serverless Vercel
├── vercel.json               # Configuración Vercel
├── server.js                 # Express backend (API endpoints)
├── pipeline/                 # Scraper Python + embeddings
│   ├── pipeline.py
│   ├── idealista_spain.py
│   └── embeddings.py
├── supabase/schema.sql       # DB schema + RPC search_listings
├── src/                      # Angular frontend
│   └── app/
│       ├── pages/            # home, listings, listing-detail, login, etc.
│       ├── services/         # supabase, ai, listings, favorites, etc.
│       ├── components/       # listing-card, navbar
│       └── guards/           # auth.guard (protege rutas)
```
