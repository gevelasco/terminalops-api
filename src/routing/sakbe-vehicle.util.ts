/** Clasificación SAKBÉ `v` (camión por número de ejes, 2–8). */
const TRUCK_AXE_TO_SAKBE_V: Record<number, number> = {
  2: 5,
  3: 6,
  4: 7,
  5: 8,
  6: 9,
  7: 10,
  8: 11,
};

/** Mapea ejes del tracto a parámetro `v` de INEGI SAKBÉ (default 5 ejes → v=8). */
export function sakbeVehicleCodeFromAxleCount(axleCount: number | undefined): number {
  const n = axleCount != null && Number.isFinite(axleCount) ? Math.round(axleCount) : 5;
  return TRUCK_AXE_TO_SAKBE_V[n] ?? TRUCK_AXE_TO_SAKBE_V[5]!;
}