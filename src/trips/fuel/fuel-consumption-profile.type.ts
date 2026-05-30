/**
 * Modelo futuro para perfiles calibrados por empresa/unidad (no persistido en MVP).
 */
export interface FuelConsumptionProfile {
  companyId: number;
  configuration: 'sencillo' | 'full';
  minWeightTons: number;
  maxWeightTons: number | null;
  avgKmPerLiter: number;
  dieselPricePerLiter?: number;
  label?: string;
}
