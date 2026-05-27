"""Idealista Spain scraper - uses curl_cffi for Cloudflare bypass"""
import re
import time
from bs4 import BeautifulSoup
from curl_cffi import requests

HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
}

BROWSER = 'chrome124'

# District-specific URLs (21 districts)
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

# Full Madrid URL (extract neighborhood from HTML)
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

_session = None


def get_session():
    global _session
    if _session is None:
        _session = requests.Session()
        # Visit homepage to get cookies (may return 403, that's ok)
        try:
            _session.get('https://www.idealista.com/', impersonate=BROWSER, timeout=30)
        except Exception:
            pass
        time.sleep(2)
    return _session


def reset_session():
    global _session
    _session = None
    return get_session()


def get_neighborhood_from_url(url):
    for key, name in NEIGHBORHOOD_MAP.items():
        if f'/madrid/{key}/' in url:
            return name
    return 'Madrid'


def extract_neighborhood_from_article(article, title, default_neighborhood):
    """Try to extract neighborhood from article HTML. Falls back to default."""
    # Try known HTML elements that contain the neighborhood
    perspective = article.find('span', class_='item-perspective')
    if perspective:
        text = clean_text(perspective.text)
        if text and text != 'Madrid':
            return text

    # Try extracting from title patterns like:
    # "Ático en Valdebebas - Valdefuentes, Madrid"
    # "Piso en Casco Histórico de Vallecas, Madrid"
    # "Dúplex en Calle Cerro del Murmullo, 13, Ensanche de Vallecas, Madrid"
    patterns = [
        r'(?:en|de)\s+([^,]+?)(?:,\s*Madrid)\s*$',  # "..., Barrio, Madrid"
        r'(?:en|de)\s+([^,]+?)(?:\s*-\s*[^,]+)?(?:,\s*Madrid)\s*$',  # "..., Barrio - Subbarrio, Madrid"
    ]
    for pattern in patterns:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            candidate = clean_text(match.group(1))
            if candidate and len(candidate) > 2 and candidate.lower() not in ('alquiler', 'venta', 'madrid'):
                return candidate

    # Try to find any neighborhood-like text in article details
    for detail in article.find_all('span', class_='item-detail'):
        text = clean_text(detail.text)
        # If detail looks like a neighborhood name (no numbers, no hab., no m², no €)
        if text and not re.search(r'\d|hab\.|m²|€', text):
            if text.lower() not in ('madrid', 'alquiler', 'venta'):
                return text

    return default_neighborhood


def fetch_search_page(url, page=1, retry=True):
    session = get_session()

    paginated_url = url
    if page > 1:
        paginated_url = url.rstrip('/') + f'/pagina-{page}.htm'

    headers = {**HEADERS, 'Referer': 'https://www.idealista.com/'}

    try:
        resp = session.get(paginated_url, headers=headers, impersonate=BROWSER, timeout=30)

        if resp.status_code == 429:
            retry_after = int(resp.headers.get('Retry-After', 30))
            time.sleep(retry_after)
            resp = session.get(paginated_url, headers=headers, impersonate=BROWSER, timeout=30)

        if resp.status_code == 403 and retry:
            time.sleep(5)
            reset_session()
            return fetch_search_page(url, page, retry=False)

        if resp.status_code != 200:
            return None

        return BeautifulSoup(resp.content, 'lxml')
    except Exception:
        return None


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
                if src and 'blur' in src:
                    image = src

            detail_items = row.find_all('span', class_='item-detail')
            detail_texts = [d.text.strip() for d in detail_items]

            rooms = ''
            size = ''
            floor = ''

            for dt in detail_texts:
                if 'hab.' in dt:
                    rooms = dt
                elif 'm²' in dt or 'm�' in dt:
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

            # Extract neighborhood from HTML when using full Madrid URL
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


def fetch_detail_page(url):
    try:
        time.sleep(1.5)
        session = get_session()
        headers = {**HEADERS, 'Referer': 'https://www.idealista.com/alquiler-viviendas/madrid/'}
        resp = session.get(url, headers=headers, impersonate=BROWSER, timeout=30)

        if resp.status_code != 200:
            return {}, '', []

        soup = BeautifulSoup(resp.content, 'lxml')

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

        # Extract all images from gallery
        images = []
        # Try multiple selectors for gallery images
        gallery_selectors = [
            'div.gallery-foto img',
            'div#fotoContainer img',
            'div.main-media img',
            'img.foto-gallery',
            '.gallery-container img',
        ]
        for selector in gallery_selectors:
            for img in soup.select(selector):
                src = img.get('src') or img.get('data-src') or ''
                if src and 'idealista' in src and src not in images:
                    # Get high-res version if available
                    if '/th/' in src:
                        src = src.replace('/th/', '/gr/')
                    elif '/sm/' in src:
                        src = src.replace('/sm/', '/gr/')
                    images.append(src)

        # If no gallery images found, try meta tags
        if not images:
            og_image = soup.find('meta', property='og:image')
            if og_image:
                src = og_image.get('content', '')
                if src:
                    images.append(src)

        return coords, description, images
    except Exception:
        return {}, '', []


def clean_text(text):
    text = text.replace('\xa0', ' ').replace('�', '')
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
