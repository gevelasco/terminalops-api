export type OperatorPayDueVariantDto = 'success' | 'warning' | 'danger' | 'neutral';

export class OperatorActiveAssignmentDto {
  maneuverCode: string;
  routeLabel: string;
  clientName: string;
  unitLabel: string;
  equipmentLabel: string;
  statusLabel: string;
}

export type OperatorPaymentRowStatusDto = 'paid' | 'pending' | 'due' | 'overdue';

export class OperatorPaymentRowDto {
  tripId: number;
  maneuverCode: string;
  dueYmd: string;
  dueLabel: string;
  quotaAmount: number;
  balance: number;
  paidAmount: number;
  status: OperatorPaymentRowStatusDto;
  badgeVariant: OperatorPayDueVariantDto;
  statusHint: string;
  expenseId: number | null;
  paidAtYmd: string | null;
  canConfirm: boolean;
  completionYmd: string | null;
}

export class OperatorOperationSummaryDto {
  hasTrips: boolean;
  /** Maniobras con actividad en el periodo filtrado (o ventana reciente). */
  periodManeuverTotal: number;
  completedKm: number;
  /** Suma de horas (ida + vuelta) de tarifas en maniobras completadas del periodo. */
  workedHours: number;
  /** `workedHours` ÷ jornada operativa de referencia (16 h). */
  workedDays: number;
  /** Maniobras del periodo con al menos un incidente (`has_incident`). */
  incidentManeuverCount: number;
  activeAssignment: OperatorActiveAssignmentDto | null;
  owedTripCount: number;
  owedAmount: number;
  nextPayDueYmd: string | null;
  nextPayDueLabel: string;
  nextPayDueBadgeVariant: OperatorPayDueVariantDto;
  pendingPaymentRows: OperatorPaymentRowDto[];
  recentPaymentRows: OperatorPaymentRowDto[];
}
