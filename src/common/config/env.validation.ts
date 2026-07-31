import { Logger } from '@nestjs/common';
import type EnvConfig from '../../types/env-config.type';

const WEAK_JWT_FRAGMENTS = [
  '2f8c7e1a9b4d4e3f8a6c2b7e5d1f9c3a',
  '2f8c7e1a9b4d4e3f8a6c2b7e5d1u8788',
  'changeme',
  'secret',
  'test',
];

function isProd(nodeEnv: string | undefined): boolean {
  return (nodeEnv ?? '').trim().toLowerCase() === 'production';
}

/**
 * Fallos duros en producción; en local solo warnings.
 * Evita arrancar PRD con CORS abierto o JWT de ejemplo.
 */
export function assertProductionEnv(
  env: Partial<EnvConfig> & {
    NODE_ENV?: string;
    ENABLE_SWAGGER?: string;
    ALERT_WEBHOOK_URL?: string;
    DB_SSL?: string;
  },
): void {
  const logger = new Logger('EnvValidation');
  const prod = isProd(env.NODE_ENV);

  const origin = env.ORIGIN?.trim() ?? '';
  const jwt = env.JWT_SECRET?.trim() ?? '';
  const refresh = env.JWT_REFRESH_SECRET?.trim() ?? '';

  if (!prod) {
    if (!origin) {
      logger.warn('ORIGIN vacío — CORS usará http://localhost:4200');
    }
    return;
  }

  const errors: string[] = [];

  if (!origin || origin === '*') {
    errors.push('ORIGIN debe ser el dominio real del FE (sin *), p.ej. https://app.tudominio.com');
  }
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    errors.push('ORIGIN en producción no debe apuntar a localhost');
  }
  if (!jwt || jwt.length < 32) {
    errors.push('JWT_SECRET debe tener al menos 32 caracteres');
  }
  if (!refresh || refresh.length < 32) {
    errors.push('JWT_REFRESH_SECRET debe tener al menos 32 caracteres');
  }
  if (jwt && refresh && jwt === refresh) {
    errors.push('JWT_SECRET y JWT_REFRESH_SECRET deben ser distintos');
  }
  for (const weak of WEAK_JWT_FRAGMENTS) {
    if (jwt.includes(weak) || refresh.includes(weak)) {
      errors.push('JWT_* parece un valor de ejemplo/.env.example — genera secretos nuevos');
      break;
    }
  }
  if (!env.DB_PASSWORD?.trim()) {
    errors.push('DB_PASSWORD es obligatorio');
  }
  if (!env.DB_HOST?.trim() || !env.DB_DATABASE?.trim() || !env.DB_USERNAME?.trim()) {
    errors.push('DB_HOST, DB_DATABASE y DB_USERNAME son obligatorios');
  }

  if (errors.length) {
    throw new Error(
      `Configuración de producción inválida:\n- ${errors.join('\n- ')}`,
    );
  }

  logger.log(
    `PRD env OK (ORIGIN=${origin}, DB_SSL=${env.DB_SSL === 'true'}, swagger=${env.ENABLE_SWAGGER === 'true'})`,
  );
}

/** Orígenes CORS desde `ORIGIN` (lista separada por comas). */
export function parseCorsOrigins(originEnv: string | undefined): string[] {
  const raw = originEnv?.trim() || 'http://localhost:4200';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0 && o !== '*');
}
