import { MigrationInterface, QueryRunner } from 'typeorm';

const GLOBAL_ALIASES: ReadonlyArray<{ plazaKey: string; displayName: string }> =
  [
    { plazaKey: 'mxn523:o2', displayName: 'San Marcos' },
    { plazaKey: 'mxn223:o3', displayName: 'Sayula' },
    {
      plazaKey: 'inegi:hce1ccab165c1fa04b338:mxn523:o2',
      displayName: 'San Marcos',
    },
    {
      plazaKey: 'inegi:hce1ccab165c1fa04b338:mxn223:o3',
      displayName: 'Sayula',
    },
    {
      plazaKey: 'inegi:19.05200,-104.31900:mxn523:o2',
      displayName: 'San Marcos',
    },
    {
      plazaKey: 'inegi:19.05200,-104.31900:mxn223:o3',
      displayName: 'Sayula',
    },
  ];

export class TollPlazaGlobalAliases1753030000000 implements MigrationInterface {
  name = 'TollPlazaGlobalAliases1753030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE terminalops.toll_plaza_global_aliases (
        plaza_key VARCHAR(128) PRIMARY KEY,
        display_name VARCHAR(200) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    for (const row of GLOBAL_ALIASES) {
      await queryRunner.query(
        `
        INSERT INTO terminalops.toll_plaza_global_aliases (plaza_key, display_name)
        VALUES ($1, $2)
        ON CONFLICT (plaza_key)
        DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now();
        `,
        [row.plazaKey, row.displayName],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_plaza_global_aliases;
    `);
  }
}