const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const BARRIOS_URL =
  'https://datos.comunidad.madrid/catalogo/dataset/1f704f27-8e07-42ae-b456-e4b6321d7dc3/resource/2dfa85cc-c5ce-4e08-aa1f-491f398d00a0/download/barrios_municipio_madrid.csv';

const DISTRICTS_PATH = path.join(__dirname, '..', 'src', 'app', 'data', 'madrid-districts.json');

const INFORMAL = {
  Hortaleza: ['Sanchinarro', 'Valdebebas'],
  'Villa de Vallecas': ['Ensanche de Vallecas'],
  Vicálvaro: ['Valdebernardo', 'Valderrivas', 'El Cañaveral', 'Casco Histórico de Vicálvaro'],
  'San Blas-Canillejas': ['Salvador'],
  'Puente de Vallecas': ['Numancia', 'Palomeras', 'San Diego'],
  'Ciudad Lineal': ['Pueblo Nuevo', 'Rosas', 'Arcos', 'Simancas'],
  Villaverde: ['Villaverde Alto', 'Los Ángeles', 'San Cristóbal de los Ángeles'],
};

const OFFICIAL_DISTRICTS = [
  { number: '01', name: 'Centro' },
  { number: '02', name: 'Arganzuela' },
  { number: '03', name: 'Retiro' },
  { number: '04', name: 'Salamanca' },
  { number: '05', name: 'Chamartín' },
  { number: '06', name: 'Tetuán' },
  { number: '07', name: 'Chamberí' },
  { number: '08', name: 'Fuencarral-El Pardo' },
  { number: '09', name: 'Moncloa-Aravaca' },
  { number: '10', name: 'Latina' },
  { number: '11', name: 'Carabanchel' },
  { number: '12', name: 'Usera' },
  { number: '13', name: 'Puente de Vallecas' },
  { number: '14', name: 'Moratalaz' },
  { number: '15', name: 'Ciudad Lineal' },
  { number: '16', name: 'Hortaleza' },
  { number: '17', name: 'Villaverde' },
  { number: '18', name: 'Villa de Vallecas' },
  { number: '19', name: 'Vicálvaro' },
  { number: '20', name: 'San Blas-Canillejas' },
  { number: '21', name: 'Barajas' },
];

function norm(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function fetchAsLatin1(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirect = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchAsLatin1(redirect).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve(Buffer.concat(chunks).toString('latin1'));
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading official barrios CSV...');
  const raw = await fetchAsLatin1(BARRIOS_URL);

  const lines = raw.trim().split('\n');
  const csvRows = lines.slice(1).map((l) => {
    const cols = l.split(';').map((s) => s.trim());
    return { dName: cols[3] || '', bName: cols[1] || '' };
  });

  const csvDistricts = new Map();
  for (const r of csvRows) {
    if (!r.dName) continue;
    const n = norm(r.dName);
    if (!csvDistricts.has(n)) csvDistricts.set(n, []);
    csvDistricts.get(n).push(r.bName);
  }

  const current = JSON.parse(fs.readFileSync(DISTRICTS_PATH, 'utf-8'));
  const currentDistricts = current.districts;

  let hasChanges = false;

  for (const official of OFFICIAL_DISTRICTS) {
    const csvKey = norm(official.name);
    const csvBarrios = csvDistricts.get(csvKey) || [];
    const officialBarrios = [...new Set(csvBarrios)];

    const currentIdx = currentDistricts.findIndex(
      (d) => norm(d.name) === norm(official.name),
    );

    if (currentIdx === -1) {
      console.log(`  NEW district: ${official.name}`);
      currentDistricts.push({
        id: currentDistricts.length + 1,
        name: official.name,
        number: official.number,
        neighborhoods: officialBarrios.map((b, j) => ({
          id: official.number + String(j + 1),
          name: b,
        })),
      });
      hasChanges = true;
      continue;
    }

    const currentD = currentDistricts[currentIdx];
    const currentNames = currentD.neighborhoods.map((n) => n.name);
    const currentNorm = new Set(currentNames.map((n) => norm(n)));
    const informal = INFORMAL[official.name] || [];

    for (const b of officialBarrios) {
      if (!currentNorm.has(norm(b)) && !informal.some((i) => norm(i) === norm(b))) {
        const nextId = currentD.neighborhoods.length + 1;
        currentD.neighborhoods.push({
          id: official.number + String(nextId),
          name: b,
        });
        console.log(`  ${official.name}: added "${b}"`);
        hasChanges = true;
      }
    }

    for (const c of currentNames) {
      if (!officialBarrios.some((b) => norm(b) === norm(c)) &&
          !informal.some((i) => norm(i) === norm(c))) {
        console.log(`  ${official.name}: keeping "${c}" (not in CSV but defined in JSON)`);
      }
    }
  }

  for (const currentD of currentDistricts) {
    if (!OFFICIAL_DISTRICTS.some((o) => norm(o.name) === norm(currentD.name))) {
      console.log(`  EXTRA district: ${currentD.name} (keeping)`);
    }
  }

  if (hasChanges) {
    const output = { districts: currentDistricts };
    fs.writeFileSync(DISTRICTS_PATH, JSON.stringify(output, null, 2) + '\n', 'utf-8');
    console.log(`\nUpdated ${DISTRICTS_PATH}`);
  } else {
    console.log('\nNo changes needed.');
  }

  const totalBarrios = currentDistricts.reduce((s, d) => s + d.neighborhoods.length, 0);
  console.log(`\nTotal: ${currentDistricts.length} districts, ${totalBarrios} neighborhoods`);
}

main().catch(console.error);
