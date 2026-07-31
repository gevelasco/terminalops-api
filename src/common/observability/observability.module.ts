import { Global, Module } from '@nestjs/common';
import { AlertService } from './alert.service';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

@Global()
@Module({
  providers: [AlertService, AllExceptionsFilter, RequestLoggingInterceptor],
  exports: [AlertService, AllExceptionsFilter, RequestLoggingInterceptor],
})
export class ObservabilityModule {}
