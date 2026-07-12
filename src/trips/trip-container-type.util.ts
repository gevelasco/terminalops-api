/** Catálogo ISO usado en arrastre portuario / carretera (México). */
export const TRIP_CONTAINER_TYPES = [
  '20dc',
  '20hc',
  '40dc',
  '40hc',
  '45hc',
  'na',
] as const;

export type TripContainerTypeCode = (typeof TRIP_CONTAINER_TYPES)[number];

const LABELS: Record<string, string> = {
  '20dc': "20′ DC (estándar)",
  '20hc': "20′ HC (High Cube)",
  '40dc': "40′ DC (estándar)",
  '40hc': "40′ HC (High Cube)",
  '45hc': "45′ HC (High Cube)",
  na: 'No aplica',
  '20ft': "20′ DC (estándar)",
  '40ft': "40′ DC (estándar)",
};

export function containerTypeLabelMx(raw: string | null | undefined): string {
  const key = (raw ?? '').trim();
  if (!key) {
    return 'Sin tipo';
  }
  return LABELS[key] ?? key;
}
