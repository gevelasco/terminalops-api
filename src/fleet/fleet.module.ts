import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Company } from 'src/companies/entities/company.entity';
import { CompanyOperationConfiguration } from 'src/operation-configurations/entities/company-operation-configuration.entity';
import { ExpensesModule } from 'src/expenses/expenses.module';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { TripsModule } from 'src/trips/trips.module';
import { FleetResourceGuardService } from 'src/fleet/fleet-resource-guard.service';
import { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import { FleetBrand } from 'src/fleet/entities/fleet-brand.entity';
import { FleetBrandVersion } from 'src/fleet/entities/fleet-brand-version.entity';
import { FleetTenureService } from 'src/fleet/fleet-tenure.service';
import { FleetOverviewService } from 'src/fleet/fleet-overview.service';
import { FleetBrandsService } from 'src/fleet/fleet-brands.service';
import { FleetStatusResolverService } from 'src/fleet/fleet-status-resolver.service';
import { FleetMaintenanceWorkflowService } from 'src/fleet/fleet-maintenance-workflow.service';
import { FleetMaintenanceExpenseSyncService } from 'src/fleet/fleet-maintenance-expense-sync.service';
import { FleetVerificationExpenseSyncService } from 'src/fleet/fleet-verification-expense-sync.service';
import { FleetInsuranceExpenseSyncService } from 'src/fleet/fleet-insurance-expense-sync.service';
import { FleetGpsExpenseSyncService } from 'src/fleet/fleet-gps-expense-sync.service';
import { FleetTenureExpenseSyncService } from 'src/fleet/fleet-tenure-expense-sync.service';
import { FleetExpenseBootstrapService } from 'src/fleet/fleet-expense-bootstrap.service';
import { Expense } from 'src/expenses/entities/expense.entity';

@Module({
  imports: [
    TripsModule,
    ExpensesModule,
    TypeOrmModule.forFeature([
      FleetAssetTenure,
      FleetBrand,
      FleetBrandVersion,
      Unit,
      Equipment,
      Trip,
      TripEquipment,
      CompanyOperationConfiguration,
      Company,
      Expense,
    ]),
  ],
  providers: [
    FleetTenureService,
    FleetOverviewService,
    FleetBrandsService,
    FleetResourceGuardService,
    FleetStatusResolverService,
    FleetMaintenanceWorkflowService,
    FleetMaintenanceExpenseSyncService,
    FleetVerificationExpenseSyncService,
    FleetInsuranceExpenseSyncService,
    FleetGpsExpenseSyncService,
    FleetTenureExpenseSyncService,
    FleetExpenseBootstrapService,
  ],
  exports: [
    FleetTenureService,
    FleetOverviewService,
    FleetBrandsService,
    FleetResourceGuardService,
    FleetStatusResolverService,
    FleetMaintenanceWorkflowService,
    FleetMaintenanceExpenseSyncService,
    FleetVerificationExpenseSyncService,
    FleetInsuranceExpenseSyncService,
    FleetGpsExpenseSyncService,
    FleetTenureExpenseSyncService,
    TripsModule,
  ],
})
export class FleetModule {}
