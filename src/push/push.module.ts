import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppUser } from 'src/users/entities/app-user.entity';
import { UserPushSubscription } from 'src/users/entities/user-push-subscription.entity';
import { ActivityPushFanoutService } from './activity-push-fanout.service';
import { WebPushSenderService } from './web-push-sender.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AppUser, UserPushSubscription])],
  providers: [WebPushSenderService, ActivityPushFanoutService],
  exports: [WebPushSenderService, ActivityPushFanoutService],
})
export class PushModule {}
