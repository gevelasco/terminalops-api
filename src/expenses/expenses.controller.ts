import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { uploadFileMulterOptions } from 'src/common/file/upload-file.multer';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { APP_MODULE_CODES } from '../common/constants/app-modules';
import {
  assertModuleRead,
  assertModuleWrite,
} from '../common/utils/module-permission.util';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { UploadExpenseDocumentDto } from './dto/upload-expense-document.dto';
import { ExpensesService } from './expenses.service';

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
    assertModuleRead(user, APP_MODULE_CODES.EXPENSES);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(companyId, expenseId);
  }

  @Patch(':expenseId')
  async update(
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: UpdateExpenseDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.EXPENSES);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(companyId, expenseId, dto, user);
  }

  @Delete(':expenseId')
  async remove(
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.EXPENSES);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, expenseId, user);
  }

  @Post(':expenseId/documents')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'slot'],
      properties: {
        file: { type: 'string', format: 'binary' },
        slot: {
          type: 'string',
          enum: ['receipt'],
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', uploadFileMulterOptions))
  async uploadDocument(
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: UploadExpenseDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.EXPENSES);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.uploadDocument(companyId, expenseId, dto.slot, file);
  }

  @Get(':expenseId/documents/:documentId/download')
  async downloadDocument(
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleRead(user, APP_MODULE_CODES.EXPENSES);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.downloadDocument(companyId, expenseId, documentId);
  }

  @Delete(':expenseId/documents/:documentId')
  async removeDocument(
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.EXPENSES);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.removeDocument(companyId, expenseId, documentId);
  }
}
