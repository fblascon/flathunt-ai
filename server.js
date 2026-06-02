const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_EMBED_URL = 'https://openrouter.ai/api/v1/embeddings';
const MODEL = 'google/gemini-2.0-flash-001';
const EMBED_MODEL = 'openai/text-embedding-3-small';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function callOpenRouter(messages) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'MadRent',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');
  return JSON.parse(match[0]);
}

function extractJsonArray(text) {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in response');
  return JSON.parse(match[0]);
}

// Analyze a single listing with AI
app.post('/api/ai/analyze-listing', async (req, res) => {
  try {
    const { listing, preferences } = req.body;

    let prefsText = '';
    if (preferences) {
      prefsText = `
Preferencias del usuario:
- Precio máximo: ${preferences.maxPrice || 'No especificado'}€
- Mínimo habitaciones: ${preferences.minRooms || 'No especificado'}
- Mínimo m²: ${preferences.minSize || 'No especificado'}
- Imprescindible: ${preferences.mustHave?.join(', ') || 'Ninguno'}
`;
    }

    const prompt = `Eres un experto analista inmobiliario en Madrid. Analiza este piso de alquiler:

PISO:
- Título: ${listing.title}
- Precio: ${listing.price}€/mes
- Habitaciones: ${listing.rooms}
- Tamaño: ${listing.size} m²
- Dirección: ${listing.address}
- Características: ${listing.features?.join(', ') || 'No especificadas'}
- Descripción: ${listing.description || 'No disponible'}

${prefsText}

Devuelve EXCLUSIVAMENTE un JSON (sin markdown, sin explicaciones) con este formato:
{
  "score": (número 0-100, puntuación global considerando precio, ubicación, características y preferencias),
  "pros": ["ventaja 1", "ventaja 2", "ventaja 3"],
  "cons": ["desventaja 1", "desventaja 2"],
  "summary": "resumen de 2-3 frases sobre si es buena opción",
  "priceQuality": "breve valoración calidad/precio",
  "redFlags": ["posible red flag si la hay, o array vacío si no"]
}`;

    const result = await callOpenRouter([
      { role: 'system', content: 'Eres un analista inmobiliario experto en Madrid. Responde solo con JSON válido.' },
      { role: 'user', content: prompt },
    ]);

    res.json(extractJson(result));
  } catch (err) {
    console.error('analyze-listing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Score multiple listings
app.post('/api/ai/score-listings', async (req, res) => {
  try {
    const { listings, preferences } = req.body;

    const prompt = `Eres un experto analista inmobiliario en Madrid. Puntúa estos pisos de alquiler según las preferencias del usuario.

PREFERENCIAS:
- Precio máximo: ${preferences.maxPrice || 'Sin límite'}€
- Mínimo habitaciones: ${preferences.minRooms || '0'}
- Mínimo m²: ${preferences.minSize || '0'}
- Imprescindible: ${preferences.mustHave?.join(', ') || 'Ninguno'}

PISOS:
${listings.map((l, i) => `${i + 1}. ${l.title} - ${l.price}€, ${l.rooms} hab, ${l.size}m², ${l.address}`).join('\n')}

Devuelve EXCLUSIVAMENTE un array JSON (sin markdown) con este formato:
[
  {"id": "id_del_piso", "score": 85, "reason": "breve razón de la puntuación"},
  ...
]`;

    const result = await callOpenRouter([
      { role: 'system', content: 'Eres un analista inmobiliario experto. Responde solo con JSON válido.' },
      { role: 'user', content: prompt },
    ]);

    res.json(extractJsonArray(result));
  } catch (err) {
    console.error('score-listings error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Compare 2-3 listings
app.post('/api/ai/compare', async (req, res) => {
  try {
    const { listings } = req.body;

    const prompt = `Eres un experto analista inmobiliario. Compara estos pisos de alquiler en Madrid:

${listings.map((l, i) => `
PISO ${i + 1}:
- ID: ${l.id}
- ${l.title}
- ${l.price}€/mes
- ${l.rooms} hab, ${l.size}m²
- ${l.description || 'Sin descripción'}
`).join('\n---\n')}

Devuelve EXCLUSIVAMENTE un JSON (sin markdown) con este formato:
{
  "bestOption": "id del mejor piso",
  "comparison": [
    {
      "listingId": "id",
      "strengths": ["fortaleza 1", "fortaleza 2"],
      "weaknesses": ["debilidad 1"],
      "recommendation": "recomendación breve para este piso"
    }
  ]
}`;

    const result = await callOpenRouter([
      { role: 'system', content: 'Eres un analista inmobiliario experto. Responde solo con JSON válido.' },
      { role: 'user', content: prompt },
    ]);

    res.json(extractJson(result));
  } catch (err) {
    console.error('compare error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Extract info from URL (user pastes a link)
app.post('/api/ai/extract-url', async (req, res) => {
  try {
    const { url } = req.body;

    const prompt = `El usuario ha pegado esta URL de un piso de alquiler: ${url}

Quiero que hagas como si pudieras acceder a esa URL y extraer la información del anuncio.
Basándote en lo que típicamente contiene un anuncio de Idealista/Fotocasa para Madrid, genera una respuesta verosímil.

IMPORTANTE: Si reconoces la URL como un dominio conocido de alquiler (idealista.com, fotocasa.es, etc.), genera datos realistas. Si no, indícalo.
Realmente NO puedes acceder a la URL, así que sé honesto sobre eso pero proporciona ayuda útil.

Devuelve EXCLUSIVAMENTE un JSON (sin markdown):
{
  "title": "título del anuncio o null",
  "price": número o null,
  "rooms": número o null,
  "size": número (m²) o null,
  "description": "descripción o indicación de que no se pudo acceder",
  "address": "dirección o null",
  "analysis": "análisis o sugerencia de cómo obtener los datos (ej: copia y pega la info del anuncio)"
}`;

    const result = await callOpenRouter([
      { role: 'system', content: 'Eres un asistente útil. Responde solo con JSON válido.' },
      { role: 'user', content: prompt },
    ]);

    res.json(extractJson(result));
  } catch (err) {
    console.error('extract-url error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get distinct neighborhoods
app.get('/api/listings/neighborhoods', async (req, res) => {
  try {
    const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/listings?select=neighborhood&is_active=eq.true&neighborhood=not.is.null`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!resp.ok) return res.status(500).json({ error: 'Supabase error' });
    const rows = await resp.json();
    const neighborhoods = [...new Set(rows.map(r => r.neighborhood).filter(Boolean))].sort();
    res.json(neighborhoods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all listings with filters and pagination
app.get('/api/listings', async (req, res) => {
  try {
    const { maxPrice, minRooms, minSize, neighborhoods, page = '1', pageSize = '50' } = req.query;
    const start = (Number(page) - 1) * Number(pageSize);
    const end = start + Number(pageSize) - 1;
    let url = `${process.env.SUPABASE_URL}/rest/v1/listings?select=*&is_active=eq.true&order=last_seen.desc`;
    if (maxPrice) url += `&price=lte.${maxPrice}`;
    if (minRooms) url += `&rooms=gte.${minRooms}`;
    if (minSize) url += `&size_m2=gte.${minSize}`;
    if (neighborhoods) url += `&neighborhood=in.(${neighborhoods})`;

    const resp = await fetch(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'count=exact',
        Range: `${start}-${end}`,
      },
    });
    if (!resp.ok) return res.status(500).json({ error: 'Supabase error' });
    const allListings = await resp.json();
    const listings = allListings.filter((l) => l.image_url);
    const totalCount = parseInt(resp.headers.get('content-range')?.split('/')[1] || '0', 10);
    res.json({ data: listings, count: totalCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get listing by ID (uses service role to bypass RLS)
app.get('/api/listings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/listings?id=eq.${id}&select=*`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!resp.ok) return res.status(500).json({ error: 'Supabase error' });
    const [listing] = await resp.json();
    if (!listing) return res.status(404).json({ error: 'Not found' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch fetch listings by IDs
app.post('/api/listings/batch', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.json([]);
    const resp = await fetch(`${process.env.SUPABASE_URL}/rest/v1/listings?id=in.(${ids.join(',')})&select=*`, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!resp.ok) return res.status(500).json({ error: 'Supabase error' });
    const listings = await resp.json();
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scrape gallery images for a listing (on-demand via Decodo API)
app.post('/api/scrape/gallery', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });

    const scrapeResp = await fetch('https://scraper-api.decodo.com/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${process.env.DECODO_API_TOKEN}`,
      },
      body: JSON.stringify({ url, proxy_pool: 'premium' }),
    });
    if (!scrapeResp.ok) {
      const err = await scrapeResp.text();
      throw new Error(`Decodo error: ${scrapeResp.status} - ${err}`);
    }

    const data = await scrapeResp.json();
    const content = data.results?.[0]?.content || '';
    if (!content) return res.json({ images: [] });

    const imgRegex = /https?:\/\/img\d+\.idealista\.com\/blur\/WEB_DETAIL\/\d+\/[^"\'<>\s]+\.jpg/g;
    const rawImages = [...content.matchAll(imgRegex)].map(m => m[0]);
    const images = [...new Set(rawImages)];

    // Update Supabase
    if (images.length > 0 && req.body.id) {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/listings?id=eq.${req.body.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ images }),
      });
    }

    res.json({ images });
  } catch (err) {
    console.error('gallery scrape error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Semantic search: natural language query → embeddings → pgvector
app.post('/api/ai/semantic-search', async (req, res) => {
  try {
    const { query, limit = 10, keyword } = req.body;
    const { neighborhoods } = req.body;
    console.log(`[semantic-search] query="${query}" keyword="${keyword}" neighborhoods=${JSON.stringify(neighborhoods)} limit=${limit}`);
    if (!query) return res.status(400).json({ error: 'Query required' });

    // Get embedding for query
    const embedResp = await fetch(OPENROUTER_EMBED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'MadRent',
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: [query] }),
    });

    if (!embedResp.ok) {
      const err = await embedResp.text();
      throw new Error(`Embedding error: ${embedResp.status} - ${err}`);
    }

    const embedData = await embedResp.json();
    const queryEmbedding = embedData.data[0].embedding;

    // Helper to call Supabase RPC and apply keyword filter
    async function runSearch(useNeighborhoods) {
      const matchCount = keyword ? Math.max(limit, 50) : limit;
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/search_listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({
          query_embedding: queryEmbedding,
          match_count: matchCount,
          ...(useNeighborhoods && neighborhoods ? { neighborhoods } : {}),
        }),
      });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Supabase error: ${resp.status} - ${err}`);
      }
      let results = await resp.json();

      // Filter out listings without images
      results = results.filter((r) => r.image_url);

      // Keyword post-filter
      if (keyword) {
        const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const allKeywords = keyword.toLowerCase().split(/\s+/).filter(k => k.length > 1).map(norm);

        const floorSet = new Set([
          'atico', 'aticos', 'bajo', 'bajos', 'entreplanta', 'entresuelo',
          'sotano', 'semisotano', 'estudio', 'duplex', 'penthouse',
        ]);
        const floorKeywords = allKeywords.filter(k => floorSet.has(k));
        const generalKeywords = allKeywords.filter(k => !floorSet.has(k));

        const matchWord = (val, kw) => {
          if (!val) return false;
          const nv = norm(val);
          if (nv.includes(kw)) return true;
          const words = nv.split(/\s+/);
          return words.some(w => w === kw || kw.includes(w) || w.includes(kw));
        };
        const matchFloor = (r, kw) => matchWord(r.title, kw) || matchWord(r.description, kw) || matchWord(r.floor, kw);
        const matchGeneral = (r, kw) => matchWord(r.title, kw) || matchWord(r.description, kw) || matchWord(r.neighborhood, kw);

        if (floorKeywords.length > 0) {
          results = results.filter(r => floorKeywords.some(kw => matchFloor(r, kw)));
        }
        if (generalKeywords.length > 0) {
          results = results.filter(r => generalKeywords.some(kw => matchGeneral(r, kw)));
        }
        results = results.slice(0, limit);
      }
      return results;
    }

    const results = await runSearch(true);
    const filteredNeighborhoods = neighborhoods && neighborhoods.length > 0 ? neighborhoods : null;

    console.log(`[semantic-search] returning ${results.length} results`);
    res.json({ results, filteredNeighborhoods });
  } catch (err) {
    console.error('semantic-search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark a listing as inactive (manual report from frontend)
app.post('/api/listings/:id/mark-inactive', async (req, res) => {
  try {
    const { id } = req.params;
    await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ is_active: false }),
    });
    console.log(`[mark-inactive] listing ${id} marked as inactive`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if a listing is active (database only, no external requests)
app.post('/api/listings/:id/check-active', async (req, res) => {
  try {
    const { id } = req.params;
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}&select=is_active`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
    if (!resp.ok) return res.status(404).json({ error: 'Listing not found' });
    const [listing] = await resp.json();
    res.json({ active: listing?.is_active ?? false });
  } catch (err) {
    res.json({ active: true, reason: 'error' });
  }
});

module.exports = app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`MadRent backend running on http://localhost:${PORT}`);
    console.log(`OpenRouter key configured: ${OPENROUTER_KEY ? 'Yes' : 'NO - MISSING'}`);
  });
}
