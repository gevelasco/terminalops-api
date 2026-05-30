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
import { UpdateOperatorDto } from './dto/update-operator.dto';
import { OperatorsService } from './operators.service';

@ApiTags('operators')
@ApiBearerAuth('access-token')
@Controller('operators')
@UseGuards(AuthGuard)
export class OperatorsController {
  constructor(
    private readonly service: OperatorsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get(':operatorId')
  async findOne(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(companyId, operatorId);
  }

  @Patch(':operatorId')
  async update(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Body() dto: UpdateOperatorDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(companyId, operatorId, dto);
  }

  @Delete(':operatorId')
  async remove(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, operatorId);
  }
}
