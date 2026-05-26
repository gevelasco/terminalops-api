import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { assertCompanyAccess } from '../utils/tenant.util';
import AuthUser from 'src/types/auth-user.type';

@Injectable()
export class TenantContextService {
  constructor(
    @InjectRepository(Company)
    private readonly companiesRepo: Repository<Company>,
  ) {}

  async resolveInternalId(publicId: number): Promise<string | null> {
    const row = await this.companiesRepo.findOne({
      where: { publicId },
      select: ['id'],
    });
    return row?.id ?? null;
  }

  async assertAccessAndResolve(
    user: AuthUser,
    publicCompanyId: number,
  ): Promise<string> {
    assertCompanyAccess(user, publicCompanyId);
    const internalId = await this.resolveInternalId(publicCompanyId);
    if (!internalId) {
      throw new NotFoundException(`Company ${publicCompanyId} not found`);
    }
    return internalId;
  }

  async resolveInternalIdFromAuthUser(user: AuthUser): Promise<string> {
    const publicId = Number(user.companyId);
    if (!Number.isFinite(publicId)) {
      throw new ForbiddenException('Invalid company in session');
    }
    return this.assertAccessAndResolve(user, publicId);
  }
}
