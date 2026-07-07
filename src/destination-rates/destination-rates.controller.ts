import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { APP_MODULE_CODES } from '../common/constants/app-modules';
import { assertModuleWrite } from '../common/utils/module-permission.util';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { UpdateDestinationRateDto } from './dto/update-destination-rate.dto';
import { DestinationRatesService } from './destination-rates.service';

@ApiTags('destination-rates')
@ApiBearerAuth('access-token')
@Controller('destination-rates')
@UseGuards(AuthGuard)
export class DestinationRatesController {
  constructor(
    private readonly service: DestinationRatesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get(':rateId')
  @ApiOperation({ summary: 'Get destination rate by id (tenant-scoped)' })
  async findOne(
    @Param('rateId', ParseIntPipe) rateId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(companyId, rateId);
  }

  @Patch(':rateId')
  async update(
    @Param('rateId', ParseIntPipe) rateId: number,
    @Body() dto: UpdateDestinationRateDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.CLIENTS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(companyId, rateId, dto);
  }

  @Delete(':rateId')
  async remove(
    @Param('rateId', ParseIntPipe) rateId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, rateId);
  }
}
