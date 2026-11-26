import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DeletePushSubscriptionDto,
  UpsertPushSubscriptionDto,
} from './dto/upsert-push-subscription.dto';
import { UserPushSubscription } from './entities/user-push-subscription.entity';

export type PushSubscriptionListItem = {
  id: number;
  endpoint: string;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class PushSubscriptionsService {
  constructor(
    @InjectRepository(UserPushSubscription)
    private readonly repo: Repository<UserPushSubscription>,
    private readonly config: ConfigService,
  ) {}

  getVapidPublicKey(): { publicKey: string } {
    const publicKey = (this.config.get<string>('VAPID_PUBLIC_KEY') ?? '').trim();
    if (!publicKey) {
      throw new ServiceUnavailableException(
        'Las notificaciones push no están configuradas (falta VAPID_PUBLIC_KEY).',
      );
    }
    return { publicKey };
  }

  /** Claves privadas solo para etapas posteriores de envío. */
  getVapidConfigOrNull(): {
    publicKey: string;
    privateKey: string;
    subject: string;
  } | null {
    const publicKey = (this.config.get<string>('VAPID_PUBLIC_KEY') ?? '').trim();
    const privateKey = (this.config.get<string>('VAPID_PRIVATE_KEY') ?? '').trim();
    const subject =
      (this.config.get<string>('VAPID_SUBJECT') ?? '').trim() ||
      'mailto:noreply@terminalops.app';
    if (!publicKey || !privateKey) {
      return null;
    }
    return { publicKey, privateKey, subject };
  }

  async listForUser(userId: number): Promise<{
    count: number;
    subscriptions: PushSubscriptionListItem[];
  }> {
    const rows = await this.repo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
    return {
      count: rows.length,
      subscriptions: rows.map((row) => this.toListItem(row)),
    };
  }

  async upsertForUser(
    userId: number,
    companyId: number,
    dto: UpsertPushSubscriptionDto,
  ): Promise<PushSubscriptionListItem> {
    const endpoint = dto.endpoint.trim();
    const p256dh = dto.keys?.p256dh?.trim() ?? '';
    const auth = dto.keys?.auth?.trim() ?? '';
    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException('Suscripción push incompleta.');
    }

    const existing = await this.repo.findOne({ where: { endpoint } });
    if (existing && existing.userId !== userId) {
      throw new ForbiddenException(
        'Esta suscripción pertenece a otro usuario.',
      );
    }

    const userAgent = dto.userAgent?.trim() || null;
    if (existing) {
      existing.companyId = companyId;
      existing.p256dh = p256dh;
      existing.auth = auth;
      if (userAgent) {
        existing.userAgent = userAgent;
      }
      const saved = await this.repo.save(existing);
      return this.toListItem(saved);
    }

    const created = this.repo.create({
      userId,
      companyId,
      endpoint,
      p256dh,
      auth,
      userAgent,
    });
    const saved = await this.repo.save(created);
    return this.toListItem(saved);
  }

  /**
   * Elimina solo la suscripción del endpoint indicado si pertenece al usuario.
   * No toca otros dispositivos del mismo usuario.
   */
  async deleteForUser(
    userId: number,
    dto: DeletePushSubscriptionDto,
  ): Promise<{ ok: true; removed: boolean }> {
    const endpoint = dto.endpoint.trim();
    if (!endpoint) {
      throw new BadRequestException('Endpoint requerido.');
    }
    const existing = await this.repo.findOne({ where: { endpoint } });
    if (!existing) {
      return { ok: true, removed: false };
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException(
        'Esta suscripción pertenece a otro usuario.',
      );
    }
    await this.repo.delete({ id: existing.id, userId });
    return { ok: true, removed: true };
  }

  async findOwnedOrFail(
    userId: number,
    subscriptionId: number,
  ): Promise<UserPushSubscription> {
    const row = await this.repo.findOne({
      where: { id: subscriptionId, userId },
    });
    if (!row) {
      throw new NotFoundException('Suscripción no encontrada.');
    }
    return row;
  }

  private toListItem(row: UserPushSubscription): PushSubscriptionListItem {
    return {
      id: row.id,
      endpoint: row.endpoint,
      userAgent: row.userAgent ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
