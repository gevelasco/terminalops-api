import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import {
  refreshReuseDecision,
  refreshTokenHashMatches,
  type RefreshReuseDecision,
} from './refresh-token.util';

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
  ) {}

  async persist(params: {
    userId: number;
    jti: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.tokens.insert({
      userId: params.userId,
      jti: params.jti,
      tokenHash: params.tokenHash,
      expiresAt: params.expiresAt,
    });
  }

  async inspect(
    jti: string,
    tokenHash: string,
    now: Date = new Date(),
  ): Promise<RefreshReuseDecision | 'invalid'> {
    const row = await this.tokens.findOne({ where: { jti } });
    if (!row || !refreshTokenHashMatches(row.tokenHash, tokenHash)) {
      return 'invalid';
    }
    if (row.expiresAt.getTime() <= now.getTime()) {
      return 'invalid';
    }
    return refreshReuseDecision(row.revokedAt, now);
  }

  async markRotated(jti: string, replacedByJti?: string | null): Promise<void> {
    await this.tokens.update(
      { jti },
      { revokedAt: new Date(), replacedByJti: replacedByJti ?? null },
    );
  }

  async revokeByJti(jti: string): Promise<void> {
    await this.tokens.update(
      { jti, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(userId: number): Promise<void> {
    await this.tokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
