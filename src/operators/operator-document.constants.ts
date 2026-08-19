export const OPERATOR_DOCUMENT_SLOTS = ['operation', 'insurance'] as const;

export type OperatorDocumentSlot = (typeof OPERATOR_DOCUMENT_SLOTS)[number];

export const OPERATOR_DOCUMENT_STORAGE_FOLDER = 'operator-documents';
