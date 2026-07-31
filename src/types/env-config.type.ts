type EnvConfig = {
  NODE_ENV: string;
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  /** true en hosts gestionados (Railway, etc.) */
  DB_SSL?: string;
  /**
   * Origen(es) CORS del FE, separados por coma.
   * Ej. producción: https://app.tudominio.com
   */
  ORIGIN: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  SALT_ROUNDS: number;
  /** Webhook Slack/Discord/generic para alertas 5xx (opcional). */
  ALERT_WEBHOOK_URL?: string;
  /** En production Swagger queda off salvo ENABLE_SWAGGER=true. */
  ENABLE_SWAGGER?: string;
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
  /** Railway/Tigris S3-compatible object storage (optional until uploads are used). */
  RW_URL?: string;
  RW_REGION?: string;
  RW_S3_BUCKET?: string;
  RW_ACCESS_KEY_ID?: string;
  RW_SECRET_ACCESS_KEY?: string;
  /** Resend API key — sin esto los correos se omiten (log warn). */
  RESEND_API_KEY?: string;
  /** Remitente verificado en Resend. Ej. TerminalOps <noreply@tudominio.com> */
  EMAIL_FROM?: string;
  /** URL pública del FE para links de correo (fallback: primer ORIGIN). */
  APP_URL?: string;
};

export default EnvConfig;
