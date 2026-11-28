export type UserRole = 'superadmin' | 'admin' | 'staff';

export type ThemeScheme = 'light' | 'dark';

export type AuthUser = {
  /** ID numérico del usuario (colaborador); string en claims JWT. */
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
  allowedModules?: string[];
  moduleGrants?: import('src/common/constants/app-modules').StaffModuleGrant[];
  /** ID numérico de la empresa (URLs /companies/:id); string en claims JWT. */
  companyId: string;
  companyName?: string;
  /** Plan comercial de la empresa (`basic` | `standard` | `pro`, o legacy). */
  subscriptionPlan?: string | null;
  /** Lema / tagline de la empresa (companies.tagline). */
  companyTagline?: string | null;
  /** Logo de la empresa (data URL); solo en cuerpo login/refresh, no en JWT. */
  companyLogoDataUrl?: string | null;
  /** Contacto comercial para cotizaciones (companies.contact_email / contact_phone). */
  companyContactEmail?: string | null;
  companyContactPhone?: string | null;
  theme: ThemeScheme;
  memberSince?: string;
  department?: string;
  workLocation?: string;
  employeeId?: string;
  operationalAnalysisEnabled?: boolean;
  operationalAnalysisChangedAt?: string;
  tripAutoMaintenanceProvisionPercent?: number;
  tripAutoFuelPaymentMethod?: string;
  tripAutoTollsPaymentMethod?: string;
  tripAutoPerDiemPaymentMethod?: string;
  tripAutoControlPaymentMethod?: string;
  /** Etiqueta en gastos del % automático; vacío/null = Control operativo. */
  tripAutoOperationalControlLabel?: string | null;
  maintenanceKmControlEnabled?: boolean;
  maintenanceKmIntervalDefault?: number;
  maintenanceDateControlEnabled?: boolean;
  maintenanceDatePeriodDefault?: string;
  maintenanceKmControlChangedAt?: string;
  maintenanceDateControlChangedAt?: string;
  dieselControlEnabled?: boolean;
  dieselControlChangedAt?: string;
  paymentReminderDaysBefore?: number;
  paymentReminderDaysChangedAt?: string;
  tripAutoPaymentsChangedAt?: string;
  /** Política de tarifas: postal_code | municipality | state */
  destinationRateScope?: string;
  /** ID público del centro operativo principal (único por empresa hoy). */
  operationalCenterId?: string;
  operationalCenterName?: string;
  operationalCenterPostalCode?: string;
  operationalCenterCityMunicipality?: string;
  operationalCenterLocality?: string;
  operationalCenterSettlementConsId?: string;
  operationalCenterLatitude?: number;
  operationalCenterLongitude?: number;
  operationalCenterChangedAt?: string;
  /** Tareas personales del checklist aún abiertas (login / refresh). */
  openChecklistCount?: number;
};

export default AuthUser;
