import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  normalizeInvitationCode,
  type InvitationPurpose,
} from '../common/constants/invitation-codes';
import { InvitationCode } from './entities/invitation-code.entity';

@Injectable()
export class InvitationCodesService {
  constructor(
    @InjectRepository(InvitationCode)
    private readonly repo: Repository<InvitationCode>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Reserva atómica del código (one-time / max_uses).
   * Si el alta/upgrade falla después, llamar `release`.
   */
  async consume(
    rawCode: string,
    purpose: InvitationPurpose,
  ): Promise<InvitationCode> {
    const code = normalizeInvitationCode(rawCode);
    if (!code) {
      throw new ForbiddenException('El código de invitación es obligatorio');
    }

    return this.dataSource.transaction(async (manager) => {
      const row = await manager
        .getRepository(InvitationCode)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.code = :code', { code })
        .getOne();

      // Mensaje genérico: no filtrar propósito/plan (anti-enumeración).
      if (!row || !this.isRedeemable(row, purpose)) {
        throw new ForbiddenException('Código de invitación inválido');
      }

      row.usedCount += 1;
      row.redeemedAt = new Date();
      return manager.save(row);
    });
  }

  async attachRedemption(
    inviteId: number,
    companyId: number,
    userId: number,
  ): Promise<void> {
    await this.repo.update(inviteId, {
      redeemedByCompanyId: companyId,
      redeemedByUserId: userId,
    });
  }

  /** Revierte un consume si el flujo de negocio falló después. */
  async release(inviteId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const row = await manager
        .getRepository(InvitationCode)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: inviteId })
        .getOne();
      if (!row || row.usedCount <= 0) {
        return;
      }
      row.usedCount -= 1;
      if (row.usedCount === 0) {
        row.redeemedAt = null;
        row.redeemedByCompanyId = null;
        row.redeemedByUserId = null;
      }
      await manager.save(row);
    });
  }

  private isRedeemable(
    row: InvitationCode,
    purpose: InvitationPurpose,
  ): boolean {
    if (!row.isActive) {
      return false;
    }
    if (row.purpose !== purpose) {
      return false;
    }
    if (row.usedCount >= row.maxUses) {
      return false;
    }
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      return false;
    }
    return true;
  }
}
