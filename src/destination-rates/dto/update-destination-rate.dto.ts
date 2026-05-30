import { PartialType } from '@nestjs/swagger';
import { CreateDestinationRateDto } from './create-destination-rate.dto';

export class UpdateDestinationRateDto extends PartialType(CreateDestinationRateDto) {}
