import {
  Injectable,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { CompaniesService } from 'src/companies/companies.service';

/** Resuelve :companyId numérico (public_id) al UUID interno del tenant. */
@Injectable()
export class TenantCompanyPipe implements PipeTransform<number, Promise<string>> {
  constructor(private readonly companiesService: CompaniesService) {}

  async transform(publicId: number): Promise<string> {
    const internalId = await this.companiesService.resolveInternalId(publicId);
    if (!internalId) {
      throw new NotFoundException(`Company ${publicId} not found`);
    }
    return internalId;
  }
}
