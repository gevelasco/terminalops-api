import { MigrationInterface, QueryRunner } from 'typeorm';

const SCHEMA = process.env.TERMINALOPS_SCHEMA || 'terminalops';

/**
 * Histórico: el pago a operador se insertaba al confirmar (ya realizado)
 * con paid_at null. El alta de maniobra ahora escribe la cuota pendiente
 * en la misma transacción (created_at ≈ trip.created_at).
 *
 * Solo se marcan como pagadas las filas creadas después del alta de la
 * maniobra (el patrón viejo de confirmar). Las cuotas pendientes nuevas
 * no se tocan.
 */
export class OperatorPaymentPaidAtBackfill1751800000000 implements MigrationInterface {
  name = 'OperatorPaymentPaidAtBackfill1751800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "${SCHEMA}"."expenses" e
      SET "paid_at" = e."incurred_at"
      FROM "${SCHEMA}"."trips" t
      WHERE e."trip_id" = t.id
        AND e."kind" IN ('operator_payment', 'operator_commission')
        AND e."discarded_at" IS NULL
        AND e."paid_at" IS NULL
        AND t."deleted_at" IS NULL
        AND e."created_at" > t."created_at" + interval '1 minute'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "${SCHEMA}"."expenses" e
      SET "paid_at" = NULL
      FROM "${SCHEMA}"."trips" t
      WHERE e."trip_id" = t.id
        AND e."kind" IN ('operator_payment', 'operator_commission')
        AND e."paid_at" IS NOT NULL
        AND e."paid_at" = e."incurred_at"
        AND t."deleted_at" IS NULL
        AND e."created_at" > t."created_at" + interval '1 minute'
    `);
  }
}
