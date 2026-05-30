import type { Trip } from './entities/trip.entity';

/** Precio diesel inmutable guardado al crear la maniobra (MXN/L). */
export function tripDieselPricePerLiterAtCreation(trip: {
  dieselPricePerLiterAtCreation?: string | null;
  dieselAmount?: string | null;
  dieselLiters?: string | null;
}): number | null {
  const snap = trip.dieselPricePerLiterAtCreation;
  if (snap != null && snap !== '') {
    const n = Number(snap);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  const liters = trip.dieselLiters != null ? Number(trip.dieselLiters) : NaN;
  const amount = trip.dieselAmount != null ? Number(trip.dieselAmount) : NaN;
  if (Number.isFinite(liters) && liters > 0 && Number.isFinite(amount) && amount >= 0) {
    return Math.round((amount / liters) * 10000) / 10000;
  }
  return null;
}

/** Monto diesel histórico: litros × precio snapshot (no precio vigente). */
export function tripHistoricalDieselAmount(trip: {
  dieselLiters?: string | null;
  dieselPricePerLiterAtCreation?: string | null;
  dieselAmount?: string | null;
}): number | null {
  const liters = trip.dieselLiters != null ? Number(trip.dieselLiters) : NaN;
  const price = tripDieselPricePerLiterAtCreation(trip);
  if (!Number.isFinite(liters) || liters <= 0 || price == null) {
    const stored = trip.dieselAmount != null ? Number(trip.dieselAmount) : NaN;
    return Number.isFinite(stored) ? stored : null;
  }
  return Math.round(liters * price * 100) / 100;
}
