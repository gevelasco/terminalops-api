import {
  Injectable,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { CompaniesService } from 'src/companies/companies.service';

/** Validates :companyId exists and returns the numeric tenant id. */
@Injectable()
export class TenantCompanyPipe implements PipeTransform<number, Promise<number>> {
  constructor(private readonly companiesService: CompaniesService) {}

  async transform(companyId: number): Promise<number> {
    const id = await this.companiesService.resolveInternalId(companyId);
    if (!id) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }
    return id;
  }
}
