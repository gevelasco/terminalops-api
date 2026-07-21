import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slim expenses: drop target/scope/provision flags.
 * Verificación se identifica por category (estilo GPS), no por verification_scope.
 * Target unit/equipment se deriva de related_*_id.
 * Provisión operativa = kind operational_control.
 */
export class SlimExpenseRelationFlags1749400000000
  implements MigrationInterface
{
  name = 'SlimExpenseRelationFlags1749400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Normalizar categorías de verificación (scope → category canónica)
    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET category = CASE verification_scope
        WHEN 'phys_mech' THEN 'Verificación - físico-mecánica'
        WHEN 'emissions' THEN 'Verificación - emisiones'
        WHEN 'double_articulated' THEN 'Verificación - doble articulado'
        ELSE category
      END,
      description = COALESCE(
        NULLIF(BTRIM(description), ''),
        CASE verification_scope
          WHEN 'phys_mech' THEN 'Pago de verificación - físico-mecánica'
          WHEN 'emissions' THEN 'Pago de verificación - emisiones'
          WHEN 'double_articulated' THEN 'Pago de verificación - doble articulado'
          ELSE description
        END
      )
      WHERE kind = 'verification'
        AND verification_scope IS NOT NULL;
    `);
    // Filas legacy con category antigua sin scope
    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET category = 'Verificación - físico-mecánica'
      WHERE kind = 'verification'
        AND lower(btrim(category)) IN (
          'verificación físico-mecánica',
          'verificacion fisico-mecanica',
          'verificación fisico-mecánica'
        );
    `);
    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET category = 'Verificación - emisiones'
      WHERE kind = 'verification'
        AND lower(btrim(category)) IN (
          'verificación de emisiones',
          'verificacion de emisiones'
        );
    `);
    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET category = 'Verificación - doble articulado'
      WHERE kind = 'verification'
        AND lower(btrim(category)) IN (
          'doble articulado (spp)',
          'doble articulado'
        );
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.expenses
        DROP COLUMN IF EXISTS maintenance_target,
        DROP COLUMN IF EXISTS insurance_target,
        DROP COLUMN IF EXISTS verification_scope,
        DROP COLUMN IF EXISTS is_operational_provision;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.expenses
        ADD COLUMN IF NOT EXISTS maintenance_target text
          CHECK (maintenance_target IS NULL OR maintenance_target IN ('unit', 'equipment')),
        ADD COLUMN IF NOT EXISTS insurance_target text
          CHECK (insurance_target IS NULL OR insurance_target IN ('unit', 'equipment')),
        ADD COLUMN IF NOT EXISTS verification_scope text
          CHECK (verification_scope IS NULL OR verification_scope IN (
            'phys_mech', 'emissions', 'double_articulated'
          )),
        ADD COLUMN IF NOT EXISTS is_operational_provision boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET is_operational_provision = true
      WHERE kind = 'operational_control';
    `);
    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET maintenance_target = CASE
        WHEN related_equipment_id IS NOT NULL THEN 'equipment'
        WHEN related_unit_id IS NOT NULL THEN 'unit'
        ELSE NULL
      END
      WHERE kind = 'maintenance';
    `);
    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET insurance_target = CASE
        WHEN related_equipment_id IS NOT NULL THEN 'equipment'
        WHEN related_unit_id IS NOT NULL THEN 'unit'
        ELSE NULL
      END
      WHERE kind = 'insurance';
    `);
    await queryRunner.query(`
      UPDATE terminalops.expenses
      SET verification_scope = CASE
        WHEN category ILIKE '%físico-mecánica%' OR category ILIKE '%fisico-mecanica%' THEN 'phys_mech'
        WHEN category ILIKE '%emisiones%' THEN 'emissions'
        WHEN category ILIKE '%doble articulado%' OR category ILIKE '%spp%' THEN 'double_articulated'
        ELSE NULL
      END
      WHERE kind = 'verification';
    `);
  }
}
