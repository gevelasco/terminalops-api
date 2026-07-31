import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AlertService } from './alert.service';
import type { RequestWithContext } from './request-id.middleware';

@Catch()
@Injectable()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly alerts: AlertService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<RequestWithContext>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let body: string | object = { statusCode: status, message };

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      body = { statusCode: status, message };
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      body = exceptionResponse;
      const m = (exceptionResponse as { message?: unknown }).message;
      if (typeof m === 'string') {
        message = m;
      } else if (Array.isArray(m)) {
        message = m.map(String).join('; ');
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const meta = {
      msg: 'http_request',
      requestId: req.requestId ?? null,
      method: req.method,
      path,
      status,
      userId: req.user?.id != null ? String(req.user.id) : null,
      companyId:
        req.user?.companyId != null ? String(req.user.companyId) : null,
      error: message.slice(0, 300),
    };

    if (status >= 500) {
      void this.alerts.notify5xx({
        requestId: meta.requestId,
        method: meta.method,
        path: meta.path,
        status,
        message,
        userId: meta.userId,
        companyId: meta.companyId,
      });
      if (
        body &&
        typeof body === 'object' &&
        !Array.isArray(body) &&
        process.env.NODE_ENV === 'production'
      ) {
        body = {
          statusCode: status,
          message: 'Internal server error',
          requestId: req.requestId ?? undefined,
        };
      }
    } else if (status >= 400 && path !== '/' && path !== '/health') {
      this.logger.warn(JSON.stringify(meta));
    }

    if (!res.headersSent) {
      res.status(status).json(body);
    }
  }
}