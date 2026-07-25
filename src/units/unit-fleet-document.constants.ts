export const UNIT_FLEET_DOCUMENT_KINDS = [
  'maintenance',
  'verification',
  'policy',
  'ownership',
] as const;

export type UnitFleetDocumentKind =
  (typeof UNIT_FLEET_DOCUMENT_KINDS)[number];

export const UNIT_FLEET_DOCUMENT_STORAGE_FOLDER = 'unit-fleet-documents';
