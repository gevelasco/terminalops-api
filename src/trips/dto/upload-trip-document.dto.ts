import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { TRIP_DOCUMENT_KINDS } from '../trip-document.constants';

export class UploadTripDocumentDto {
  @ApiProperty({ enum: TRIP_DOCUMENT_KINDS })
  @IsString()
  @IsIn([...TRIP_DOCUMENT_KINDS])
  documentKind: (typeof TRIP_DOCUMENT_KINDS)[number];
}
