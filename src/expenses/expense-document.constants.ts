export const EXPENSE_DOCUMENT_SLOTS = ['receipt'] as const;

export type ExpenseDocumentSlot = (typeof EXPENSE_DOCUMENT_SLOTS)[number];

export const EXPENSE_DOCUMENT_STORAGE_FOLDER = 'expense-documents';
