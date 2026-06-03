const fs = require('fs');
const path = require('path');

const VIALES_URL =
  'https://datos.madrid.es/dataset/213605-0-callejero-oficial-madrid/resource/213605-3-callejero-oficial-madrid-csv/download/vialesvigentesdistritosbarrios_20260531.csv';
const BARRIOS_URL =
  'https://datos.comunidad.madrid/catalogo/dataset/1f704f27-8e07-42ae-b456-e4b6321d7dc3/resource/2dfa85cc-c5ce-4e08-aa1f-491f398d00a0/download/barrios_municipio_madrid.csv';

const MADRID_PREFIX = '0796';
const BARRIOS_CSV = path.join(__dirname, 'barrios_municipio_madrid.csv');
const VIALES_CSV = path.join(__dirname, 'vialesvigentesdistritosbarrios.csv');
const OUTPUT = path.join(__dirname, '..', 'madrid-streets.json');

function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(s) {
  return stripAccents(s).toLowerCase().trim().replace(/\s+/g, ' ');
}

async function download(url, dest) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download ${url}: ${resp.status}`);
  const text = await resp.text();
  fs.writeFileSync(dest, text, 'utf-8');
  console.log(`  Downloaded ${text.split('\n').length} lines → ${dest}`);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(';').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(';').map((v) => v.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = vals[i] || ''));
    return row;
  });
}

async function main() {
  console.log('Downloading barrios CSV...');
  await download(BARRIOS_URL, BARRIOS_CSV);
  console.log('Downloading viales CSV...');
  await download(VIALES_URL, VIALES_CSV);

  const barriosText = fs.readFileSync(BARRIOS_CSV, 'utf-8');
  const vialesText = fs.readFileSync(VIALES_CSV, 'utf-8');

  const barrios = parseCSV(barriosText);
  const viales = parseCSV(vialesText);

  const barrioCodeMap = {};
  const distritoCodeMap = {};
  for (const b of barrios) {
    const dCode = b.distrito_codigo.trim();
    const bCode = b.barrio_codigo.trim();
    barrioCodeMap[bCode] = b.barrio_nombre.trim();
    distritoCodeMap[dCode] = b.distrito_nombre.trim();
  }

  const streetMap = {};
  let count = 0;

  for (const v of viales) {
    const clase = v.VIA_CLASE.trim();
    const par = v.VIA_PAR.trim();
    const nombre = v.VIA_NOMBRE.trim();
    const distritoNum = v.DISTRITO.trim().padStart(2, '0');
    const barrioNum = v.BARRIO.trim();

    const distritoCode = MADRID_PREFIX + distritoNum;
    const barrioCode = MADRID_PREFIX + distritoNum + barrioNum;

    const distrito = distritoCodeMap[distritoCode] || distritoNum;
    const barrio = barrioCodeMap[barrioCode] || '';

    const fullParts = [clase, par, nombre].filter(Boolean);
    const fullName = fullParts.join(' ');

    const variants = [
      fullName,
      ...(par ? [`${par} ${nombre}`] : []),
      nombre,
    ];

    for (const raw of variants) {
      const key = normalize(raw);
      if (!key || key.length < 3) continue;

      const existing = streetMap[key];
      if (!existing) {
        streetMap[key] = {
          name: raw,
          distrito,
          barrio,
          distritoCode: distritoNum,
        };
        count++;
      }
    }
  }

  const result = {
    generated: new Date().toISOString(),
    count,
    streets: streetMap,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(result), 'utf-8');
  console.log(`\nDone! ${count} street variants indexed → ${OUTPUT} (${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1)} MB)`);
}

main().catch(console.error);
