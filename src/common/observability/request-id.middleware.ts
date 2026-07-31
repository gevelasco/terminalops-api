import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithContext = Request & {
  requestId?: string;
  user?: {
    id?: string | number;
    companyId?: string | number;
  };
};

/** Asigna requestId temprano (antes de guards). */
export function requestIdMiddleware(
  req: RequestWithContext,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header('x-request-id')?.trim();
  const requestId =
    incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
