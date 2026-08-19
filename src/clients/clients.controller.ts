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
  ApiOperation,
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
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { UploadClientDocumentDto } from './dto/upload-client-document.dto';

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
    assertModuleRead(user, APP_MODULE_CODES.CLIENTS);
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
    return this.clientsService.update(companyId, clientId, dto, user);
  }

  @Delete(':clientId')
  async remove(
    @Param('clientId', ParseIntPipe) clientId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.CLIENTS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.clientsService.remove(companyId, clientId);
  }

  @Post(':clientId/documents')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'slot'],
      properties: {
        file: { type: 'string', format: 'binary' },
        slot: {
          type: 'string',
          enum: ['fiscal'],
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', uploadFileMulterOptions))
  async uploadDocument(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Body() dto: UploadClientDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.CLIENTS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.clientsService.uploadDocument(companyId, clientId, dto.slot, file);
  }

  @Get(':clientId/documents/:documentId/download')
  async downloadDocument(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleRead(user, APP_MODULE_CODES.CLIENTS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.clientsService.downloadDocument(companyId, clientId, documentId);
  }

  @Delete(':clientId/documents/:documentId')
  async removeDocument(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.CLIENTS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.clientsService.removeDocument(companyId, clientId, documentId);
  }
}
