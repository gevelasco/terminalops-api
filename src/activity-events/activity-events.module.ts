import { Global, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushModule } from 'src/push/push.module';
import { CompanyActivityEvent } from './entities/company-activity-event.entity';
import { ActivityEventsService } from './activity-events.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyActivityEvent]),
    forwardRef(() => PushModule),
  ],
  providers: [ActivityEventsService],
  exports: [ActivityEventsService],
})
export class ActivityEventsModule {}
