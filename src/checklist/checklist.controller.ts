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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { assertCompanyAccess } from '../common/utils/tenant.util';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { ChecklistService } from './checklist.service';
import { CreateChecklistTodoDto } from './dto/create-checklist-todo.dto';
import { UpdateChecklistTodoDto } from './dto/update-checklist-todo.dto';

@ApiTags('checklist')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/checklist')
@UseGuards(AuthGuard)
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tareas del checklist del usuario actual' })
  async list(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertCompanyAccess(user, companyId);
    return this.checklistService.list(companyId, Number(user.id));
  }

  @Post()
  @ApiOperation({ summary: 'Crear tarea en el checklist del usuario' })
  async create(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateChecklistTodoDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertCompanyAccess(user, companyId);
    return this.checklistService.create(companyId, Number(user.id), dto);
  }

  @Patch(':todoId')
  @ApiOperation({ summary: 'Actualizar tarea del checklist' })
  async update(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('todoId', ParseIntPipe) todoId: number,
    @Body() dto: UpdateChecklistTodoDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertCompanyAccess(user, companyId);
    return this.checklistService.update(
      companyId,
      Number(user.id),
      todoId,
      dto,
    );
  }

  @Delete(':todoId')
  @ApiOperation({ summary: 'Eliminar tarea del checklist' })
  async remove(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('todoId', ParseIntPipe) todoId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertCompanyAccess(user, companyId);
    return this.checklistService.remove(companyId, Number(user.id), todoId);
  }
}
