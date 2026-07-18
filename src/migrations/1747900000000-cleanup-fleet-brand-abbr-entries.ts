import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El catálogo de marcas se contaminó con abreviaciones operativas
 * (`trailer_brand_abbr`, ej. "KEN") creadas por el fallback de
 * `resolveFleetBrandNameFromPayload`. Desactiva las entradas cuyo nombre
 * coincide con una abreviación usada en unidades/equipos pero que nunca fue
 * capturada como nombre real de marca en los perfiles.
 */
export class CleanupFleetBrandAbbrEntries1747900000000
  implements MigrationInterface
{
  name = 'CleanupFleetBrandAbbrEntries1747900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE terminalops.fleet_brands fb
      SET is_active = false
      WHERE fb.is_active = true
        AND fb.type = 'UNIT'
        AND fb.name_normalized IN (
          SELECT lower(trim(u.trailer_brand_abbr))
          FROM terminalops.units u
          WHERE u.trailer_brand_abbr IS NOT NULL
            AND trim(u.trailer_brand_abbr) <> ''
        )
        AND fb.name_normalized NOT IN (
          SELECT lower(trim(p.trailer_brand_name))
          FROM terminalops.unit_fleet_profiles p
          WHERE p.trailer_brand_name IS NOT NULL
            AND trim(p.trailer_brand_name) <> ''
        );
    `);
    await queryRunner.query(`
      UPDATE terminalops.fleet_brands fb
      SET is_active = false
      WHERE fb.is_active = true
        AND fb.type = 'EQUIPMENT'
        AND fb.name_normalized IN (
          SELECT lower(trim(e.trailer_brand_abbr))
          FROM terminalops.equipment e
          WHERE e.trailer_brand_abbr IS NOT NULL
            AND trim(e.trailer_brand_abbr) <> ''
        )
        AND fb.name_normalized NOT IN (
          SELECT lower(trim(p.trailer_brand_name))
          FROM terminalops.equipment_fleet_profiles p
          WHERE p.trailer_brand_name IS NOT NULL
            AND trim(p.trailer_brand_name) <> ''
        );
    `);
  }

  public async down(): Promise<void> {
    // Limpieza de datos; no es reversible de forma segura.
  }
}
