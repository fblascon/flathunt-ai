"""Generate embeddings for listings using OpenRouter and store in Supabase"""
import os
import json
import time
import urllib.request
import urllib.error
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
OPENROUTER_KEY = os.environ.get('OPENROUTER_API_KEY', '')
OPENROUTER_URL = 'https://openrouter.ai/api/v1/embeddings'
EMBEDDING_MODEL = 'openai/text-embedding-3-small'

BATCH_SIZE = 10


def supabase_request(method, path, body=None, max_retries=3):
    url = f'{SUPABASE_URL}/rest/v1{path}'
    data = json.dumps(body).encode('utf-8') if body else None

    for attempt in range(max_retries):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header('apikey', SUPABASE_KEY)
        req.add_header('Authorization', f'Bearer {SUPABASE_KEY}')
        req.add_header('Content-Type', 'application/json')

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read().decode('utf-8')
                if not raw or not raw.strip():
                    return {'status': resp.status}
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            status = e.code
            body = e.read().decode()
            print(f'  Supabase HTTP {status}: {body}')
            if status == 429 or status >= 500:
                wait = 2 ** attempt
                print(f'  Reintentando Supabase en {wait}s (intento {attempt + 1}/{max_retries})...')
                time.sleep(wait)
                continue
            return None
        except (TimeoutError, urllib.error.URLError, OSError) as e:
            print(f'  Supabase error de red: {e}')
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                print(f'  Reintentando Supabase en {wait}s (intento {attempt + 1}/{max_retries})...')
                time.sleep(wait)
                continue
            return None

    print('  Supabase: agotados todos los reintentos')
    return None


def get_embeddings(texts, max_retries=3):
    req = urllib.request.Request(OPENROUTER_URL)
    req.add_header('Authorization', f'Bearer {OPENROUTER_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('HTTP-Referer', 'http://localhost:3001')
    req.add_header('X-Title', 'FlatHunt AI')
    data = json.dumps({
        'model': EMBEDDING_MODEL,
        'input': texts,
    }).encode('utf-8')
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, data=data, timeout=60) as r:
                result = json.loads(r.read().decode('utf-8'))
                return [item['embedding'] for item in result['data']]
        except urllib.error.HTTPError as e:
            status = e.code
            body = e.read().decode()
            print(f'  OpenRouter HTTP {status}: {body}')
            if status == 429 or status >= 500:
                wait = 2 ** attempt
                print(f'  Reintentando en {wait}s (intento {attempt + 1}/{max_retries})...')
                time.sleep(wait)
                continue
            return None
        except (TimeoutError, urllib.error.URLError, OSError) as e:
            print(f'  OpenRouter error de red: {e}')
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                print(f'  Reintentando en {wait}s (intento {attempt + 1}/{max_retries})...')
                time.sleep(wait)
                continue
            return None
    print('  OpenRouter: agotados todos los reintentos')
    return None


def build_listing_text(listing):
    parts = [
        f"{listing.get('title', '')}",
        f"{listing.get('price', '')}€/mes",
        f"{listing.get('rooms', '')} habitaciones",
        f"{listing.get('size_m2', '')}m²",
        f"{listing.get('floor', '')}",
        f"en {listing.get('neighborhood', '')}",
        f"{listing.get('address', '')}",
    ]
    if listing.get('description'):
        parts.append(listing.get('description', ''))
    if listing.get('features'):
        parts.append('Características: ' + ', '.join(listing.get('features', [])))

    return ' | '.join(filter(None, parts))


def generate_embeddings(force=False):
    print('Fetching listings without embeddings...' if not force else 'Fetching ALL listings for regeneration...')

    filter_clause = '&embedding=is.null' if not force else ''
    listings = supabase_request('GET', f'/listings?select=id,title,price,rooms,size_m2,floor,neighborhood,address,description,features{filter_clause}&limit=3000')

    if not listings or not isinstance(listings, list):
        print('No listings need embeddings (or error)')
        return

    print(f'Found {len(listings)} listings to embed')

    for i in range(0, len(listings), BATCH_SIZE):
        batch = listings[i:i + BATCH_SIZE]
        texts = [build_listing_text(l) for l in batch]
        ids = [l['id'] for l in batch]

        print(f'  Batch {i//BATCH_SIZE + 1}: embedding {len(batch)} listings...')
        embeddings = get_embeddings(texts)

        if embeddings is None:
            print('  Failed to get embeddings, stopping')
            return

        for j, listing_id in enumerate(ids):
            # Store embedding using PATCH
            patch_body = {'embedding': embeddings[j]}
            supabase_request('PATCH', f'/listings?id=eq.{listing_id}', body=patch_body)

        time.sleep(0.5)

    print(f'Done. Embedded {len(listings)} listings.')


def search_similar(query_text: str, limit: int = 10):
    """Semantic search: generate query embedding and find similar listings"""
    embeddings = get_embeddings([query_text])
    if not embeddings:
        return []

    query_embedding = embeddings[0]

    # Use pgvector cosine similarity via RPC
    body = {
        'query_embedding': query_embedding,
        'match_count': limit,
    }

    result = supabase_request('POST', '/rpc/search_listings', body=body)

    if result:
        return result
    return []


if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == '--search':
        query = ' '.join(sys.argv[2:]) if len(sys.argv) > 2 else 'piso luminoso con terraza en el centro'
        print(f'Searching: "{query}"')
        results = search_similar(query)
        for r in results:
            print(f"  {r.get('title', '')[:60]} - {r.get('price', '')}€ - {r.get('neighborhood', '')}")
        if not results:
            print('  No results (make sure search_listings RPC exists in Supabase)')
    else:
        force = len(sys.argv) > 1 and sys.argv[1] == '--regenerate'
        generate_embeddings(force=force)
