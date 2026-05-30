import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { TERMINALOPS_SCHEMA } from 'src/common/constants/schema-name';
import { Trip } from 'src/trips/entities/trip.entity';

@Entity({ schema: TERMINALOPS_SCHEMA, name: 'trip_equipment' })
export class TripEquipment {
  @PrimaryColumn({ name: 'trip_id', type: 'int' })
  tripId: number;

  @PrimaryColumn({ name: 'equipment_id', type: 'int' })
  equipmentId: number;

  @Column({ type: 'smallint', default: 1 })
  position: number;

  @ManyToOne(() => Trip, (t) => t.tripEquipment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @ManyToOne(() => Equipment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'equipment_id' })
  equipment: Equipment;
}
