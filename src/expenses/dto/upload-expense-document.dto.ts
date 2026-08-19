import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { EXPENSE_DOCUMENT_SLOTS } from '../expense-document.constants';

export class UploadExpenseDocumentDto {
  @ApiProperty({ enum: EXPENSE_DOCUMENT_SLOTS })
  @IsString()
  @IsIn([...EXPENSE_DOCUMENT_SLOTS])
  slot: (typeof EXPENSE_DOCUMENT_SLOTS)[number];
}
