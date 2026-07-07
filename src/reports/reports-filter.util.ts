import { BadRequestException } from '@nestjs/common';
import type { ReportsGeneralQueryDto } from './dto/reports-general-query.dto';

const OPERATIONAL_TZ = 'America/Mexico_City';
const MAX_RANGE_DAYS = 366;

export type ReportsScope = {
  companyId: number;
  from: string;
  to: string;
  clientIds: number[];
  paymentMethods: string[];
};

export { OPERATIONAL_TZ };

function parseCsvNumbers(value?: string): number[] {
  if (value == null || value.trim() === '') {
    return [];
  }
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

function parseCsvStrings(value?: string): string[] {
  if (value == null || value.trim() === '') {
    return [];
  }
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function parseReportsScope(
  companyId: number,
  query: ReportsGeneralQueryDto,
): ReportsScope {
  const from = query.from.trim();
  const to = query.to.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new BadRequestException('from and to must be YYYY-MM-DD');
  }
  if (from > to) {
    throw new BadRequestException('from must be on or before to');
  }

  const fromDate = new Date(`${from}T12:00:00`);
  const toDate = new Date(`${to}T12:00:00`);
  const days =
    Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
  }

  return {
    companyId,
    from,
    to,
    clientIds: parseCsvNumbers(query.clientIds),
    paymentMethods: parseCsvStrings(query.paymentMethods),
  };
}

export function previousPeriodRange(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(`${from}T12:00:00`);
  const toDate = new Date(`${to}T12:00:00`);
  const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1);
  const prevEnd = new Date(fromDate);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));
  return {
    from: localYmd(prevStart),
    to: localYmd(prevEnd),
  };
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function weekOverWeekPercent(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function tripScopeSql(
  alias: string,
  scope: ReportsScope,
  startParamIndex: number,
): { sql: string; params: unknown[]; nextParamIndex: number } {
  const params: unknown[] = [];
  let idx = startParamIndex;
  const parts: string[] = [];

  if (scope.clientIds.length > 0) {
    parts.push(`${alias}.client_id = ANY($${idx}::int[])`);
    params.push(scope.clientIds);
    idx++;
  }
  if (scope.paymentMethods.length > 0) {
    parts.push(`${alias}.payment_method = ANY($${idx}::text[])`);
    params.push(scope.paymentMethods);
    idx++;
  }

  return {
    sql: parts.length > 0 ? ` AND ${parts.join(' AND ')}` : '',
    params,
    nextParamIndex: idx,
  };
}
