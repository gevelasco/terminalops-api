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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TenantContextService } from '../common/tenant/tenant-context.service';
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
    @Body() dto: UpdateEquipmentDto,
    @LoggedUser() user: AuthUser,
  ) {
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
}
