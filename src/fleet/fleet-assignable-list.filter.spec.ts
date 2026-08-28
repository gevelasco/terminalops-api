import {
  normalizeAssignableContainerType,
  sqlEquipmentNotOnActiveTrip,
  sqlResourceNotOnActiveTrip,
  sqlUnitIsManeuverReady,
  sqlUnitIsSelfContained,
} from './fleet-assignable-list.filter';

describe('fleet-assignable-list.filter', () => {
  it('normalizes legacy container codes', () => {
    expect(normalizeAssignableContainerType('20ft')).toBe('20dc');
    expect(normalizeAssignableContainerType('40ft')).toBe('40dc');
    expect(normalizeAssignableContainerType('40hc')).toBe('40hc');
    expect(normalizeAssignableContainerType('')).toBe('na');
  });

  it('excludes units/operators already on scheduled or in-transit trips', () => {
    const sql = sqlResourceNotOnActiveTrip('terminalops', 'unit', 'unit_id');
    expect(sql).toContain('terminalops.trips trip_busy');
    expect(sql).toContain('trip_busy.unit_id = unit.id');
    expect(sql).toContain('trip_busy.deleted_at IS NULL');
    expect(sql).toContain('IN (:...assignableTripStatuses)');
  });

  it('excludes equipment already on an active trip', () => {
    const sql = sqlEquipmentNotOnActiveTrip('terminalops', 'equipment');
    expect(sql).toContain('terminalops.trip_equipment te_busy');
    expect(sql).toContain('te_busy.equipment_id = equipment.id');
  });

  it('treats non-tractor transport types as self-contained cargo', () => {
    const sql = sqlUnitIsSelfContained('unit');
    expect(sql).toContain('transport_type');
    expect(sql).toContain("'tractocamion'");
  });

  it('requires hitch or self-contained cargo to be maneuver-ready', () => {
    const sql = sqlUnitIsManeuverReady('terminalops', 'unit');
    expect(sql).toContain('terminalops.equipment hitch_ready_eq');
    expect(sql).toContain('hitch_ready_eq.unit_id = unit.id');
  });
});
