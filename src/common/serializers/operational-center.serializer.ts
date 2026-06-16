import { OperationalCenter } from 'src/operational-centers/entities/operational-center.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

export function serializeOperationalCenter(
  row: OperationalCenter,
): Record<string, unknown> {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    code: row.code,
    postalCode: row.postalCode ?? undefined,
    cityMunicipality: row.cityMunicipality ?? undefined,
    locality: row.locality ?? undefined,
    settlementConsId: row.settlementConsId ?? undefined,
    latitude: row.latitude != null ? Number(row.latitude) : undefined,
    longitude: row.longitude != null ? Number(row.longitude) : undefined,
    isDefault: row.isDefault,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
