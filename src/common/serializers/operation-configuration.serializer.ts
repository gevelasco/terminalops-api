import { CompanyOperationConfiguration } from 'src/operation-configurations/entities/company-operation-configuration.entity';
import { toIsoString } from 'src/common/utils/iso-date.util';

export function serializeOperationConfiguration(
  row: CompanyOperationConfiguration,
): Record<string, unknown> {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    maxEquipmentCount: row.maxEquipmentCount,
    version: row.version,
    active: row.active,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}
