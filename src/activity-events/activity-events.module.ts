import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyActivityEvent } from './entities/company-activity-event.entity';
import { ActivityEventsService } from './activity-events.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CompanyActivityEvent])],
  providers: [ActivityEventsService],
  exports: [ActivityEventsService],
})
export class ActivityEventsModule {}
