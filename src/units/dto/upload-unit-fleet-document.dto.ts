import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { UNIT_FLEET_DOCUMENT_KINDS } from '../unit-fleet-document.constants';

export class UploadUnitFleetDocumentDto {
  @ApiProperty({ enum: UNIT_FLEET_DOCUMENT_KINDS })
  @IsString()
  @IsIn([...UNIT_FLEET_DOCUMENT_KINDS])
  documentKind: (typeof UNIT_FLEET_DOCUMENT_KINDS)[number];
}
