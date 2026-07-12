import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { rejectClientFleetStatusMutation } from 'src/fleet/fleet-status-lock.util';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { APP_MODULE_CODES } from '../common/constants/app-modules';
import { assertModuleWrite } from '../common/utils/module-permission.util';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@ApiTags('units')
@ApiBearerAuth('access-token')
@Controller('units')
@UseGuards(AuthGuard)
export class UnitsController {
  constructor(
    private readonly service: UnitsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get(':unitId')
  async findOne(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(companyId, unitId);
  }

  @Patch(':unitId')
  async update(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Req() req: Request,
    @Body() dto: UpdateUnitDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    rejectClientFleetStatusMutation(req.body as Record<string, unknown>);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(companyId, unitId, dto, user);
  }

  @Delete(':unitId')
  async remove(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, unitId);
  }

  @Post(':unitId/maintenance/start')
  async startMaintenance(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.startMaintenance(companyId, unitId);
  }

  @Post(':unitId/maintenance/end')
  async endMaintenance(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.endMaintenance(companyId, unitId);
  }

  @Post(':unitId/insurance/sync-expenses')
  async syncInsuranceExpenses(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.syncInsuranceExpenses(companyId, unitId);
  }
}
