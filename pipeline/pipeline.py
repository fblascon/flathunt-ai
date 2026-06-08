"""Pipeline: scrape Idealista Madrid via Decodo API -> Supabase"""
import os
import sys
import json
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from idealista_spain import (
    MADRID_URLS,
    fetch_search_page,
    extract_listings,
    fetch_detail_page,
    get_neighborhood_from_url,
)

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

BATCH_SIZE = 20
MAX_DETAIL_FETCH = 50
REQUEST_DELAY = 2

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
    sys.exit(1)


def supabase_request(method, path, body=None):
    url = f'{SUPABASE_URL}/rest/v1{path}'
    data = json.dumps(body).encode('utf-8') if body else None

    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('apikey', SUPABASE_SERVICE_KEY)
    req.add_header('Authorization', f'Bearer {SUPABASE_SERVICE_KEY}')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Prefer', 'resolution=merge-duplicates')

    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode('utf-8')
            if not raw or not raw.strip():
                return {'status': resp.status}
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        print(f'  Supabase error {e.code}: {body}')
        return None


def upsert_listings(listings):
    now = datetime.now(timezone.utc).isoformat()
    batch = []

    for l in listings:
        images = l.get('images', [])
        image_url = l['image'] if l.get('image') else (images[0] if images else '')

        batch.append({
            'id': l['id'],
            'title': l['title'],
            'price': l['price'],
            'rooms': l['rooms'],
            'size_m2': l['size_m2'],
            'floor': l.get('floor', ''),
            'address': l['address'],
            'neighborhood': l['neighborhood'],
            'image_url': image_url,
            'external_url': l['url'],
            'latitude': l.get('latitude'),
            'longitude': l.get('longitude'),
            'description': l.get('description', ''),
            'features': l.get('features', []),
            'images': images,
            'source': l.get('source', 'idealista'),
            'first_seen': now,
            'last_seen': now,
            'is_active': True,
        })

    result = supabase_request('POST', '/listings', body=batch)
    if result is None:
        print('  Failed to upsert batch')
    return result


def scrape_all(max_pages=1, fetch_details=MAX_DETAIL_FETCH):
    all_listings = []
    seen_ids = set()

    urls = MADRID_URLS
    mode = f'{len(MADRID_URLS)} districts'

    print(f'Scraping {mode} (max {max_pages} pages each)...')
    print()

    for i, url in enumerate(urls):
        neighborhood = get_neighborhood_from_url(url)
        district_name = url.split('/madrid/')[-1].strip('/') if '/madrid/' in url else 'madrid'
        print(f'[{i+1}/{len(urls)}] {neighborhood} ({district_name})...')

        for page in range(1, max_pages + 1):
            soup = fetch_search_page(url, page)
            if soup is None:
                print(f'  Page {page}: no response')
                time.sleep(REQUEST_DELAY * 2)
                continue

            listings = extract_listings(soup, neighborhood)
            new_count = 0
            for listing in listings:
                if listing['id'] not in seen_ids:
                    seen_ids.add(listing['id'])
                    all_listings.append(listing)
                    new_count += 1

            print(f'  Page {page}: {len(listings)} found, {new_count} new')
            time.sleep(REQUEST_DELAY)

    print()
    print(f'Total unique listings: {len(all_listings)}')

    detail_limit = min(fetch_details, len(all_listings))
    if detail_limit > 0:
        print(f'Fetching details for first {detail_limit} listings...')
        for i, listing in enumerate(all_listings[:detail_limit]):
            print(f'  [{i+1}/{detail_limit}] {listing["title"][:60]}...')
            coords, description, images, detail_features = fetch_detail_page(listing['url'])
            listing.update(coords)
            listing['description'] = description or ''
            listing['images'] = images or []
            if detail_features:
                listing['features'] = detail_features
            time.sleep(1.5)

    print()
    print(f'Pushing {len(all_listings)} listings to Supabase...')

    for i in range(0, len(all_listings), BATCH_SIZE):
        batch = all_listings[i:i + BATCH_SIZE]
        print(f'  Batch {i//BATCH_SIZE + 1}: {len(batch)} listings')
        upsert_listings(batch)
        time.sleep(1)

    print()
    print('Pipeline complete.')
    print(f'  Scraped:   {len(all_listings)} listings')
    print(f'  Upserted:  into supabase listings table')
    return all_listings


def mark_old_inactive():
    print('Marking old listings as inactive...')
    cutoff = datetime.now(timezone.utc).replace(day=datetime.now(timezone.utc).day - 7).isoformat()
    result = supabase_request('PATCH', f'/listings?last_seen=lt.{cutoff}',
                              body={'is_active': False})
    if result is not None:
        print('  Done')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='FlatHunt AI Pipeline')
    parser.add_argument('--pages', type=int, default=5, help='Pages per district (default: 5)')
    parser.add_argument('--detail-limit', type=int, default=MAX_DETAIL_FETCH,
                        help=f'Max detail pages (default: {MAX_DETAIL_FETCH}, 0 to skip)')
    parser.add_argument('--cleanup', action='store_true', help='Mark old listings inactive')
    args = parser.parse_args()

    if args.cleanup:
        mark_old_inactive()

    scrape_all(max_pages=args.pages, fetch_details=args.detail_limit)
