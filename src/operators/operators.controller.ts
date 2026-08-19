import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { uploadFileMulterOptions } from 'src/common/file/upload-file.multer';
import { rejectClientFleetStatusMutation } from 'src/fleet/fleet-status-lock.util';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { APP_MODULE_CODES } from '../common/constants/app-modules';
import {
  assertModuleRead,
  assertModuleWrite,
} from '../common/utils/module-permission.util';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { UpdateOperatorDto } from './dto/update-operator.dto';
import { UploadOperatorDocumentDto } from './dto/upload-operator-document.dto';
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

  @Get(':operatorId/operation-summary')
  async getOperationSummary(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Query('from') periodFrom: string | undefined,
    @Query('to') periodTo: string | undefined,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleRead(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.getOperationSummary(companyId, operatorId, periodFrom, periodTo);
  }

  @Post(':operatorId/trips/:tripId/confirm-payment')
  async confirmTripPayment(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Param('tripId', ParseIntPipe) tripId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.confirmTripPayment(companyId, operatorId, tripId, user);
  }

  @Post(':operatorId/trips/:tripId/revert-payment')
  async revertTripPayment(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Param('tripId', ParseIntPipe) tripId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.revertTripPayment(companyId, operatorId, tripId, user);
  }

  @Post(':operatorId/hr-hold/leave')
  async startLeave(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.startHrHold(companyId, operatorId, 'leave');
  }

  @Post(':operatorId/hr-hold/incapacitated')
  async startIncapacitated(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.startHrHold(companyId, operatorId, 'incapacitated');
  }

  @Post(':operatorId/hr-hold/end')
  async endHrHold(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.endHrHold(companyId, operatorId);
  }

  @Get(':operatorId')
  async findOne(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleRead(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(companyId, operatorId);
  }

  @Patch(':operatorId')
  async update(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Req() req: Request,
    @Body() dto: UpdateOperatorDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.OPERATORS);
    rejectClientFleetStatusMutation(req.body as Record<string, unknown>);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(companyId, operatorId, dto, user);
  }

  @Delete(':operatorId')
  async remove(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, operatorId);
  }

  @Post(':operatorId/documents')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'slot'],
      properties: {
        file: { type: 'string', format: 'binary' },
        slot: {
          type: 'string',
          enum: ['operation', 'insurance'],
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', uploadFileMulterOptions))
  async uploadDocument(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Body() dto: UploadOperatorDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.uploadDocument(companyId, operatorId, dto.slot, file);
  }

  @Get(':operatorId/documents/:documentId/download')
  async downloadDocument(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleRead(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.downloadDocument(companyId, operatorId, documentId);
  }

  @Delete(':operatorId/documents/:documentId')
  async removeDocument(
    @Param('operatorId', ParseIntPipe) operatorId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.OPERATORS);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.removeDocument(companyId, operatorId, documentId);
  }
}
