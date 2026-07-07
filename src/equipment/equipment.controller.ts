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
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentService } from './equipment.service';

@ApiTags('equipment')
@ApiBearerAuth('access-token')
@Controller('equipment')
@UseGuards(AuthGuard)
export class EquipmentController {
  constructor(
    private readonly service: EquipmentService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get(':equipmentId')
  async findOne(
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(companyId, equipmentId);
  }

  @Patch(':equipmentId')
  async update(
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @Req() req: Request,
    @Body() dto: UpdateEquipmentDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    rejectClientFleetStatusMutation(req.body as Record<string, unknown>);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(companyId, equipmentId, dto);
  }

  @Delete(':equipmentId')
  async remove(
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, equipmentId);
  }

  @Post(':equipmentId/maintenance/start')
  async startMaintenance(
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.startMaintenance(companyId, equipmentId);
  }

  @Post(':equipmentId/maintenance/end')
  async endMaintenance(
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.endMaintenance(companyId, equipmentId);
  }

  @Post(':equipmentId/insurance/sync-expenses')
  async syncInsuranceExpenses(
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.syncInsuranceExpenses(companyId, equipmentId);
  }
}
