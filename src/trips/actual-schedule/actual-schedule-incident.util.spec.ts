import { buildConsolidatedScheduleUpdateIncidentDescription } from './actual-schedule-incident.util';
import { formatActualScheduleMx } from './actual-schedule-update.util';

const planned = {
  plannedDepartureAt: new Date('2026-01-15T08:00:00.000Z'),
  plannedArrivalAt: new Date('2026-01-15T12:00:00.000Z'),
  plannedCompletionAt: new Date('2026-01-15T18:00:00.000Z'),
};

describe('buildConsolidatedScheduleUpdateIncidentDescription', () => {
  it('includes only changed fields in consolidated incident', () => {
    const text = buildConsolidatedScheduleUpdateIncidentDescription({
      deltas: [
        {
          field: 'departureAt',
          previous: new Date('2026-01-15T08:00:00.000Z'),
          next: new Date('2026-01-15T08:30:00.000Z'),
        },
      ],
      planned,
      justification: 'Tráfico intenso en patio.',
      authorDisplayName: 'Juan Pérez',
    });

    expect(text).toContain('Actualización de cronograma real');
    expect(text).toContain('Salida:');
    expect(text).toContain('Motivo:');
    expect(text).toContain('Tráfico intenso en patio.');
    expect(text).toContain('Actualizado por:');
    expect(text).toContain('Juan Pérez');
    expect(text).not.toContain('Llegada cliente:');
  });

  it('uses planned date as previous on first real update', () => {
    const plannedFin = planned.plannedCompletionAt;
    const text = buildConsolidatedScheduleUpdateIncidentDescription({
      deltas: [
        {
          field: 'returnAt',
          previous: null,
          next: new Date('2026-06-21T07:12:00.000Z'),
        },
      ],
      planned,
      justification: 'El operador se detuvo a dormir.',
      authorDisplayName: 'Saul Velasco',
    });

    expect(text).toContain('Fin:');
    expect(text).toContain(formatActualScheduleMx(plannedFin));
    expect(text).not.toContain('Sin registro');
  });

  it('lists multiple field changes in one incident', () => {
    const text = buildConsolidatedScheduleUpdateIncidentDescription({
      deltas: [
        {
          field: 'departureAt',
          previous: null,
          next: new Date('2026-01-15T08:30:00.000Z'),
        },
        {
          field: 'returnAt',
          previous: null,
          next: new Date('2026-01-15T19:00:00.000Z'),
        },
      ],
      planned,
      justification: 'Cliente cambió ventana.',
      authorDisplayName: 'María López',
    });

    expect(text).toContain('Salida:');
    expect(text).toContain(formatActualScheduleMx(planned.plannedDepartureAt));
    expect(text).toContain('Fin:');
    expect(text).not.toContain('Sin registro');
  });
});
