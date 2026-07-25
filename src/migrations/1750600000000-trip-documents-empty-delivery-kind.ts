import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Documentos de entrega de vacío en maniobra (`empty_delivery`).
 */
export class TripDocumentsEmptyDeliveryKind1750600000000
  implements MigrationInterface
{
  name = 'TripDocumentsEmptyDeliveryKind1750600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_documents
        DROP CONSTRAINT IF EXISTS trip_documents_kind_chk
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_documents
        ADD CONSTRAINT trip_documents_kind_chk CHECK (
          document_kind IN (
            'load',
            'operational_costs',
            'billing',
            'empty_delivery'
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM terminalops.trip_documents
      WHERE document_kind = 'empty_delivery'
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_documents
        DROP CONSTRAINT IF EXISTS trip_documents_kind_chk
    `);
    await queryRunner.query(`
      ALTER TABLE terminalops.trip_documents
        ADD CONSTRAINT trip_documents_kind_chk CHECK (
          document_kind IN ('load', 'operational_costs', 'billing')
        )
    `);
  }
}
