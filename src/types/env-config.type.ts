type EnvConfig = {
  NODE_ENV: string;
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  ORIGIN: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  SALT_ROUNDS: number;
  /** Precio diesel MXN/L si no hay cache ni APIs (opcional). */
  FUEL_DIESEL_FALLBACK_PRICE_MXN?: number;
  /** TTL cache diesel en horas (default 6). */
  FUEL_PRICE_CACHE_TTL_HOURS?: number;
  /** API Ninjas — https://api-ninjas.com (primary). */
  API_NINJAS_KEY?: string;
  /** OilPriceAPI — https://oilpriceapi.com */
  OIL_PRICE_API_KEY?: string;
  OIL_PRICE_API_DIESEL_CODE?: string;
  /** CSV CRE/CNE en datos.gob.mx (fallback). */
  DATOS_GOB_MX_FUEL_CSV_URL?: string;
};

export default EnvConfig;
