import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import {
  APP_MODULE_CODES,
  isAdminRole,
} from '../common/constants/app-modules';
import {
  assertModuleRead,
  assertModuleWrite,
} from '../common/utils/module-permission.util';
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
    assertModuleRead(user, APP_MODULE_CODES.DESTINATION_RATES);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(companyId, rateId);
  }

  @Patch(':rateId')
  async update(
    @Param('rateId', ParseIntPipe) rateId: number,
    @Body() dto: UpdateDestinationRateDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.DESTINATION_RATES);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(companyId, rateId, dto);
  }

  @Delete(':rateId')
  @ApiOperation({ summary: 'Eliminar tarifa (solo administrador)' })
  async remove(
    @Param('rateId', ParseIntPipe) rateId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.DESTINATION_RATES);
    if (!isAdminRole(user.role)) {
      throw new ForbiddenException('Solo un administrador puede eliminar tarifas.');
    }
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, rateId);
  }
}
