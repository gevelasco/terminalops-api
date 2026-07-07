import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { UnitFleetProfile } from 'src/units/entities/unit-fleet-profile.entity';
import { ExpensesController } from './expenses.controller';
import { ExpensesMaintenanceFleetReconcileService } from './expenses-maintenance-fleet-reconcile.service';
import { ExpensesInsuranceFleetReconcileService } from './expenses-insurance-fleet-reconcile.service';
import { ExpensesVerificationFleetReconcileService } from './expenses-verification-fleet-reconcile.service';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Expense,
      Trip,
      Unit,
      Equipment,
      Operator,
      UnitFleetProfile,
      EquipmentFleetProfile,
      FleetMaintenanceEntry,
    ]),
  ],
  controllers: [ExpensesController],
  providers: [
    ExpensesService,
    ExpensesInsuranceFleetReconcileService,
    ExpensesMaintenanceFleetReconcileService,
    ExpensesVerificationFleetReconcileService,
  ],
  exports: [ExpensesService],
})
export class ExpensesModule {}
