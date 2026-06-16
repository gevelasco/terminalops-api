import { ACTUAL_SCHEDULE_FIELD_LABELS } from './actual-schedule.constants';
import type {
  ActualScheduleFieldDelta,
  ActualSchedulePlannedValues,
} from './actual-schedule-update.util';
import {
  actualSchedulePreviousForIncidentDisplay,
  formatActualScheduleMx,
} from './actual-schedule-update.util';

export function buildConsolidatedScheduleUpdateIncidentDescription(params: {
  deltas: ActualScheduleFieldDelta[];
  planned: ActualSchedulePlannedValues;
  justification: string;
  authorDisplayName: string;
}): string {
  const lines: string[] = ['Actualización de cronograma real', ''];

  for (const delta of params.deltas) {
    const label = ACTUAL_SCHEDULE_FIELD_LABELS[delta.field];
    const previousDisplay = actualSchedulePreviousForIncidentDisplay(
      delta.field,
      delta.previous,
      params.planned,
    );
    lines.push(`${label}:`);
    lines.push(
      `${formatActualScheduleMx(previousDisplay)} → ${formatActualScheduleMx(delta.next)}`,
    );
    lines.push('');
  }

  lines.push('Motivo:');
  lines.push(params.justification.trim());
  lines.push('');
  lines.push('Actualizado por:');
  lines.push(params.authorDisplayName.trim());

  return lines.join('\n');
}
