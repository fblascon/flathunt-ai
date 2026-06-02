"""Cleanup: mark inactive listings without external API calls"""
import os
import sys
import json
import io
from datetime import datetime, timedelta
import urllib.request
import urllib.error

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

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


def main():
    print('Fetching active listings...')

    # Get listings with empty image_url
    result1 = supabase_req('GET', '/listings?select=id&is_active=eq.true&image_url=eq.&limit=2000')
    if isinstance(result1, list):
        ids1 = [r['id'] for r in result1 if 'id' in r]
        print(f'Empty image_url: {len(ids1)}')
        if ids1:
            supabase_req('PATCH', f'/listings?id=in.({",".join(ids1)})', {'is_active': False})
            print(f'  → Marked {len(ids1)} as inactive')
    else:
        print('  Failed to fetch')
        ids1 = []

    # Get listings with last_seen older than 7 days
    cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()
    result2 = supabase_req(
        'GET',
        f'/listings?select=id&is_active=eq.true&last_seen=lt.{cutoff}&limit=2000'
    )
    if isinstance(result2, list):
        ids2 = [r['id'] for r in result2 if 'id' in r]
        print(f'last_seen > 7 days: {len(ids2)}')
        if ids2:
            supabase_req('PATCH', f'/listings?id=in.({",".join(ids2)})', {'is_active': False})
            print(f'  → Marked {len(ids2)} as inactive')
    else:
        print('  Failed to fetch')
        ids2 = []

    print(f'\nTotal marked inactive: {len(ids1) + len(ids2)}')
    print('Done!')


if __name__ == '__main__':
    main()
