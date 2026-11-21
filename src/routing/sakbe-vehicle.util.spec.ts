import { sakbeVehicleCodeFromAxleCount } from './sakbe-vehicle.util';

describe('sakbeVehicleCodeFromAxleCount', () => {
  it('maps truck axle count to SAKBE v', () => {
    expect(sakbeVehicleCodeFromAxleCount(5)).toBe(8);
    expect(sakbeVehicleCodeFromAxleCount(8)).toBe(11);
    expect(sakbeVehicleCodeFromAxleCount(undefined)).toBe(8);
  });
});