import {
  clientDeliveryRows,
  pickClientDelivery,
} from './pick-client-delivery';

const naucalpan = { postalCode: '53100', locality: 'Naucalpan' };
const monterrey = { postalCode: '64000', locality: 'Monterrey' };

describe('clientDeliveryRows', () => {
  it('reads the deliveries array', () => {
    expect(
      clientDeliveryRows({
        deliveries: [naucalpan, monterrey],
      }),
    ).toEqual([naucalpan, monterrey]);
  });

  it('returns empty without deliveries', () => {
    expect(clientDeliveryRows({})).toEqual([]);
  });
});

describe('pickClientDelivery', () => {
  const client = { deliveries: [naucalpan, monterrey] };

  it('picks by postal code and locality', () => {
    expect(
      pickClientDelivery(client, {
        postalCode: '64000',
        locality: 'Monterrey',
      }),
    ).toEqual(monterrey);
  });

  it('returns undefined when route CP has no match', () => {
    expect(
      pickClientDelivery(client, { postalCode: '01000' }),
    ).toBeUndefined();
  });
});
