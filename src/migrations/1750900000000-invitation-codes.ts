import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Códigos de invitación en BD: one-time, plan y duración configurables.
 *
 * Insertar más (ejemplo Standard 3 meses):
 *   INSERT INTO terminalops.invitation_codes
 *     (code, purpose, granted_plan, license_months, max_uses, note)
 *   VALUES
 *     ('ABCD-STAN-2026-XXXX', 'upgrade', 'standard', 3, 1, 'Empresa Y');
 */
export class InvitationCodes1750900000000 implements MigrationInterface {
  name = 'InvitationCodes1750900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.invitation_codes (
        id serial PRIMARY KEY,
        code text NOT NULL,
        purpose text NOT NULL,
        granted_plan text NOT NULL,
        license_months integer NOT NULL,
        max_uses integer NOT NULL DEFAULT 1,
        used_count integer NOT NULL DEFAULT 0,
        is_active boolean NOT NULL DEFAULT true,
        expires_at timestamptz NULL,
        redeemed_at timestamptz NULL,
        redeemed_by_user_id integer NULL
          REFERENCES terminalops.app_user(id) ON DELETE SET NULL,
        redeemed_by_company_id integer NULL
          REFERENCES terminalops.companies(id) ON DELETE SET NULL,
        note text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT invitation_codes_code_uidx UNIQUE (code),
        CONSTRAINT invitation_codes_purpose_chk
          CHECK (purpose IN ('signup', 'upgrade')),
        CONSTRAINT invitation_codes_plan_chk
          CHECK (granted_plan IN ('basic', 'standard', 'pro')),
        CONSTRAINT invitation_codes_license_months_chk
          CHECK (license_months >= 1 AND license_months <= 120),
        CONSTRAINT invitation_codes_max_uses_chk
          CHECK (max_uses >= 1),
        CONSTRAINT invitation_codes_used_count_chk
          CHECK (used_count >= 0 AND used_count <= max_uses)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS invitation_codes_available_idx
        ON terminalops.invitation_codes (purpose, is_active)
        WHERE used_count < max_uses AND is_active = true;
    `);

    // 3 altas Básico (6 meses) + 3 upgrades Pro (6 meses). Uso único.
    await queryRunner.query(`
      INSERT INTO terminalops.invitation_codes
        (code, purpose, granted_plan, license_months, max_uses, note)
      VALUES
        ('TX9X-BASI-2026-1V4N', 'signup', 'basic', 6, 1, 'Beta alta #1'),
        ('VK7J-BASI-A995-S4UL', 'signup', 'basic', 6, 1, 'Beta alta #2'),
        ('NBBB-BASI-994A-G3RM', 'signup', 'basic', 6, 1, 'Beta alta #3'),
        ('PX8M-PROX-2026-K4QJ', 'upgrade', 'pro', 6, 1, 'Beta upgrade Pro #1'),
        ('W3HN-PROX-B771-M9VR', 'upgrade', 'pro', 6, 1, 'Beta upgrade Pro #2'),
        ('JC5T-PROX-2026-L2XW', 'upgrade', 'pro', 6, 1, 'Beta upgrade Pro #3')
      ON CONFLICT (code) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.invitation_codes_available_idx;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.invitation_codes;
    `);
  }
}
