import {
  clientDeliveryRows,
  pickClientDelivery,
} from './pick-client-delivery';

const naucalpan = {
  postalCode: '53470',
  locality: 'Loma de Canteras (Lomas de Cantera)',
  latitude: '19.4694361',
};
const monterrey = {
  postalCode: '64000',
  locality: 'Monterrey Centro',
  latitude: '25.668618',
};

describe('clientDeliveryRows', () => {
  it('prefers the deliveries array', () => {
    expect(
      clientDeliveryRows({
        delivery: naucalpan,
        deliveries: [naucalpan, monterrey],
      }),
    ).toEqual([naucalpan, monterrey]);
  });

  it('wraps legacy singular delivery', () => {
    expect(clientDeliveryRows({ delivery: naucalpan })).toEqual([naucalpan]);
  });
});

describe('pickClientDelivery', () => {
  const client = { deliveries: [naucalpan, monterrey] };

  it('returns the first row when no route is given', () => {
    expect(pickClientDelivery(client)).toEqual(naucalpan);
  });

  it('matches postal code and locality', () => {
    expect(
      pickClientDelivery(client, {
        postalCode: '64000',
        locality: 'Monterrey Centro',
      }),
    ).toEqual(monterrey);
  });

  it('does not fall back to another plant when the CP does not match', () => {
    expect(
      pickClientDelivery(client, {
        postalCode: '44100',
        locality: 'Americana',
      }),
    ).toBeUndefined();
  });
});
