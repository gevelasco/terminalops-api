import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AddIncidentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  description: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  postedBy: string;
}
