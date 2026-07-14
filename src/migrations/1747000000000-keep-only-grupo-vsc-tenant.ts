import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Limpieza de datos multi-tenant de desarrollo:
 * conserva únicamente la empresa "Grupo VSC" y todo su cascado
 * (usuarios, clientes, flota, viajes, gastos, etc.).
 *
 * No toca tablas globales (p. ej. fuel_prices).
 * Irreversible: down() no restaura empresas eliminadas.
 */
export class KeepOnlyGrupoVscTenant1747000000000 implements MigrationInterface {
  name = 'KeepOnlyGrupoVscTenant1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        v_keep_id integer;
        v_keep_count integer;
      BEGIN
        SELECT COUNT(*)::integer INTO v_keep_count
        FROM terminalops.companies
        WHERE lower(btrim(name)) = lower(btrim('Grupo VSC'));

        IF v_keep_count = 0 THEN
          RAISE EXCEPTION
            'KeepOnlyGrupoVscTenant: no se encontró la empresa "Grupo VSC"; abortando sin borrar datos';
        END IF;

        IF v_keep_count > 1 THEN
          RAISE EXCEPTION
            'KeepOnlyGrupoVscTenant: hay % empresas con nombre "Grupo VSC"; abortando',
            v_keep_count;
        END IF;

        SELECT id INTO v_keep_id
        FROM terminalops.companies
        WHERE lower(btrim(name)) = lower(btrim('Grupo VSC'));

        -- Sin FK a companies: limpia huérfanos de otros tenants
        DELETE FROM terminalops.fleet_status_events
        WHERE company_id IS DISTINCT FROM v_keep_id;

        -- trip_equipment.equipment_id es ON DELETE RESTRICT: hay que liberar
        -- el equipo antes de que CASCADE intente borrarlo con la empresa.
        DELETE FROM terminalops.trip_equipment te
        USING terminalops.trips t
        WHERE te.trip_id = t.id
          AND t.company_id IS DISTINCT FROM v_keep_id;

        DELETE FROM terminalops.trips
        WHERE company_id IS DISTINCT FROM v_keep_id;

        -- destination_rate_prices → operation_configuration ON DELETE RESTRICT
        DELETE FROM terminalops.destination_rate_prices drp
        USING terminalops.company_operation_configurations cfg
        WHERE drp.operation_configuration_id = cfg.id
          AND cfg.company_id IS DISTINCT FROM v_keep_id;

        -- destination_rates → operational_centers ON DELETE RESTRICT
        DELETE FROM terminalops.destination_rates
        WHERE company_id IS DISTINCT FROM v_keep_id;

        -- Evita ciclos / referencias al borrar centros operativos / usuarios
        UPDATE terminalops.companies
        SET
          primary_operational_center_id = NULL,
          diesel_reference_price_updated_by_user_id = NULL
        WHERE id IS DISTINCT FROM v_keep_id;

        DELETE FROM terminalops.companies
        WHERE id IS DISTINCT FROM v_keep_id;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Irreversible: no se restauran empresas ni datos de tenant eliminados.
  }
}
