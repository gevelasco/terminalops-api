export const TRIP_DOCUMENT_KINDS = [
  'load',
  'operational_costs',
  'billing',
] as const;

export type TripDocumentKind = (typeof TRIP_DOCUMENT_KINDS)[number];

export const TRIP_DOCUMENT_STORAGE_FOLDER = 'trip-documents';
