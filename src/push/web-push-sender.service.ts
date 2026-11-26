import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UserPushSubscription } from 'src/users/entities/user-push-subscription.entity';

/** Carga CJS-compatible (web-push 4.x es ESM en algunos installs). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');

export type WebPushPayload = {
  title: string;
  body: string;
  url: string;
  kind: string;
  entityType: string;
  entityId: string;
  dedupeKey?: string | null;
};

@Injectable()
export class WebPushSenderService implements OnModuleInit {
  private readonly logger = new Logger(WebPushSenderService.name);
  private configured = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(UserPushSubscription)
    private readonly subscriptions: Repository<UserPushSubscription>,
  ) {}

  onModuleInit(): void {
    const publicKey = (this.config.get<string>('VAPID_PUBLIC_KEY') ?? '').trim();
    const privateKey = (this.config.get<string>('VAPID_PRIVATE_KEY') ?? '').trim();
    const subject =
      (this.config.get<string>('VAPID_SUBJECT') ?? '').trim() ||
      'mailto:noreply@terminalops.app';
    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID no configurado: el envío Push quedará deshabilitado.',
      );
      this.configured = false;
      return;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async sendToSubscriptions(
    rows: UserPushSubscription[],
    payload: WebPushPayload,
  ): Promise<{ sent: number; removed: number; failed: number }> {
    if (!this.configured || rows.length === 0) {
      return { sent: 0, removed: 0, failed: 0 };
    }

    const body = JSON.stringify({
      notification: {
        title: payload.title,
        body: payload.body,
        icon: '/icons/pwa/icon-192.png',
        badge: '/icons/pwa/icon-192.png',
        data: {
          onActionClick: {
            default: {
              operation: 'navigateLastFocusedOrOpen',
              url: payload.url,
            },
          },
          url: payload.url,
          kind: payload.kind,
          entityType: payload.entityType,
          entityId: payload.entityId,
          dedupeKey: payload.dedupeKey ?? null,
        },
      },
    });

    let sent = 0;
    let removed = 0;
    let failed = 0;
    const staleIds: number[] = [];

    await Promise.all(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            body,
            { TTL: 60 * 60 },
          );
          sent += 1;
        } catch (err: unknown) {
          const status = readPushStatusCode(err);
          if (status === 404 || status === 410) {
            staleIds.push(row.id);
            removed += 1;
            return;
          }
          failed += 1;
          this.logger.warn(
            `Push falló (user=${row.userId}, status=${status ?? 'n/a'}): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }),
    );

    if (staleIds.length > 0) {
      await this.subscriptions.delete({ id: In(staleIds) });
    }

    return { sent, removed, failed };
  }
}

function readPushStatusCode(err: unknown): number | null {
  if (!err || typeof err !== 'object') {
    return null;
  }
  const statusCode = (err as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : null;
}
