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
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { UpdateOperationConfigurationDto } from './dto/update-operation-configuration.dto';
import { OperationConfigurationsService } from './operation-configurations.service';

@ApiTags('operation-configurations')
@ApiBearerAuth('access-token')
@Controller('operation-configurations')
@UseGuards(AuthGuard)
export class OperationConfigurationsController {
  constructor(
    private readonly service: OperationConfigurationsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get(':configId')
  @ApiOperation({ summary: 'Get operation configuration by id (tenant-scoped)' })
  async findOne(
    @Param('configId', ParseIntPipe) configId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(companyId, configId);
  }

  @Patch(':configId')
  async update(
    @Param('configId', ParseIntPipe) configId: number,
    @Body() dto: UpdateOperationConfigurationDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(companyId, configId, dto);
  }

  @Delete(':configId')
  async remove(
    @Param('configId', ParseIntPipe) configId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, configId);
  }
}
