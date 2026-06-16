import { ApiProperty } from '@nestjs/swagger';

export class ClientCargoHistoryItemDto {
  @ApiProperty({ example: 'Azucar' })
  description!: string;

  @ApiProperty({ example: 'sencillo' })
  operationType!: string;

  @ApiProperty({ example: '40ft' })
  containerType!: string;

  @ApiProperty({ example: 'lleno' })
  loadType!: string;

  @ApiProperty({ example: '18' })
  approximateWeightTons!: string;
}

export class ClientCargoHistoryResponseDto {
  @ApiProperty({ type: [ClientCargoHistoryItemDto] })
  items!: ClientCargoHistoryItemDto[];
}
