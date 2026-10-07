export const TRIP_CARGO_CATEGORY_VALUES = [
  'contenedor',
  'material',
  'mineral',
  'liquido',
  'maquinaria',
  'rollos',
] as const;

export type TripCargoCategory = (typeof TRIP_CARGO_CATEGORY_VALUES)[number];

const TRIP_CARGO_CATEGORY_LABELS: Record<TripCargoCategory, string> = {
  contenedor: 'Contenedor',
  material: 'Material / carga general',
  mineral: 'Mineral (granel sólido)',
  liquido: 'Líquido a granel',
  maquinaria: 'Maquinaria / carga sobredimensionada',
  rollos: 'Rollos (bobinas, lámina en rollo)',
};

export function normalizeTripCargoCategory(
  raw: string | null | undefined,
): TripCargoCategory {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  return (TRIP_CARGO_CATEGORY_VALUES as readonly string[]).includes(v)
    ? (v as TripCargoCategory)
    : 'material';
}

export function cargoCategoryLabelMx(raw: string | null | undefined): string {
  const key = normalizeTripCargoCategory(raw);
  return TRIP_CARGO_CATEGORY_LABELS[key];
}

/** ISO 6346: 4 letras + 7 dígitos (sin guiones). */
export function normalizeTripContainerNumber(
  raw: string | null | undefined,
): string | undefined {
  const compact = String(raw ?? '')
    .trim()
    .replace(/[\s-]+/g, '')
    .toUpperCase();
  return compact.length > 0 ? compact : undefined;
}

export function isValidTripContainerNumber(raw: string | null | undefined): boolean {
  const n = normalizeTripContainerNumber(raw);
  if (!n) {
    return true;
  }
  return /^[A-Z]{4}\d{7}$/.test(n);
}

export type ResolvedTripCargoFields = {
  cargoCategory: TripCargoCategory;
  containerType: string;
  containerNumber?: string;
};

/** Normaliza categoría, contenedor ISO y número al persistir una maniobra. */
export function resolveTripCargoFields(input: {
  cargoCategory?: string | null;
  containerType?: string | null;
  containerNumber?: string | null;
}): ResolvedTripCargoFields {
  const cargoCategory = normalizeTripCargoCategory(input.cargoCategory);
  const containerNumber = normalizeTripContainerNumber(input.containerNumber);
  if (containerNumber && !isValidTripContainerNumber(containerNumber)) {
    throw new Error('INVALID_CONTAINER_NUMBER');
  }

  if (cargoCategory !== 'contenedor') {
    return {
      cargoCategory,
      containerType: 'na',
      containerNumber: undefined,
    };
  }

  const containerType = String(input.containerType ?? 'na').trim() || 'na';
  return {
    cargoCategory,
    containerType,
    containerNumber,
  };
}
