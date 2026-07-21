import { Module } from '@nestjs/common';
import { FleetModule } from 'src/fleet/fleet.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EquipmentFleetDocument } from 'src/equipment/entities/equipment-fleet-document.entity';
import { EquipmentFleetProfile } from 'src/equipment/entities/equipment-fleet-profile.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { FleetMaintenanceEntry } from 'src/units/entities/fleet-maintenance-entry.entity';
import { FleetVerificationEntry } from 'src/units/entities/fleet-verification-entry.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';

@Module({
  imports: [
    FleetModule,
    TypeOrmModule.forFeature([
      Equipment,
      Unit,
      EquipmentFleetProfile,
      FleetMaintenanceEntry,
      FleetVerificationEntry,
      EquipmentFleetDocument,
    ]),
  ],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
