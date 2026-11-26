/**
 * Regenera src/tolls/data/toll-plazas.seed.json desde data/tolls/*.csv
 * (casetas_2025.csv + tarifas_2025.csv unidos por ID_PLAZA).
 *
 * La RNC registra un punto por sentido (y a veces por cabina). Se fusionan
 * filas cercanas (≤150 m) del mismo nombre o misma sección. Los `N/D` se
 * renombran a partir de la sección cuando es posible.
 *
 * Uso: node scripts/build-toll-plazas-seed.mjs
 */
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data', 'tolls');
const outFile = path.join(root, 'src', 'tolls', 'data', 'toll-plazas.seed.json');

/** Radio para fusionar sentidos/cabinas de la misma plaza física. */
const DEDUPE_RADIUS_M = 150;

const PRICE_KEYS = [
  'tEjeLig',
  'tAutobus2',
  'tAutobus3',
  'tAutobus4',
  'tCamion2',
  'tCamion3',
  'tCamion4',
  'tCamion5',
  'tCamion6',
  'tCamion7',
  'tCamion8',
  'tCamion9',
  'tEjePes',
];

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function loadCsv(fileName) {
  const filePath = path.join(dataDir, fileName);
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let headers = null;
  const rows = [];
  for await (const rawLine of rl) {
    const line = rawLine.replace(/^\uFEFF/, '');
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    if (!headers) {
      headers = cells.map((h) => h.trim());
      continue;
    }
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function toNum(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isUnresolvedName(name) {
  const t = normalizeKey(name);
  return !t || t === 'n/d' || t === 'nd' || t === 's/d' || t === 'caseta';
}

/**
 * Cuando el CSV trae NOMBRE=N/D, recupera un nombre usable desde SECCION.
 */
function resolvePlazaName(rawName, section) {
  const name = String(rawName || '').trim();
  if (!isUnresolvedName(name)) {
    return name;
  }
  const sec = String(section || '').trim();
  if (!sec || isUnresolvedName(sec)) {
    return name || 'Caseta';
  }
  const secNorm = normalizeKey(sec);
  if (secNorm.includes('san marcos')) return 'San Marcos';
  if (secNorm.includes('sayula')) return 'Sayula';
  // Caseta operativa conocida en corredor Colima–GDL (alias histórico Sayula).
  if (secNorm.includes('atoyac') && secNorm.includes('guzm')) return 'Sayula';

  const cleaned = sec
    .replace(/^(entronque|caseta|plaza(?:\s+de\s+cobro)?)\s+/i, '')
    .trim();
  const left = cleaned.split(/\s*[-–—]\s*/)[0]?.trim() || cleaned;
  if (left && !isUnresolvedName(left) && left.length <= 48) {
    return left;
  }
  return name || 'Caseta';
}

function haversineMeters(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pickTarifa(rows) {
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => {
    const score = (r) => {
      let s = 0;
      if (r.NOMBRE_ENT === r.NOMBRE_SAL) s += 100;
      if (String(r.ID_PLAZA) === String(r.ID_PLAZA_E)) s += 10;
      s -= Number(r.fid) || 0;
      return s;
    };
    return score(b) - score(a);
  })[0];
}

function priceFilledCount(row) {
  let n = 0;
  for (const key of PRICE_KEYS) {
    const v = row[key];
    if (v != null && Number.isFinite(v) && v > 0) n += 1;
  }
  return n;
}

function mergeCluster(members) {
  const sorted = [...members].sort((a, b) => a.plazaId - b.plazaId);
  const primary = sorted.reduce((best, row) =>
    priceFilledCount(row) > priceFilledCount(best) ? row : best,
  );
  const lat = sorted.reduce((sum, row) => sum + row.lat, 0) / sorted.length;
  const lng = sorted.reduce((sum, row) => sum + row.lng, 0) / sorted.length;
  const prices = {};
  for (const key of PRICE_KEYS) {
    let chosen = null;
    for (const row of sorted) {
      const v = row[key];
      if (v != null && Number.isFinite(v) && v > 0) {
        chosen = chosen == null ? v : Math.max(chosen, v);
      }
    }
    prices[key] = chosen;
  }
  const section = primary.section;
  return {
    plazaId: sorted[0].plazaId,
    name: resolvePlazaName(primary.name, section),
    section,
    lat: Math.round(lat * 1e7) / 1e7,
    lng: Math.round(lng * 1e7) / 1e7,
    ...prices,
  };
}

function samePlazaCluster(a, b, radiusM) {
  if (haversineMeters(a, b) > radiusM) {
    return false;
  }
  const nameA = normalizeKey(a.name);
  const nameB = normalizeKey(b.name);
  const secA = normalizeKey(a.section);
  const secB = normalizeKey(b.section);
  if (nameA && nameA === nameB) {
    return true;
  }
  if (secA && secA === secB) {
    return true;
  }
  // N/D cercanos en el mismo corredor (secciones casi iguales / typos).
  if (isUnresolvedName(a.name) && isUnresolvedName(b.name) && secA && secB) {
    if (secA.includes(secB) || secB.includes(secA)) {
      return true;
    }
    const tokensA = new Set(secA.split(/[^a-z0-9]+/).filter((t) => t.length > 3));
    const tokensB = secB.split(/[^a-z0-9]+/).filter((t) => t.length > 3);
    const overlap = tokensB.filter((t) => tokensA.has(t)).length;
    if (overlap >= 2) {
      return true;
    }
  }
  return false;
}

/**
 * Une sentidos/cabinas de la misma plaza física.
 */
function dedupeDirectionPairs(rows, radiusM = DEDUPE_RADIUS_M) {
  const parent = new Map(rows.map((r) => [r.plazaId, r.plazaId]));
  const find = (id) => {
    let cur = id;
    while (parent.get(cur) !== cur) {
      parent.set(cur, parent.get(parent.get(cur)));
      cur = parent.get(cur);
    }
    return cur;
  };
  const unite = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // Grid grueso para no hacer N² completo (~1° ≈ 111 km; celdas ~0.05°).
  const cell = 0.05;
  const buckets = new Map();
  for (const row of rows) {
    const key = `${Math.floor(row.lat / cell)}:${Math.floor(row.lng / cell)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }

  const neighbors = (row) => {
    const i0 = Math.floor(row.lat / cell);
    const j0 = Math.floor(row.lng / cell);
    const out = [];
    for (let di = -1; di <= 1; di += 1) {
      for (let dj = -1; dj <= 1; dj += 1) {
        const list = buckets.get(`${i0 + di}:${j0 + dj}`);
        if (list) out.push(...list);
      }
    }
    return out;
  };

  for (const row of rows) {
    for (const other of neighbors(row)) {
      if (other.plazaId <= row.plazaId) continue;
      if (samePlazaCluster(row, other, radiusM)) {
        unite(row.plazaId, other.plazaId);
      }
    }
  }

  const clusters = new Map();
  for (const row of rows) {
    const root = find(row.plazaId);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(row);
  }

  const merged = [];
  let collapsed = 0;
  for (const members of clusters.values()) {
    if (members.length > 1) collapsed += members.length - 1;
    merged.push(mergeCluster(members));
  }
  merged.sort((a, b) => a.plazaId - b.plazaId);
  return { merged, collapsed };
}

const casetas = await loadCsv('casetas_2025.csv');
const tarifas = await loadCsv('tarifas_2025.csv');
const byPlaza = new Map();
for (const row of tarifas) {
  const id = String(row.ID_PLAZA || '').trim();
  if (!id) continue;
  if (!byPlaza.has(id)) byPlaza.set(id, []);
  byPlaza.get(id).push(row);
}

const rawSeed = [];
for (const c of casetas) {
  const plazaId = Number(c.ID_PLAZA);
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  if (!Number.isFinite(plazaId) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    continue;
  }
  const tarifa = pickTarifa(byPlaza.get(String(c.ID_PLAZA)));
  const section = String(c.SECCION || '').trim() || null;
  const rawName = String(c.NOMBRE || '').trim() || `Plaza ${plazaId}`;
  rawSeed.push({
    plazaId,
    name: resolvePlazaName(rawName, section),
    section,
    lat,
    lng,
    tEjeLig: tarifa ? toNum(tarifa.T_EJE_LIG) : null,
    tAutobus2: tarifa ? toNum(tarifa.T_AUTOBUS2) : null,
    tAutobus3: tarifa ? toNum(tarifa.T_AUTOBUS3) : null,
    tAutobus4: tarifa ? toNum(tarifa.T_AUTOBUS4) : null,
    tCamion2: tarifa ? toNum(tarifa.T_CAMION2) : null,
    tCamion3: tarifa ? toNum(tarifa.T_CAMION3) : null,
    tCamion4: tarifa ? toNum(tarifa.T_CAMION4) : null,
    tCamion5: tarifa ? toNum(tarifa.T_CAMION5) : null,
    tCamion6: tarifa ? toNum(tarifa.T_CAMION6) : null,
    tCamion7: tarifa ? toNum(tarifa.T_CAMION7) : null,
    tCamion8: tarifa ? toNum(tarifa.T_CAMION8) : null,
    tCamion9: tarifa ? toNum(tarifa.T_CAMION9) : null,
    tEjePes: tarifa ? toNum(tarifa.T_EJE_PES) : null,
  });
}

const { merged: seed, collapsed } = dedupeDirectionPairs(rawSeed);
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(seed), 'utf8');
const withPrices = seed.filter((r) => r.tCamion2 != null || r.tEjeLig != null).length;
console.log(
  `toll-plazas seed: ${rawSeed.length} filas CSV → ${seed.length} plazas ` +
    `(−${collapsed} sentidos/cabinas duplicados; ${withPrices} con tarifas) → ` +
    `${path.relative(root, outFile)}`,
);
