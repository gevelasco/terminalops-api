export function normalizeMaintenanceDocumentFileNames(
  names: readonly string[] | undefined,
): string[] | undefined {
  const list = (names ?? []).map((n) => n?.trim()).filter(Boolean) as string[];
  return list.length > 0 ? list : undefined;
}

export function maintenanceDocumentNamesForApi(
  names: string[] | null | undefined,
): string[] | undefined {
  return normalizeMaintenanceDocumentFileNames(names ?? undefined);
}