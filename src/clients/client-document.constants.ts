export const CLIENT_DOCUMENT_SLOTS = ['fiscal'] as const;

export type ClientDocumentSlot = (typeof CLIENT_DOCUMENT_SLOTS)[number];

export const CLIENT_DOCUMENT_STORAGE_FOLDER = 'client-documents';
