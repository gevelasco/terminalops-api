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
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

function companyPublicIdFromUser(user: AuthUser): number {
  return Number(user.companyId);
}

@ApiTags('expenses')
@ApiBearerAuth('access-token')
@Controller('expenses')
@UseGuards(AuthGuard)
export class ExpensesController {
  constructor(
    private readonly service: ExpensesService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get(':expenseId')
  async findOne(
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(
      companyId,
      expenseId,
      companyPublicIdFromUser(user),
    );
  }

  @Patch(':expenseId')
  async update(
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: UpdateExpenseDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(
      companyId,
      expenseId,
      companyPublicIdFromUser(user),
      dto,
    );
  }

  @Delete(':expenseId')
  async remove(
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, expenseId);
  }
}
