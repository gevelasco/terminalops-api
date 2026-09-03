import { serializeClient } from './client.serializer';
import { Client } from 'src/clients/entities/client.entity';
import { ClientDelivery } from 'src/clients/entities/client-delivery.entity';

describe('serializeClient deliveries', () => {
  it('returns deliveries plus legacy first item', () => {
    const dto = serializeClient({
      id: 6,
      companyId: 1,
      name: 'Agencia',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      deliveries: [
        {
          id: 11,
          clientId: 6,
          sortOrder: 0,
          postalCode: '53470',
          locality: 'Loma de Canteras (Lomas de Cantera)',
          latitude: '19.4694361',
          longitude: '-99.2431411',
        } as ClientDelivery,
        {
          id: 12,
          clientId: 6,
          sortOrder: 1,
          postalCode: '64000',
          locality: 'Monterrey Centro',
          latitude: '25.668618',
          longitude: '-100.3205641',
        } as ClientDelivery,
      ],
    } as Client);

    expect(dto['deliveries']).toHaveLength(2);
    expect((dto['deliveries'] as { postalCode?: string }[])[1]?.postalCode).toBe(
      '64000',
    );
    expect((dto['delivery'] as { id?: number }).id).toBe(11);
  });
});
