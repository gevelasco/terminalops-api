import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { RecordCompanyActivityParams } from 'src/activity-events/activity-events.service';
import type {
  AppModuleCode,
  StaffGrantableModuleCode,
  StaffModuleGrant,
} from 'src/common/constants/app-modules';
import {
  canReadModule,
  resolveStaffModuleGrants,
} from 'src/common/utils/module-permission.util';
import {
  notificationModuleForFeedItem,
  resolveAllowedModulesForAuthUser,
  resolveEffectiveNotificationFeedModules,
} from 'src/notifications/notification-feed-preferences.util';
import type AuthUser from 'src/types/auth-user.type';
import { AppUser } from 'src/users/entities/app-user.entity';
import { UserPushSubscription } from 'src/users/entities/user-push-subscription.entity';
import { buildPushNotificationPath } from './push-notification-url.util';
import { WebPushSenderService } from './web-push-sender.service';

/**
 * Fan-out Push post-`record()`. Nunca debe ser awaited por operaciones de negocio.
 */
@Injectable()
export class ActivityPushFanoutService {
  private readonly logger = new Logger(ActivityPushFanoutService.name);

  constructor(
    private readonly sender: WebPushSenderService,
    @InjectRepository(AppUser)
    private readonly usersRepo: Repository<AppUser>,
    @InjectRepository(UserPushSubscription)
    private readonly subscriptionsRepo: Repository<UserPushSubscription>,
  ) {}

  /** Entrada segura: captura errores y no propaga. */
  scheduleForRecordedActivity(params: RecordCompanyActivityParams): void {
    if (!this.sender.isConfigured()) {
      return;
    }
    setImmediate(() => {
      void this.dispatchForRecordedActivity(params).catch((err: unknown) => {
        this.logger.warn(
          `Fan-out Push omitido: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    });
  }

  async dispatchForRecordedActivity(
    params: RecordCompanyActivityParams,
  ): Promise<{ recipients: number; sent: number; removed: number; failed: number }> {
    if (!this.sender.isConfigured()) {
      return { recipients: 0, sent: 0, removed: 0, failed: 0 };
    }

    const url =
      buildPushNotificationPath({
        kind: params.kind,
        entityType: params.entityType,
        entityId: String(params.entityId),
        title: params.title,
      }) ?? '/';

    const feedItem = {
      kind: params.kind,
      entityType: params.entityType,
    };
    const moduleCode = notificationModuleForFeedItem(feedItem);

    const subscriptions = await this.subscriptionsRepo.find({
      where: { companyId: params.companyId },
    });
    if (subscriptions.length === 0) {
      return { recipients: 0, sent: 0, removed: 0, failed: 0 };
    }

    const userIds = [...new Set(subscriptions.map((s) => s.userId))];
    const users = await this.usersRepo.find({
      where: {
        id: In(userIds),
        companyId: params.companyId,
        status: 'active',
      },
      relations: ['preferences', 'moduleAccess'],
    });

    const eligibleIds = new Set<number>();
    for (const user of users) {
      if (this.userShouldReceive(user, moduleCode, feedItem)) {
        eligibleIds.add(user.id);
      }
    }

    const targets = subscriptions.filter((s) => eligibleIds.has(s.userId));
    if (targets.length === 0) {
      return { recipients: 0, sent: 0, removed: 0, failed: 0 };
    }

    const subject = params.subjectLabel.trim();
    const title = 'TerminalOps';
    const body = subject && subject !== '—'
      ? `${params.title.trim()} · ${subject}`
      : params.title.trim();

    const result = await this.sender.sendToSubscriptions(targets, {
      title,
      body: body || 'Nueva notificación',
      url,
      kind: params.kind,
      entityType: params.entityType,
      entityId: String(params.entityId),
      dedupeKey: params.dedupeKey ?? null,
    });

    return {
      recipients: eligibleIds.size,
      sent: result.sent,
      removed: result.removed,
      failed: result.failed,
    };
  }

  private userShouldReceive(
    user: AppUser,
    moduleCode: string | null,
    feedItem: { kind: string; entityType: string },
  ): boolean {
    const authLike = this.toAuthLike(user);
    const allowed = resolveAllowedModulesForAuthUser(authLike);
    if (
      moduleCode &&
      !canReadModule(
        authLike.role,
        authLike.moduleGrants,
        moduleCode as AppModuleCode,
      )
    ) {
      return false;
    }
    const enabled = resolveEffectiveNotificationFeedModules(
      user.preferences?.notificationFeedModules ?? null,
      allowed,
    );
    const itemModule = notificationModuleForFeedItem(feedItem);
    if (!itemModule) {
      // Sin módulo mapeable: solo admin/superadmin (misma idea que canSeeNotificationItem).
      const role = authLike.role.trim().toLowerCase();
      return role === 'superadmin' || role === 'admin';
    }
    return enabled.has(itemModule);
  }

  private toAuthLike(user: AppUser): AuthUser {
    const rawGrants: StaffModuleGrant[] =
      user.moduleAccess?.map((row) => ({
        module: row.moduleCode as StaffGrantableModuleCode,
        level: row.accessLevel,
      })) ?? [];
    return {
      id: String(user.id),
      name: user.displayName ?? user.username,
      email: user.email ?? '',
      username: user.username,
      role: (user.role as AuthUser['role']) ?? 'staff',
      companyId: String(user.companyId),
      theme: 'light',
      moduleGrants: resolveStaffModuleGrants(rawGrants),
    };
  }
}
