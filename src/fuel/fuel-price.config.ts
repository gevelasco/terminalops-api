/** Solo fallback de configuración (env); no usar en estimador directamente. */
export const FUEL_PRICE_DEFAULTS = {
  fallbackPriceMxnPerLiter: 25.5,
  cacheTtlHours: 6,
  dieselFuelType: 'diesel',
} as const;
