import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
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
import { PlanEnforcementService } from '../common/billing/plan-enforcement.service';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UploadUnitFleetDocumentDto } from './dto/upload-unit-fleet-document.dto';
import { UnitsService } from './units.service';

@ApiTags('units')
@ApiBearerAuth('access-token')
@Controller('units')
@UseGuards(AuthGuard)
export class UnitsController {
  constructor(
    private readonly service: UnitsService,
    private readonly tenantContext: TenantContextService,
    private readonly planEnforcement: PlanEnforcementService,
  ) {}

  @Get(':unitId')
  async findOne(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleRead(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(companyId, unitId);
  }

  @Patch(':unitId')
  async update(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Req() req: Request,
    @Body() dto: UpdateUnitDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    rejectClientFleetStatusMutation(req.body as Record<string, unknown>);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    if (dto.fleetMeta?.trailerTenureMode !== undefined) {
      await this.planEnforcement.assertTenureAllowed(
        companyId,
        dto.fleetMeta.trailerTenureMode,
      );
    }
    return this.service.update(companyId, unitId, dto, user);
  }

  @Delete(':unitId')
  async remove(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, unitId);
  }

  @Post(':unitId/maintenance/start')
  async startMaintenance(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.startMaintenance(companyId, unitId);
  }

  @Post(':unitId/maintenance/end')
  async endMaintenance(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.endMaintenance(companyId, unitId);
  }

  @Post(':unitId/insurance/sync-expenses')
  async syncInsuranceExpenses(
    @Param('unitId', ParseIntPipe) unitId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.syncInsuranceExpenses(companyId, unitId);
  }

  @Post(':unitId/documents')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'documentKind'],
      properties: {
        file: { type: 'string', format: 'binary' },
        documentKind: {
          type: 'string',
          enum: ['maintenance', 'verification', 'policy', 'ownership'],
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Body() dto: UploadUnitFleetDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.uploadDocument(
      companyId,
      unitId,
      dto.documentKind,
      file,
    );
  }

  @Get(':unitId/documents/:documentId/download')
  async downloadDocument(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleRead(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.downloadDocument(companyId, unitId, documentId);
  }

  @Delete(':unitId/documents/:documentId')
  async removeDocument(
    @Param('unitId', ParseIntPipe) unitId: number,
    @Param('documentId', ParseIntPipe) documentId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.removeDocument(companyId, unitId, documentId);
  }
}
