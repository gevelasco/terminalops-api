export type UserRole = 'superadmin' | 'admin' | 'coordinator' | 'operator' | 'viewer';

export type ThemeScheme = 'light' | 'dark';

export type AuthUser = {
  /** ID público numérico del usuario (colaborador). */
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  username: string;
  phone?: string;
  jobTitle?: string;
  photoDataUrl?: string;
  role: UserRole;
  /** ID público numérico de la empresa (URLs /companies/:id). */
  companyId: string;
  companyName?: string;
  theme: ThemeScheme;
  memberSince?: string;
  department?: string;
  workLocation?: string;
  employeeId?: string;
  operationalAnalysisEnabled?: boolean;
  operationalAnalysisChangedAt?: string;
  maintenanceKmControlEnabled?: boolean;
  maintenanceKmIntervalDefault?: number;
  maintenanceDateControlEnabled?: boolean;
  maintenanceDatePeriodDefault?: string;
  maintenanceKmControlChangedAt?: string;
  maintenanceDateControlChangedAt?: string;
  operationalCenterPostalCode?: string;
  operationalCenterCityMunicipality?: string;
  operationalCenterLocality?: string;
  operationalCenterSettlementConsId?: string;
  operationalCenterLatitude?: number;
  operationalCenterLongitude?: number;
};

export default AuthUser;
