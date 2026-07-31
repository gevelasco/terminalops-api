import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import EnvConfig from '../../types/env-config.type';

export type Alert5xxPayload = {
  requestId?: string | null;
  method?: string;
  path?: string;
  status: number;
  message: string;
  userId?: string | null;
  companyId?: string | null;
};

/**
 * Alerta 5xx vía webhook (Slack incoming / Discord / generic JSON POST).
 * Si `ALERT_WEBHOOK_URL` no está definido, solo deja rastro en logs.
 */
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private lastSentAt = 0;
  private readonly minIntervalMs = 15_000;

  constructor(private readonly config: ConfigService<EnvConfig>) {}

  async notify5xx(payload: Alert5xxPayload): Promise<void> {
    const url = this.config.get('ALERT_WEBHOOK_URL', { infer: true })?.trim();
    const line = {
      msg: 'http_5xx',
      ...payload,
      at: new Date().toISOString(),
    };
    this.logger.error(JSON.stringify(line));

    if (!url) {
      return;
    }

    const now = Date.now();
    if (now - this.lastSentAt < this.minIntervalMs) {
      return;
    }
    this.lastSentAt = now;

    const text =
      `🚨 TerminalOps API ${payload.status}\n` +
      `${payload.method ?? '?'} ${payload.path ?? '?'}\n` +
      `companyId=${payload.companyId ?? '—'} userId=${payload.userId ?? '—'}\n` +
      `requestId=${payload.requestId ?? '—'}\n` +
      `${payload.message.slice(0, 300)}`;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          content: text,
          ...line,
        }),
      });
    } catch (err) {
      this.logger.warn(
        `No se pudo enviar alerta webhook: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
