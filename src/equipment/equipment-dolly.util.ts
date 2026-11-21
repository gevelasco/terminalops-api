import { Equipment } from 'src/equipment/entities/equipment.entity';

export function isDollyEquipmentType(type?: string | null): boolean {
  const v = (type ?? '').trim().toLowerCase();
  return v === 'dolly' || v.includes('dolly') || v.includes('convertidor');
}

export function isDollyEquipment(e: Pick<Equipment, 'type'>): boolean {
  return isDollyEquipmentType(e.type);
}