"""Repair: fetch detail pages for listings missing gallery images"""
import os
import sys
import json
import time
import urllib.request
import urllib.error
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from idealista_spain import fetch_detail_page

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
DECODO_API_TOKEN = os.environ.get('DECODO_API_TOKEN', '')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
    sys.exit(1)


def supabase_req(method, path, body=None):
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
            if not raw.strip():
                return {'status': resp.status}
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        print(f'  Supabase error {e.code}: {body}')
        return None


def get_listings_missing_images():
    result = supabase_req('GET', '/listings?select=id,external_url,images&is_active=is.true&limit=2000')
    if not isinstance(result, list):
        print('  Failed to fetch listings')
        return []
    return [r for r in result if not r.get('images')]


def mark_inactive(listing_id):
    body = {'is_active': False}
    result = supabase_req('PATCH', f'/listings?id=eq.{listing_id}', body)
    return result is not None


def update_images(listing_id, images):
    body = {'images': images}
    result = supabase_req('PATCH', f'/listings?id=eq.{listing_id}', body)
    return result is not None


def main():
    print('Fetching listings missing gallery images...')
    listings = get_listings_missing_images()
    print(f'Found {len(listings)} listings to process')
    print()

    updated = 0
    inactive = 0
    for i, row in enumerate(listings):
        url = row['external_url']
        print(f'  [{i+1}/{len(listings)}] {row["id"][:12]}... ', end='', flush=True)

        try:
            import requests as req_lib
            resp = req_lib.head(url, allow_redirects=True, timeout=10)
            is_404 = resp.status_code in (404, 410)
        except:
            is_404 = False

        try:
            coords, description, images = fetch_detail_page(url)
        except Exception as e:
            print(f'ERROR: {e}')
            continue

        if images:
            print(f'{len(images)} images', end='', flush=True)
            if update_images(row['id'], images):
                updated += 1
                print(' updated')
            else:
                print(' update failed')
        elif is_404:
            if mark_inactive(row['id']):
                inactive += 1
                print('404 → marked inactive')
            else:
                print('404 but failed to mark inactive')
        else:
            print('no images found')
        time.sleep(2)

    print()
    print(f'Done: {updated} updated, {inactive} marked inactive')


if __name__ == '__main__':
    main()
