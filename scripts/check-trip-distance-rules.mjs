#!/usr/bin/env node
/**
 * Guardrails backend — distancias operativas.
 * Ejecutar: npm run check:trip-distance
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tripsRoot = path.join(__dirname, '../src/trips');
const fuelRoot = path.join(__dirname, '../src/fuel');

function ruleFilePath(relativeFile) {
  if (relativeFile.includes('fuel-price.service')) {
    return path.join(fuelRoot, 'fuel-price.service.ts');
  }
  return path.join(tripsRoot, relativeFile);
}

const FORBIDDEN = [
  {
    id: 'fuel-no-inline-times-two',
    file: 'fuel/fuel-estimator.service.ts',
    re: /dto\.distanceKm\s*\*\s*2/,
    message: 'FuelEstimator debe usar resolveTripOperationalDistance, no dto.distanceKm * 2.',
  },
  {
    id: 'trips-no-inline-times-two',
    file: 'trips.service.ts',
    re: /routeDistanceKm\s*\*\s*2/,
    message: 'TripsService debe usar resolveTripOperationalDistance, no multiplicar inline.',
  },
  {
    id: 'fuel-no-hardcoded-diesel',
    file: 'fuel/fuel-estimator.service.ts',
    re: /DEFAULT_DIESEL|25\.5/,
    message: 'FuelEstimator no debe hardcodear precio diesel; usar FuelPriceService.',
  },
];

const REQUIRED = [
  {
    file: 'trip-operational-distance.util.ts',
    includes: ['isRoundTrip !== false', 'operationalDistanceKm'],
  },
  {
    file: 'fuel/fuel-estimator.service.ts',
    includes: [
      'resolveTripOperationalDistance',
      'operationalDistanceKm / adjustedKmPerLiter',
      'fuelPriceService.getCurrentDieselPrice',
    ],
  },
  {
    file: 'trips.service.ts',
    includes: ['resolveTripOperationalDistance'],
  },
  {
    file: 'trips.mapper.ts',
    includes: ['operationalKmFromStoredTrip', 'dieselPricePerLiterAtCreation'],
  },
  {
    file: 'fuel/fuel-price.service.ts',
    includes: [
      'refreshInFlight',
      '[FuelPrice][CacheHit]',
      '[FuelPrice][CacheMiss]',
      '[FuelPrice][ExternalFetch]',
      '[FuelPrice][Fallback]',
    ],
  },
];

function main() {
  const violations = [];

  for (const rule of FORBIDDEN) {
    const file = ruleFilePath(rule.file);
    const content = fs.readFileSync(file, 'utf8');
    if (rule.re.test(content)) {
      violations.push({ rule: rule.id, file: rule.file, message: rule.message });
    }
  }

  for (const req of REQUIRED) {
    const file = ruleFilePath(req.file);
    const content = fs.readFileSync(file, 'utf8');
    for (const snippet of req.includes) {
      if (!content.includes(snippet)) {
        violations.push({
          rule: 'required',
          file: req.file,
          message: `Falta: ${snippet}`,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log('check:trip-distance (API) OK');
    process.exit(0);
  }

  console.error('check:trip-distance (API) FALLÓ:\n');
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}: ${v.message}`);
  }
  process.exit(1);
}

main();
