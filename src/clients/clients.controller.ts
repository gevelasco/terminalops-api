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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { APP_MODULE_CODES } from '../common/constants/app-modules';
import { assertModuleWrite } from '../common/utils/module-permission.util';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('clients')
@ApiBearerAuth('access-token')
@Controller('clients')
@UseGuards(AuthGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get(':clientId')
  @ApiOperation({ summary: 'Get client by id (tenant-scoped)' })
  async findOne(
    @Param('clientId', ParseIntPipe) clientId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.clientsService.findOne(companyId, clientId);
  }

  @Patch(':clientId')
  async update(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: UpdateClientDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.CLIENTS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.clientsService.update(companyId, clientId, dto);
  }

  @Delete(':clientId')
  async remove(
    @Param('clientId', ParseIntPipe) clientId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.clientsService.remove(companyId, clientId);
  }
}
