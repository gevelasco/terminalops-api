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
    @Body() dto: UpdateUnitDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(companyId, unitId, dto);
  }

  @Delete(':unitId')
  async remove(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, unitId);
  }
}
