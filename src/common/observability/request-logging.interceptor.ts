import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { RequestWithContext } from './request-id.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithContext>();
    const res = http.getResponse<Response>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.writeLog(req, res.statusCode, started),
        error: () => {
          /* el ExceptionFilter registra 4xx/5xx con más detalle */
        },
      }),
    );
  }

  private writeLog(
    req: RequestWithContext,
    status: number,
    started: number,
  ): void {
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    // Health checks no llenan logs.
    if (path === '/' || path === '/health') {
      return;
    }
    const user = req.user;
    const line = {
      msg: 'http_request',
      requestId: req.requestId ?? null,
      method: req.method,
      path,
      status,
      durationMs: Date.now() - started,
      userId: user?.id != null ? String(user.id) : null,
      companyId: user?.companyId != null ? String(user.companyId) : null,
    };
    if (status >= 500) {
      this.logger.error(JSON.stringify(line));
    } else if (status >= 400) {
      this.logger.warn(JSON.stringify(line));
    } else {
      this.logger.log(JSON.stringify(line));
    }
  }
}
