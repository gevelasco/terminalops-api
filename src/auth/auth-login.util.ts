/** Solo usuarios activos pueden iniciar sesión o refrescar token. */
export function isAppUserLoginAllowed(status: string | null | undefined): boolean {
  return status?.trim().toLowerCase() === 'active';
}
