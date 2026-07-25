export const EQUIPMENT_FLEET_DOCUMENT_KINDS = [
  'maintenance',
  'verification',
  'policy',
  'ownership',
] as const;

export type EquipmentFleetDocumentKind =
  (typeof EQUIPMENT_FLEET_DOCUMENT_KINDS)[number];

export const EQUIPMENT_FLEET_DOCUMENT_STORAGE_FOLDER =
  'equipment-fleet-documents';
