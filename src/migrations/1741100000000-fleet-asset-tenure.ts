import { MigrationInterface, QueryRunner } from 'typeorm';

export class FleetAssetTenure1741100000000 implements MigrationInterface {
  name = 'FleetAssetTenure1741100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE terminalops.fleet_asset_tenure (
        id serial PRIMARY KEY,
        company_id int NOT NULL REFERENCES terminalops.companies(id) ON DELETE CASCADE,
        unit_id int UNIQUE REFERENCES terminalops.units(id) ON DELETE CASCADE,
        equipment_id int UNIQUE REFERENCES terminalops.equipment(id) ON DELETE CASCADE,
        tenure_mode text,
        commercial_value numeric(14, 2),
        recurring_payment_amount numeric(14, 2),
        recurring_payment_date date,
        recurring_installment_count int,
        management_owner_payout numeric(14, 2),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fleet_asset_tenure_subject_chk CHECK (
          (unit_id IS NOT NULL AND equipment_id IS NULL)
          OR (unit_id IS NULL AND equipment_id IS NOT NULL)
        )
      );
    `);

    await queryRunner.query(`
      INSERT INTO terminalops.fleet_asset_tenure (
        company_id,
        unit_id,
        tenure_mode,
        commercial_value,
        recurring_payment_amount,
        recurring_payment_date,
        recurring_installment_count,
        management_owner_payout
      )
      SELECT
        u.company_id,
        p.unit_id,
        p.trailer_tenure_mode,
        p.trailer_commercial_value,
        p.trailer_recurring_payment_amount,
        p.trailer_recurring_payment_date,
        p.trailer_recurring_installment_count,
        p.trailer_management_owner_payout
      FROM terminalops.unit_fleet_profiles p
      INNER JOIN terminalops.units u ON u.id = p.unit_id
      WHERE
        p.trailer_tenure_mode IS NOT NULL
        OR p.trailer_commercial_value IS NOT NULL
        OR p.trailer_recurring_payment_amount IS NOT NULL
        OR p.trailer_recurring_payment_date IS NOT NULL
        OR p.trailer_recurring_installment_count IS NOT NULL
        OR p.trailer_management_owner_payout IS NOT NULL;
    `);

    await queryRunner.query(`
      INSERT INTO terminalops.fleet_asset_tenure (
        company_id,
        equipment_id,
        tenure_mode,
        commercial_value,
        recurring_payment_amount,
        recurring_payment_date,
        recurring_installment_count,
        management_owner_payout
      )
      SELECT
        e.company_id,
        p.equipment_id,
        p.trailer_tenure_mode,
        p.trailer_commercial_value,
        p.trailer_recurring_payment_amount,
        p.trailer_recurring_payment_date,
        p.trailer_recurring_installment_count,
        p.trailer_management_owner_payout
      FROM terminalops.equipment_fleet_profiles p
      INNER JOIN terminalops.equipment e ON e.id = p.equipment_id
      WHERE
        p.trailer_tenure_mode IS NOT NULL
        OR p.trailer_commercial_value IS NOT NULL
        OR p.trailer_recurring_payment_amount IS NOT NULL
        OR p.trailer_recurring_payment_date IS NOT NULL
        OR p.trailer_recurring_installment_count IS NOT NULL
        OR p.trailer_management_owner_payout IS NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        DROP COLUMN IF EXISTS trailer_tenure_mode,
        DROP COLUMN IF EXISTS trailer_commercial_value,
        DROP COLUMN IF EXISTS trailer_recurring_payment_amount,
        DROP COLUMN IF EXISTS trailer_recurring_payment_date,
        DROP COLUMN IF EXISTS trailer_recurring_installment_count,
        DROP COLUMN IF EXISTS trailer_management_owner_payout;
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        DROP COLUMN IF EXISTS trailer_tenure_mode,
        DROP COLUMN IF EXISTS trailer_commercial_value,
        DROP COLUMN IF EXISTS trailer_recurring_payment_amount,
        DROP COLUMN IF EXISTS trailer_recurring_payment_date,
        DROP COLUMN IF EXISTS trailer_recurring_installment_count,
        DROP COLUMN IF EXISTS trailer_management_owner_payout;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE terminalops.unit_fleet_profiles
        ADD COLUMN IF NOT EXISTS trailer_tenure_mode text,
        ADD COLUMN IF NOT EXISTS trailer_commercial_value numeric(14, 2),
        ADD COLUMN IF NOT EXISTS trailer_recurring_payment_amount numeric(14, 2),
        ADD COLUMN IF NOT EXISTS trailer_recurring_payment_date date,
        ADD COLUMN IF NOT EXISTS trailer_recurring_installment_count int,
        ADD COLUMN IF NOT EXISTS trailer_management_owner_payout numeric(14, 2);
    `);

    await queryRunner.query(`
      ALTER TABLE terminalops.equipment_fleet_profiles
        ADD COLUMN IF NOT EXISTS trailer_tenure_mode text,
        ADD COLUMN IF NOT EXISTS trailer_commercial_value numeric(14, 2),
        ADD COLUMN IF NOT EXISTS trailer_recurring_payment_amount numeric(14, 2),
        ADD COLUMN IF NOT EXISTS trailer_recurring_payment_date date,
        ADD COLUMN IF NOT EXISTS trailer_recurring_installment_count int,
        ADD COLUMN IF NOT EXISTS trailer_management_owner_payout numeric(14, 2);
    `);

    await queryRunner.query(`
      UPDATE terminalops.unit_fleet_profiles p
      SET
        trailer_tenure_mode = t.tenure_mode,
        trailer_commercial_value = t.commercial_value,
        trailer_recurring_payment_amount = t.recurring_payment_amount,
        trailer_recurring_payment_date = t.recurring_payment_date,
        trailer_recurring_installment_count = t.recurring_installment_count,
        trailer_management_owner_payout = t.management_owner_payout
      FROM terminalops.fleet_asset_tenure t
      WHERE t.unit_id = p.unit_id;
    `);

    await queryRunner.query(`
      UPDATE terminalops.equipment_fleet_profiles p
      SET
        trailer_tenure_mode = t.tenure_mode,
        trailer_commercial_value = t.commercial_value,
        trailer_recurring_payment_amount = t.recurring_payment_amount,
        trailer_recurring_payment_date = t.recurring_payment_date,
        trailer_recurring_installment_count = t.recurring_installment_count,
        trailer_management_owner_payout = t.management_owner_payout
      FROM terminalops.fleet_asset_tenure t
      WHERE t.equipment_id = p.equipment_id;
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS terminalops.fleet_asset_tenure;`);
  }
}
