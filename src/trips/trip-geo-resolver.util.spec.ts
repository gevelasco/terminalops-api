import type { OperationalCenter } from 'src/operational-centers/entities/operational-center.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import {
  buildTripsMapMeta,
  computeGeoQuality,
  mapTripToMapItem,
  resolveDestinationPoint,
  resolveOriginPoint,
  type TripGeoResolverContext,
} from './trip-geo-resolver.util';

function center(overrides: Partial<OperationalCenter> = {}): OperationalCenter {
  return {
    id: 1,
    companyId: 1,
    name: 'Centro Principal',
    code: 'MAIN',
    postalCode: '64000',
    cityMunicipality: 'Monterrey',
    locality: 'Centro',
    settlementConsId: null,
    latitude: '25.6866',
    longitude: '-100.3161',
    isDefault: true,
    ...overrides,
  } as OperationalCenter;
}

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 10,
    maneuverCode: 'ACME-001',
    status: 'scheduled',
    origin: '64000',
    originLocality: 'Centro',
    originCityMunicipality: 'Monterrey',
    destination: '06600',
    destinationLocality: 'Juárez',
    destinationCityMunicipality: 'CDMX',
    destinationPostalCode: '06600',
    ...overrides,
  } as Trip;
}

function ctx(
  overrides: Partial<TripGeoResolverContext> = {},
): TripGeoResolverContext {
  const defaultCenter = center();
  return {
    defaultCenter,
    operationalCenters: [defaultCenter],
    ...overrides,
  };
}

describe('trip-geo-resolver.util', () => {
  it('computeGeoQuality clasifica resolved, partial y unresolved', () => {
    expect(
      computeGeoQuality(
        { lat: 1, lng: 1, label: 'O', source: 'destination_rate' },
        { lat: 2, lng: 2, label: 'D', source: 'destination_rate' },
      ),
    ).toBe('resolved');
    expect(
      computeGeoQuality(
        { lat: 1, lng: 1, label: 'O', source: 'destination_rate' },
        { lat: null, lng: null, label: 'D', source: 'unresolved' },
      ),
    ).toBe('partial');
    expect(
      computeGeoQuality(
        { lat: null, lng: null, label: 'O', source: 'unresolved' },
        { lat: null, lng: null, label: 'D', source: 'unresolved' },
      ),
    ).toBe('unresolved');
  });

  it('resolveOriginPoint prioriza tarifa, luego centro inferido y default', () => {
    const fromRate = resolveOriginPoint(
      trip({
        destinationRate: {
          originLatitude: '20.1',
          originLongitude: '-99.2',
        } as Trip['destinationRate'],
      }),
      ctx(),
    );
    expect(fromRate.source).toBe('destination_rate');
    expect(fromRate.lat).toBe(20.1);

    const inferred = resolveOriginPoint(
      trip({
        originPostalCode: '64000',
        originLocality: 'Centro',
      }),
      ctx({
        operationalCenters: [
          center({ id: 2, postalCode: '64000', locality: 'Centro', latitude: '25.7', longitude: '-100.3' }),
        ],
      }),
    );
    expect(inferred.source).toBe('operational_center');

    const fallback = resolveOriginPoint(
      trip({ originPostalCode: '99999', originLocality: 'Otro' }),
      ctx(),
    );
    expect(fallback.source).toBe('fallback');
    expect(fallback.lat).toBe(25.6866);
  });

  it('resolveDestinationPoint prioriza tarifa, entrega y fallback por tarifa', () => {
    const fromRate = resolveDestinationPoint(
      trip({
        destinationRate: {
          destinationLatitude: '19.4',
          destinationLongitude: '-99.1',
        } as Trip['destinationRate'],
      }),
      ctx(),
    );
    expect(fromRate.source).toBe('destination_rate');

    const fromDelivery = resolveDestinationPoint(
      trip({
        client: {
          delivery: { latitude: '18.5', longitude: '-88.3' },
        } as Trip['client'],
      }),
      ctx(),
    );
    expect(fromDelivery.source).toBe('client_delivery');

    const fromMatched = resolveDestinationPoint(trip(), ctx({
      matchedRateDestination: {
        destinationLatitude: '21.0',
        destinationLongitude: '-101.0',
      },
    }));
    expect(fromMatched.source).toBe('fallback');
  });

  it('mapTripToMapItem usa dirección completa sin duplicar localidad', () => {
    const item = mapTripToMapItem(
      trip({
        destination:
          'Aniceto Corpus, Monterrey, Nuevo León, México (CP 64103)',
        destinationLocality: 'Aniceto Corpus',
        destinationCityMunicipality: 'Monterrey, Nuevo León',
        destinationRate: {
          destinationLatitude: '25.7817504',
          destinationLongitude: '-100.4100934',
        } as Trip['destinationRate'],
      }),
      ctx(),
    );
    expect(item.destination.label).toBe(
      'Aniceto Corpus, Monterrey, Nuevo León, México (CP 64103)',
    );
  });

  it('mapTripToMapItem y buildTripsMapMeta agregan métricas', () => {
    const item = mapTripToMapItem(
      trip({
        destinationRate: {
          originLatitude: '25.0',
          originLongitude: '-100.0',
          destinationLatitude: '19.0',
          destinationLongitude: '-99.0',
        } as Trip['destinationRate'],
      }),
      ctx(),
    );
    expect(item.geoQuality).toBe('resolved');
    expect(item.id).toBe('10');

    const meta = buildTripsMapMeta([
      item,
      {
        ...item,
        id: '11',
        geoQuality: 'partial',
      },
      {
        ...item,
        id: '12',
        geoQuality: 'unresolved',
      },
    ]);
    expect(meta).toEqual({
      total: 3,
      resolved: 1,
      partial: 1,
      unresolved: 1,
    });
  });
});
