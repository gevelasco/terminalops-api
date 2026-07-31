import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvitationCode } from './entities/invitation-code.entity';
import { InvitationCodesService } from './invitation-codes.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([InvitationCode])],
  providers: [InvitationCodesService],
  exports: [InvitationCodesService],
})
export class InvitationCodesModule {}
