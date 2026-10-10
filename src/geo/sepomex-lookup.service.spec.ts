import { NotFoundException } from '@nestjs/common';
import { SepomexLookupService } from './sepomex-lookup.service';

describe('SepomexLookupService', () => {
  let service: SepomexLookupService;
  const fetchMock = jest.fn();

  beforeEach(() => {
    service = new SepomexLookupService();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('resolves CP via Kurenn when NitroStudio SEPOMex is down', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          zip_codes: [
            {
              d_codigo: '66380',
              d_asenta: 'Parque Industrial FINSA Santa Catarina',
              d_tipo_asenta: 'Zona industrial',
              d_mnpio: 'Santa Catarina',
              d_estado: 'Nuevo León',
              id_asenta_cpcons: '0009',
            },
          ],
        }),
      } as Response);

    const rows = await service.lookupByPostalCode('66380');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      postalCode: '66380',
      settlement: 'Parque Industrial FINSA Santa Catarina',
      municipality: 'Santa Catarina',
      state: 'Nuevo León',
      settlementConsId: '0009',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('kurenn.dev');
  });

  it('normalizes long Postali slugs to fit settlement_cons_id', async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('nitrostudio')) {
        return { ok: false, status: 502 } as Response;
      }
      if (url.includes('kurenn.dev')) {
        return { ok: false, status: 503 } as Response;
      }
      if (url.includes('postali.app')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            cp: '66380',
            estado: 'Nuevo León',
            municipio: 'Santa Catarina',
            asentamientos: [
              {
                nombre: 'Parque Industrial FINSA Santa Catarina',
                tipo: 'Zona industrial',
                asenta_slug: 'parque-industrial-finsa-santa-catarina',
              },
            ],
          }),
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });

    const rows = await service.lookupByPostalCode('66380');
    expect(rows[0].settlementConsId.length).toBeLessThanOrEqual(32);
  });

  it('throws not found when every provider misses the CP', async () => {
    fetchMock.mockImplementation(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('zippopotam.us')) {
        return {
          ok: false,
          status: 404,
        } as Response;
      }
      if (url.includes('postali.app')) {
        return {
          ok: false,
          status: 404,
        } as Response;
      }
      if (url.includes('kurenn.dev')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ zip_codes: [] }),
        } as Response;
      }
      return {
        ok: false,
        status: 502,
      } as Response;
    });

    await expect(service.lookupByPostalCode('99999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
