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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import type AuthUser from '../types/auth-user.type';
import { AddIncidentDto } from './dto/add-incident.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { UpdateActualScheduleDto } from './dto/update-actual-schedule.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { TripsService } from './trips.service';

@ApiTags('trips')
@ApiBearerAuth('access-token')
@Controller('trips')
@UseGuards(AuthGuard)
export class TripsController {
  constructor(
    private readonly service: TripsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get(':tripId')
  async findOne(
    @Param('tripId', ParseIntPipe) tripId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.findOne(companyId, tripId);
  }

  @Patch(':tripId')
  async update(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() dto: UpdateTripDto,
    @Req() req: Request,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.update(companyId, tripId, dto, req.body as Record<string, unknown>);
  }

  @Post(':tripId/cancel')
  @ApiOperation({ summary: 'Cancel maniobra' })
  async cancel(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() dto: CancelTripDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.cancel(companyId, tripId, dto);
  }

  @Post(':tripId/incidents')
  async addIncident(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() dto: AddIncidentDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.addIncident(companyId, tripId, dto);
  }

  @Patch(':tripId/actual-schedule')
  @ApiOperation({ summary: 'Update actual schedule dates for in-transit maniobra' })
  async updateActualSchedule(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body() dto: UpdateActualScheduleDto,
    @Req() req: Request,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.updateActualSchedule(
      companyId,
      tripId,
      dto,
      req.body as Record<string, unknown>,
      user,
    );
  }

  @Patch(':tripId/client-collected')
  async setClientCollected(
    @Param('tripId', ParseIntPipe) tripId: number,
    @Body('collected') collected: boolean,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.setClientCollected(companyId, tripId, collected);
  }

  @Delete(':tripId')
  async remove(
    @Param('tripId', ParseIntPipe) tripId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.tenantContext.resolveInternalIdFromAuthUser(user);
    return this.service.remove(companyId, tripId);
  }
}
