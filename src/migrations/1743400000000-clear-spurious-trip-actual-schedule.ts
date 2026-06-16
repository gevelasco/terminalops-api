import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClearSpuriousTripActualSchedule1743400000000
  implements MigrationInterface
{
  name = 'ClearSpuriousTripActualSchedule1743400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
UPDATE terminalops.trips
SET
  departure_at = NULL,
  arrived_at = NULL,
  return_at = NULL
WHERE status = 'scheduled'
  AND (
    departure_at IS NOT NULL
    OR arrived_at IS NOT NULL
    OR return_at IS NOT NULL
  );
`);

    await queryRunner.query(`
UPDATE terminalops.trips t
SET
  departure_at = NULL,
  arrived_at = NULL,
  return_at = NULL
WHERE departure_at IS NOT NULL
  AND arrived_at IS NOT NULL
  AND return_at IS NOT NULL
  AND departure_at = arrived_at
  AND arrived_at = return_at
  AND NOT EXISTS (
    SELECT 1
    FROM terminalops.trip_incidents i
    WHERE i.trip_id = t.id
      AND i.category = 'schedule_update'
  );
`);

    await queryRunner.query(`
UPDATE terminalops.trips t
SET
  departure_at = CASE
    WHEN departure_at IS NOT NULL AND departure_at = t.created_at THEN NULL
    ELSE departure_at
  END,
  arrived_at = CASE
    WHEN arrived_at IS NOT NULL AND arrived_at = t.created_at THEN NULL
    ELSE arrived_at
  END,
  return_at = CASE
    WHEN return_at IS NOT NULL AND return_at = t.created_at THEN NULL
    ELSE return_at
  END
WHERE departure_at = t.created_at
   OR arrived_at = t.created_at
   OR return_at = t.created_at;
`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: limpieza de datos heredados no reversible de forma segura.
  }
}
