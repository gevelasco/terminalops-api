export type OperatorPayDueVariantDto = 'success' | 'warning' | 'danger' | 'neutral';

export class OperatorManeuverStatusCountsDto {
  completed: number;
  inTransit: number;
  scheduled: number;
  cancelled: number;
  total: number;
}

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
  statusCounts: OperatorManeuverStatusCountsDto;
  completedKm: number;
  activeAssignment: OperatorActiveAssignmentDto | null;
  owedTripCount: number;
  owedAmount: number;
  nextPayDueYmd: string | null;
  nextPayDueLabel: string;
  nextPayDueBadgeVariant: OperatorPayDueVariantDto;
  pendingPaymentRows: OperatorPaymentRowDto[];
  recentPaymentRows: OperatorPaymentRowDto[];
}
