import type { Operator } from 'src/operators/entities/operator.entity';

export type OperatorLinkOptionDto = {
  id: number;
  name: string;
  status: string;
  isActive: boolean;
};

export function mapOperatorLinkOption(operator: Operator): OperatorLinkOptionDto {
  return {
    id: operator.id,
    name: operator.name?.trim() || String(operator.id),
    status: operator.status,
    isActive: operator.isActive !== false,
  };
}
