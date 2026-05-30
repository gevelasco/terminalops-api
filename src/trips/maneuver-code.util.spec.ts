import {
  formatManeuverCode,
  maneuverCodePrefixFromClientName,
} from './maneuver-code.util';

describe('maneuverCodePrefixFromClientName', () => {
  it('uses first letter of each word up to 3 letters', () => {
    expect(maneuverCodePrefixFromClientName('Acme de México')).toBe('ADM');
    expect(maneuverCodePrefixFromClientName('Transportes del Norte')).toBe('TDN');
    expect(maneuverCodePrefixFromClientName('Logística Integral Guadalajara')).toBe('LIG');
  });

  it('formats sequence with 4 digits', () => {
    expect(formatManeuverCode('ADM', 1)).toBe('ADM-0001');
    expect(formatManeuverCode('TDN', 42)).toBe('TDN-0042');
  });
});
