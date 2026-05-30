export type FuelPriceQuote = {
  pricePerLiter: number;
  source: string;
};

const FETCH_TIMEOUT_MS = 12_000;

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** API Ninjas — plan gratuito; precios por país (MX). */
export async function fetchDieselFromApiNinjas(
  apiKey: string,
): Promise<FuelPriceQuote | null> {
  const body = await fetchJson<{
    fuel_prices?: Array<{
      fuel_type?: string;
      price?: number;
      currency?: string;
    }>;
  }>('https://api.api-ninjas.com/v1/latestfuelprice?country=mx', {
    headers: { 'X-Api-Key': apiKey },
  });
  const rows = body?.fuel_prices ?? [];
  const diesel = rows.find((r) =>
    (r.fuel_type ?? '').toLowerCase().includes('diesel'),
  );
  const price = diesel?.price;
  if (price == null || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  const currency = (diesel?.currency ?? 'mxn').toLowerCase();
  const mxnPerLiter =
    currency === 'mxn' || currency === 'mx' ? price : price;
  if (mxnPerLiter <= 0 || mxnPerLiter > 200) {
    return null;
  }
  return {
    pricePerLiter: round4(mxnPerLiter),
    source: 'api-ninjas:latestfuelprice:mx',
  };
}

/** OilPriceAPI — requiere API key (plan gratuito limitado). */
export async function fetchDieselFromOilPriceApi(
  apiKey: string,
  dieselCode: string,
): Promise<FuelPriceQuote | null> {
  const url = `https://api.oilpriceapi.com/v1/prices/latest?by_code=${encodeURIComponent(dieselCode)}`;
  const body = await fetchJson<{
    status?: string;
    price?: { price?: number; currency?: string; code?: string };
  }>(url, {
    headers: { Authorization: `Token ${apiKey}` },
  });
  if ((body?.status ?? '').toLowerCase() !== 'success') {
    return null;
  }
  const raw = body?.price?.price;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  const currency = (body?.price?.currency ?? 'MXN').toUpperCase();
  let mxnPerLiter = raw;
  if (currency === 'USD') {
    const rate = await fetchUsdToMxnRate();
    if (rate == null) {
      return null;
    }
    mxnPerLiter = raw * rate;
  }
  if (mxnPerLiter <= 0 || mxnPerLiter > 200) {
    return null;
  }
  return {
    pricePerLiter: round4(mxnPerLiter),
    source: `oilpriceapi:${dieselCode}`,
  };
}

async function fetchUsdToMxnRate(): Promise<number | null> {
  const body = await fetchJson<{ rates?: { MXN?: number } }>(
    'https://api.exchangerate.host/latest?base=USD&symbols=MXN',
  );
  const rate = body?.rates?.MXN;
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return rate;
}

/**
 * datos.gob.mx / CRE — CSV público (promedio nacional diésel).
 * URL configurable; parsea columna Producto=Diesel o DIESEL.
 */
export async function fetchDieselFromDatosGobCsv(
  csvUrl: string,
): Promise<FuelPriceQuote | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(csvUrl, { signal: controller.signal });
    if (!res.ok) {
      return null;
    }
    const text = await res.text();
    return parseCneDieselCsv(text);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseCneDieselCsv(csv: string): FuelPriceQuote | null {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return null;
  }
  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
  const productIdx = header.findIndex(
    (h) => h.includes('producto') || h.includes('subproducto'),
  );
  const priceIdx = header.findIndex(
    (h) =>
      h.includes('precio') ||
      h.includes('price') ||
      h.includes('venta'),
  );
  if (priceIdx < 0) {
    return null;
  }
  const prices: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const product =
      productIdx >= 0 ? (cols[productIdx] ?? '').toLowerCase() : '';
    if (productIdx >= 0 && !product.includes('diesel') && !product.includes('diésel')) {
      continue;
    }
    const raw = (cols[priceIdx] ?? '').replace(/[^\d.,]/g, '').replace(',', '.');
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n) && n > 5 && n < 200) {
      prices.push(n);
    }
  }
  if (prices.length === 0) {
    return null;
  }
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  return {
    pricePerLiter: round4(avg),
    source: 'datos-gob-mx:csv:avg',
  };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      inQuotes = !inQuotes;
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

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export async function fetchDieselFromExternalSources(config: {
  apiNinjasKey?: string;
  oilPriceApiKey?: string;
  oilPriceDieselCode?: string;
  datosGobCsvUrl?: string;
}): Promise<FuelPriceQuote | null> {
  if (config.apiNinjasKey?.trim()) {
    const q = await fetchDieselFromApiNinjas(config.apiNinjasKey.trim());
    if (q) {
      return q;
    }
  }
  if (config.oilPriceApiKey?.trim()) {
    const q = await fetchDieselFromOilPriceApi(
      config.oilPriceApiKey.trim(),
      (config.oilPriceDieselCode ?? 'DIESEL_MX').trim(),
    );
    if (q) {
      return q;
    }
  }
  if (config.datosGobCsvUrl?.trim()) {
    const q = await fetchDieselFromDatosGobCsv(config.datosGobCsvUrl.trim());
    if (q) {
      return q;
    }
  }
  return null;
}
