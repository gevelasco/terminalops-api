import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { OPERATOR_DOCUMENT_SLOTS } from '../operator-document.constants';

export class UploadOperatorDocumentDto {
  @ApiProperty({ enum: OPERATOR_DOCUMENT_SLOTS })
  @IsString()
  @IsIn([...OPERATOR_DOCUMENT_SLOTS])
  slot: (typeof OPERATOR_DOCUMENT_SLOTS)[number];
}
