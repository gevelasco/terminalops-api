import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { EQUIPMENT_FLEET_DOCUMENT_KINDS } from '../equipment-fleet-document.constants';

export class UploadEquipmentFleetDocumentDto {
  @ApiProperty({ enum: EQUIPMENT_FLEET_DOCUMENT_KINDS })
  @IsString()
  @IsIn([...EQUIPMENT_FLEET_DOCUMENT_KINDS])
  documentKind: (typeof EQUIPMENT_FLEET_DOCUMENT_KINDS)[number];
}
