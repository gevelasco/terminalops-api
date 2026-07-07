import { Repository } from 'typeorm';

/** Actualiza `status` solo si el valor persistido coincide (compare-and-set). */
export async function updateFleetResourceStatusCompareAndSet(
  repo: Repository<{ id: number; status?: string | null }>,
  companyId: number,
  resourceId: number,
  previousStatus: string | null | undefined,
  nextStatus: string,
): Promise<boolean> {
  const prev = (previousStatus ?? '').trim();
  const qb = repo
    .createQueryBuilder()
    .update()
    .set({ status: nextStatus })
    .where('id = :id', { id: resourceId })
    .andWhere('company_id = :companyId', { companyId });

  if (prev === '') {
    qb.andWhere('(status IS NULL OR TRIM(status) = :empty)', { empty: '' });
  } else {
    qb.andWhere('status = :prevStatus', { prevStatus: prev });
  }

  const result = await qb.execute();
  return (result.affected ?? 0) > 0;
}
