export type ReportsBalanceSummaryDto = {
  from: string;
  to: string;
  collectedInPeriod: number;
  receivableOpen: number;
  accruedRevenue: number;
  expenses: number;
  expensesCount: number;
  realExpenses: number;
  provisions: number;
  accountsPayable: number;
  cashMargin: number;
  accruedMargin: number;
  marginPercent: number | null;
  tollsSpendInPeriod: number;
  operatorSpendInPeriod: number;
};

export type ReportsBalanceCompositionSliceDto = {
  key: string;
  label: string;
  amount: number;
};

export type ReportsBalanceCreditByClientDto = {
  clientName: string;
  amount: number;
  nextDueDate: string | null;
};

export type ReportsBalanceIncomeByClientDto = {
  clientName: string;
  amount: number;
  tripCount: number;
};

export type ReportsBalanceMarginByClientDto = {
  clientName: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number | null;
  tripCount: number;
};

export type ReportsBalanceProfitabilityDto = {
  revenue: number;
  directCost: number;
  tripExpenses: number;
  totalCost: number;
  margin: number;
  marginPercent: number | null;
};

export type ReportsBalanceExpenseRubroDto = {
  rubro: string;
  label: string;
  amount: number;
  count: number;
};

export type ReportsBalanceDailyActivityEventDto = {
  kind: 'income' | 'expense' | 'receivable' | 'payable';
  label: string;
  amount: number;
};

export type ReportsBalanceDailyActivityDayDto = {
  date: string;
  incomeCount: number;
  expenseCount: number;
  receivableCount: number;
  payableCount: number;
  events: ReportsBalanceDailyActivityEventDto[];
};

export type ReportsBalancePayableItemDto = {
  description: string;
  amount: number;
  beneficiary: string | null;
  installmentLabel: string;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
};

export type ReportsBalanceInsightsDto = {
  composition: ReportsBalanceCompositionSliceDto[];
  creditByClient: ReportsBalanceCreditByClientDto[];
  incomeByClient: ReportsBalanceIncomeByClientDto[];
  marginByClient: ReportsBalanceMarginByClientDto[];
  profitability: ReportsBalanceProfitabilityDto;
  expensesByRubro: ReportsBalanceExpenseRubroDto[];
  dailyActivity: ReportsBalanceDailyActivityDayDto[];
  payableItems: ReportsBalancePayableItemDto[];
};

export type ReportsBalanceDto = {
  summary: ReportsBalanceSummaryDto;
  insights: ReportsBalanceInsightsDto;
};
