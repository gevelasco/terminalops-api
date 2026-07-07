import { operationalCenterGeoForApi } from './operational-center-geo-for-api';

describe('operationalCenterGeoForApi', () => {
  it('expone geo solo desde operational_centers', () => {
    const geo = operationalCenterGeoForApi({
      name: 'Patio Norte',
      postalCode: '66220',
      cityMunicipality: 'San Pedro, Nuevo León',
      locality: 'Valle Oriente',
      settlementConsId: 'oc-cons',
      latitude: '25.6500000',
      longitude: '-100.3500000',
    });

    expect(geo.operationalCenterName).toBe('Patio Norte');
    expect(geo.operationalCenterPostalCode).toBe('66220');
    expect(geo.operationalCenterLocality).toBe('Valle Oriente');
    expect(geo.operationalCenterLatitude).toBe(25.65);
  });

  it('sin centro devuelve defaults vacíos (sin fallback legacy)', () => {
    const geo = operationalCenterGeoForApi(null);

    expect(geo.operationalCenterName).toBe('Centro Principal');
    expect(geo.operationalCenterPostalCode).toBeUndefined();
    expect(geo.operationalCenterLocality).toBeUndefined();
    expect(geo.operationalCenterLatitude).toBeUndefined();
  });
});
