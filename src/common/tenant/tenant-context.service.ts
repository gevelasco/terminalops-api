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

  async resolveInternalId(companyId: number): Promise<number | null> {
    const row = await this.companiesRepo.findOne({
      where: { id: companyId },
      select: ['id'],
    });
    return row?.id ?? null;
  }

  async assertAccessAndResolve(
    user: AuthUser,
    companyId: number,
  ): Promise<number> {
    assertCompanyAccess(user, companyId);
    const id = await this.resolveInternalId(companyId);
    if (!id) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }
    return id;
  }

  async resolveInternalIdFromAuthUser(user: AuthUser): Promise<number> {
    const companyId = Number(user.companyId);
    if (!Number.isFinite(companyId)) {
      throw new ForbiddenException('Invalid company in session');
    }
    return this.assertAccessAndResolve(user, companyId);
  }
}
