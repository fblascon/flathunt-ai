"""Idealista Spain scraper - uses Decodo API for Cloudflare bypass"""
import os
import re
import time
import base64
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DECODO_API_URL = 'https://scraper-api.decodo.com/v2/scrape'
DECODO_TOKEN = os.environ.get('DECODO_API_TOKEN', '')
DECODO_AUTH = f'Basic {DECODO_TOKEN}'

MADRID_DISTRICT_URLS = [
    'https://www.idealista.com/alquiler-viviendas/madrid/centro/',
    'https://www.idealista.com/alquiler-viviendas/madrid/chamberi/',
    'https://www.idealista.com/alquiler-viviendas/madrid/salamanca/',
    'https://www.idealista.com/alquiler-viviendas/madrid/retiro/',
    'https://www.idealista.com/alquiler-viviendas/madrid/arganzuela/',
    'https://www.idealista.com/alquiler-viviendas/madrid/chamartin/',
    'https://www.idealista.com/alquiler-viviendas/madrid/tetuan/',
    'https://www.idealista.com/alquiler-viviendas/madrid/moncloa/',
    'https://www.idealista.com/alquiler-viviendas/madrid/latina/',
    'https://www.idealista.com/alquiler-viviendas/madrid/carabanchel/',
    'https://www.idealista.com/alquiler-viviendas/madrid/ciudad-lineal/',
    'https://www.idealista.com/alquiler-viviendas/madrid/hortaleza/',
    'https://www.idealista.com/alquiler-viviendas/madrid/fuencarral-el-pardo/',
    'https://www.idealista.com/alquiler-viviendas/madrid/puente-de-vallecas/',
    'https://www.idealista.com/alquiler-viviendas/madrid/moratalaz/',
    'https://www.idealista.com/alquiler-viviendas/madrid/villaverde/',
    'https://www.idealista.com/alquiler-viviendas/madrid/vicalvaro/',
    'https://www.idealista.com/alquiler-viviendas/madrid/san-blas/',
    'https://www.idealista.com/alquiler-viviendas/madrid/usera/',
    'https://www.idealista.com/alquiler-viviendas/madrid/villa-de-vallecas/',
    'https://www.idealista.com/alquiler-viviendas/madrid/barajas/',
]

MADRID_FULL_URL = 'https://www.idealista.com/alquiler-viviendas/madrid/'
MADRID_URLS = MADRID_DISTRICT_URLS

NEIGHBORHOOD_MAP = {
    'centro': 'Centro',
    'chamberi': 'Chamberí',
    'salamanca': 'Salamanca',
    'retiro': 'Retiro',
    'arganzuela': 'Arganzuela',
    'chamartin': 'Chamartín',
    'tetuan': 'Tetuán',
    'moncloa': 'Moncloa',
    'latina': 'Latina',
    'carabanchel': 'Carabanchel',
    'ciudad-lineal': 'Ciudad Lineal',
    'hortaleza': 'Hortaleza',
    'fuencarral-el-pardo': 'Fuencarral',
    'puente-de-vallecas': 'Puente de Vallecas',
    'moratalaz': 'Moratalaz',
    'villaverde': 'Villaverde',
    'vicalvaro': 'Vicálvaro',
    'san-blas': 'San Blas',
    'usera': 'Usera',
    'villa-de-vallecas': 'Villa de Vallecas',
    'barajas': 'Barajas',
}


def fetch_page(url):
    payload = {
        'url': url,
        'proxy_pool': 'premium',
    }
    headers = {
        'Accept': 'application/json',
        'Authorization': DECODO_AUTH,
        'Content-Type': 'application/json',
    }
    resp = requests.post(DECODO_API_URL, headers=headers, json=payload, timeout=120)
    if resp.status_code != 200:
        return None
    data = resp.json()
    if 'results' not in data:
        return None
    content = data['results'][0].get('content', '')
    if not content:
        return None
    return BeautifulSoup(content, 'lxml')


def fetch_search_page(url, page=1):
    paginated_url = url
    if page > 1:
        paginated_url = url.rstrip('/') + f'/pagina-{page}.htm'
    return fetch_page(paginated_url)


def fetch_detail_page(url):
    try:
        soup = fetch_page(url)
        if soup is None:
            return {}, '', []

        description = ''
        desc_tag = soup.find('div', class_='comment')
        if not desc_tag:
            desc_tag = soup.find('div', class_='adCommentsLanguage')
        if desc_tag:
            description = desc_tag.text.strip()

        coords = {}
        map_container = soup.find('div', id='map')
        if map_container:
            lat = map_container.get('data-latitude')
            lon = map_container.get('data-longitude')
            if lat and lon:
                coords = {'latitude': float(lat), 'longitude': float(lon)}

        images = []
        seen = set()

        for match in re.finditer(r'https?://img\d+\.idealista\.com/blur/WEB_DETAIL/\d+/[^\"\'<>\s]+\.jpg', str(soup)):
            img_url = match.group(0)
            if img_url not in seen:
                seen.add(img_url)
                images.append(img_url)

        if not images:
            og_image = soup.find('meta', property='og:image')
            if og_image:
                src = og_image.get('content', '')
                if src and src not in seen:
                    seen.add(src)
                    images.append(src)

        for match in re.finditer(r'https?://img\d+\.idealista\.com/[^"\'<>\s]+\.jpg', str(soup)):
            img_url = match.group(0)
            if 'blur' in img_url and img_url not in seen:
                seen.add(img_url)
                images.append(img_url)

        return coords, description, images
    except Exception:
        return {}, '', []


def extract_listings(soup, neighborhood):
    entries = []
    if soup is None:
        return entries

    articles = soup.find_all('article', class_='item')
    base_url = 'https://www.idealista.com'

    for row in articles:
        try:
            title_row = row.find('a', class_='item-link')
            if not title_row:
                continue

            href = title_row.get('href', '')
            ad_id_match = re.search(r'/inmueble/(\d+)/', href)
            if not ad_id_match:
                continue
            ad_id = ad_id_match.group(1)

            title = title_row.text.strip()
            url = href if href.startswith('http') else base_url + href

            image = ''
            img_tag = row.find('img')
            if img_tag:
                src = img_tag.get('src') or img_tag.get('data-src') or ''
                if src:
                    image = highres_url(src)

            detail_items = row.find_all('span', class_='item-detail')
            detail_texts = [d.text.strip() for d in detail_items]

            rooms = ''
            size = ''
            floor = ''

            for dt in detail_texts:
                if 'hab.' in dt:
                    rooms = dt
                elif 'm²' in dt or 'm' in dt:
                    size = dt
                elif any(w in dt.lower() for w in ['planta', 'exterior', 'interior', 'ascensor', 'bajo', 'sin ascensor']):
                    floor = dt

            price_tag = row.find('span', class_='item-price')
            price_text = price_tag.text.strip() if price_tag else ''

            price = parse_price(price_text)
            rooms_num = parse_rooms(rooms)
            if rooms_num is None and 'studio' in title.lower():
                rooms_num = 0
            size_num = parse_number(size)
            floor_clean = parse_floor(floor)

            article_neighborhood = neighborhood
            if neighborhood == 'Madrid':
                article_neighborhood = extract_neighborhood_from_article(row, title, neighborhood)

            address = extract_address(title, article_neighborhood)

            features = []
            feature_tags = row.find_all('span', class_='item-feature')
            for ft in feature_tags:
                feat_text = clean_text(ft.text)
                if feat_text and feat_text not in features:
                    features.append(feat_text)

            entry = {
                'id': ad_id,
                'title': title,
                'url': url,
                'image': image,
                'price': price,
                'rooms': rooms_num,
                'size_m2': size_num,
                'floor': floor_clean,
                'address': address,
                'neighborhood': article_neighborhood,
                'features': features,
                'source': 'idealista',
            }
            entries.append(entry)
        except Exception:
            continue

    return entries


def highres_url(url):
    """Convert Idealista small thumbnail to larger WEB_DETAIL size."""
    if not url:
        return url
    if '/blur/' in url:
        return url.replace('480_360_mq', 'WEB_DETAIL')
    return url


def clean_text(text):
    text = text.replace('\xa0', ' ').replace('\u0080', '')
    text = ' '.join(text.split())
    return text.strip()


def parse_price(text):
    if not text:
        return None
    cleaned = re.sub(r'[^\d,.]', '', text.split('/')[0].strip())
    cleaned = cleaned.replace('.', '').replace(',', '.')
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_rooms(text):
    if not text:
        return None
    match = re.search(r'(\d+)\s*hab', text)
    if match:
        return int(match.group(1))
    match = re.search(r'(\d+)', text)
    if match:
        return int(match.group(1))
    return None


def parse_number(text):
    if not text:
        return None
    cleaned = re.sub(r'[^\d]', '', text)
    try:
        return int(cleaned) if cleaned else None
    except ValueError:
        return None


def parse_floor(text):
    if not text:
        return ''
    text = clean_text(text)
    match = re.search(r'(?:Planta|planta)\s*(\d+\w*)', text)
    if match:
        return match.group(0)
    return text


def extract_address(title, neighborhood):
    cleaned = re.sub(r'\s+en\s+(?:alquiler|venta)\s+', ' ', title, flags=re.IGNORECASE)
    match = re.search(r'en\s+((?:Calle|Av\.|Avda\.|Avenida|Plaza|Paseo|Ronda|Glorieta|Carretera|Camino|Travesía|Urbanización|Pasaje|Cuesta|Vía)\s+.+?)(?:,|$)', cleaned, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match = re.search(r'en\s+(.+?)(?:,|$)', cleaned)
    if match:
        return match.group(1).strip()
    return neighborhood


def extract_neighborhood_from_article(article, title, default_neighborhood):
    perspective = article.find('span', class_='item-perspective')
    if perspective:
        text = clean_text(perspective.text)
        if text and text != 'Madrid':
            return text
    patterns = [
        r'(?:en|de)\s+([^,]+?)(?:,\s*Madrid)\s*$',
        r'(?:en|de)\s+([^,]+?)(?:\s*-\s*[^,]+)?(?:,\s*Madrid)\s*$',
    ]
    for pattern in patterns:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            candidate = clean_text(match.group(1))
            if candidate and len(candidate) > 2 and candidate.lower() not in ('alquiler', 'venta', 'madrid'):
                return candidate
    for detail in article.find_all('span', class_='item-detail'):
        text = clean_text(detail.text)
        if text and not re.search(r'\d|hab\.|m²|€', text):
            if text.lower() not in ('madrid', 'alquiler', 'venta'):
                return text
    return default_neighborhood


def get_neighborhood_from_url(url):
    for key, name in NEIGHBORHOOD_MAP.items():
        if f'/madrid/{key}/' in url:
            return name
    return 'Madrid'
