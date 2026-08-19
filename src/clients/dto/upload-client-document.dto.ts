import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { CLIENT_DOCUMENT_SLOTS } from '../client-document.constants';

export class UploadClientDocumentDto {
  @ApiProperty({ enum: CLIENT_DOCUMENT_SLOTS })
  @IsString()
  @IsIn([...CLIENT_DOCUMENT_SLOTS])
  slot: (typeof CLIENT_DOCUMENT_SLOTS)[number];
}
