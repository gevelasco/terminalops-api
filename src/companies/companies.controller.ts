import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { LoggedUser } from '../decorators/logged-user.decorator';
import { AuthGuard } from '../guards/auth/auth.guard';
import { assertCompanyAccess } from '../common/utils/tenant.util';
import type AuthUser from '../types/auth-user.type';
import { ClientsService } from '../clients/clients.service';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { OperatorsService } from '../operators/operators.service';
import { CreateOperatorDto } from '../operators/dto/create-operator.dto';
import { UnitsService } from '../units/units.service';
import { CreateUnitDto } from '../units/dto/create-unit.dto';
import { EquipmentService } from '../equipment/equipment.service';
import { CreateEquipmentDto } from '../equipment/dto/create-equipment.dto';
import { TripsService } from '../trips/trips.service';
import { CreateTripDto } from '../trips/dto/create-trip.dto';
import { FuelEstimateRequestDto } from '../trips/dto/fuel-estimate.dto';
import { FuelEstimatorService } from '../trips/fuel/fuel-estimator.service';
import { ExpensesService } from '../expenses/expenses.service';
import { CreateExpenseDto } from '../expenses/dto/create-expense.dto';
import { DestinationRatesService } from '../destination-rates/destination-rates.service';
import { CreateDestinationRateDto } from '../destination-rates/dto/create-destination-rate.dto';
import { CheckDestinationRateRouteQueryDto } from '../destination-rates/dto/check-destination-rate-route.dto';
import { OperationConfigurationsService } from '../operation-configurations/operation-configurations.service';
import { CreateOperationConfigurationDto } from '../operation-configurations/dto/create-operation-configuration.dto';
import { OperationalCentersService } from '../operational-centers/operational-centers.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { FleetOverviewService } from '../fleet/fleet-overview.service';
import { FleetBrandsService } from '../fleet/fleet-brands.service';
import { CompaniesService } from './companies.service';
import { UpdateCompanyOperationalSettingsDto } from './dto/update-company-operational-settings.dto';
import { serializeCompanyOperationalSettings } from './company-operational-settings.serializer';



function parseIncludeFleetTenure(value?: string): boolean {
  const v = value?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function parseTripIdsQuery(value?: string): number[] | undefined {
  if (value == null || value.trim() === '') {
    return undefined;
  }
  const ids = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
  return ids;
}

@ApiTags('companies')
@ApiBearerAuth('access-token')
@Controller('companies')
@UseGuards(AuthGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly clientsService: ClientsService,
    private readonly operatorsService: OperatorsService,
    private readonly unitsService: UnitsService,
    private readonly equipmentService: EquipmentService,
    private readonly tripsService: TripsService,
    private readonly fuelEstimator: FuelEstimatorService,
    private readonly expensesService: ExpensesService,
    private readonly destinationRatesService: DestinationRatesService,
    private readonly operationConfigurationsService: OperationConfigurationsService,
    private readonly operationalCentersService: OperationalCentersService,
    private readonly dashboardService: DashboardService,
    private readonly fleetOverviewService: FleetOverviewService,
    private readonly fleetBrandsService: FleetBrandsService,
  ) {}

  @Get(':companyId')
  @ApiOperation({ summary: 'Perfil de empresa (id numérico)' })
  async findOne(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertCompanyAccess(user, companyId);
    const company = await this.companiesService.findOne(companyId);
    const center = await this.operationalCentersService.getDefaultEntity(companyId);
    return serializeCompanyOperationalSettings(company, center.name);
  }

  @Patch(':companyId/settings/operational')
  @ApiOperation({ summary: 'Configuración operativa de la empresa (solo admin)' })
  async updateOperationalSettings(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: UpdateCompanyOperationalSettingsDto,
    @LoggedUser() user: AuthUser,
  ) {
    const company = await this.companiesService.updateOperationalSettings(
      user,
      companyId,
      dto,
    );
    const center = await this.operationalCentersService.getDefaultEntity(companyId);
    return serializeCompanyOperationalSettings(company, center.name);
  }

  @Get(':companyId/clients/:clientId/cargo-history')
  @ApiOperation({ summary: 'Historial de cargas del cliente (desde maniobras)' })
  async getClientCargoHistory(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('clientId') clientId: string,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.tripsService.findClientCargoHistory(tenantId, clientId);
  }

  @Get(':companyId/clients')
  async listClients(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.clientsService.findAll(tenantId);
  }

  @Post(':companyId/clients')
  async createClient(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateClientDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.clientsService.create(tenantId, dto);
  }

  @Get(':companyId/operators')
  async listOperators(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.operatorsService.findAll(tenantId);
  }

  @Post(':companyId/operators')
  async createOperator(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateOperatorDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.operatorsService.create(tenantId, dto);
  }

  @Get(':companyId/units')
  async listUnits(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('includeFleetTenure') includeFleetTenure: string | undefined,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.unitsService.findAll(tenantId, {
      includeTenure: parseIncludeFleetTenure(includeFleetTenure),
    });
  }

  @Post(':companyId/units')
  async createUnit(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateUnitDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.unitsService.create(tenantId, dto);
  }

  @Get(':companyId/equipment')
  async listEquipment(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('includeFleetTenure') includeFleetTenure: string | undefined,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.equipmentService.findAll(tenantId, {
      includeTenure: parseIncludeFleetTenure(includeFleetTenure),
    });
  }

  @Post(':companyId/equipment')
  async createEquipment(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateEquipmentDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.equipmentService.create(tenantId, dto);
  }

  @Get(':companyId/trips/map')
  @ApiOperation({ summary: 'Maniobras activas con coordenadas resueltas para mapa operativo' })
  async listTripsMap(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.tripsService.findForMap(tenantId);
  }

  @Get(':companyId/trips')
  async listTrips(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.tripsService.findAll(tenantId);
  }

  @Post(':companyId/trips')
  async createTrip(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateTripDto,
    @Req() req: Request,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.tripsService.create(tenantId, dto, req.body as Record<string, unknown>);
  }

  @Post(':companyId/trips/fuel-estimate')
  @ApiOperation({ summary: 'Estimación operativa de diesel para nueva maniobra' })
  async estimateTripFuel(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: FuelEstimateRequestDto,
    @LoggedUser() user: AuthUser,
  ) {
    await this.companiesService.assertAccessAndResolve(user, companyId);
    const company = await this.companiesService.findOne(companyId);
    if (!company.dieselControlEnabled) {
      throw new ForbiddenException(
        'El control automático de diesel está desactivado para esta empresa',
      );
    }
    return await this.fuelEstimator.estimate(dto);
  }

  @Get(':companyId/operation-configurations')
  @ApiOperation({ summary: 'Configuraciones operacionales de la empresa' })
  async listOperationConfigurations(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.operationConfigurationsService.findAll(tenantId);
  }

  @Post(':companyId/operation-configurations')
  async createOperationConfiguration(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateOperationConfigurationDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.operationConfigurationsService.create(tenantId, dto);
  }

  @Get(':companyId/operational-centers')
  @ApiOperation({ summary: 'Centros operativos de la empresa' })
  async listOperationalCenters(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.operationalCentersService.findAll(tenantId);
  }

  @Get(':companyId/destination-rates/check-exists')
  @ApiOperation({ summary: 'Verificar si ya existe tarifa para una ruta origen→destino' })
  async checkDestinationRateExists(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: CheckDestinationRateRouteQueryDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.destinationRatesService.checkRouteExists(tenantId, query);
  }

  @Get(':companyId/destination-rates')
  @ApiOperation({ summary: 'Tarifas operativas por destino (CP)' })
  async listDestinationRates(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.destinationRatesService.findAll(tenantId);
  }

  @Post(':companyId/destination-rates')
  async createDestinationRate(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateDestinationRateDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.destinationRatesService.create(tenantId, dto);
  }

  @Get(':companyId/expenses')
  async listExpenses(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.expensesService.findAll(tenantId);
  }

  @Post(':companyId/expenses')
  async createExpense(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateExpenseDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.expensesService.create(tenantId, dto);
  }

  @Get(':companyId/fleet/catalog')
  @ApiOperation({ summary: 'Catálogo de marcas de Flota (unidades y equipos)' })
  async fleetCatalog(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.fleetBrandsService.listCatalog(tenantId);
  }

  @Get(':companyId/fleet/overview')
  @ApiOperation({
    summary: 'Read model UI de Flota (unidades, convoy, maniobras activas, mantenimiento)',
  })
  async fleetOverview(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
    @Query('tripIds') tripIds?: string,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    const parsedTripIds = parseTripIdsQuery(tripIds);
    return this.fleetOverviewService.listOverview(tenantId, parsedTripIds);
  }

  @Get(':companyId/dashboard/alerts')
  async dashboardAlerts(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.dashboardService.listAlerts(tenantId);
  }

  @Get(':companyId/dashboard/critical-alerts')
  async dashboardCriticalAlerts(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.dashboardService.listCriticalAlerts(tenantId);
  }
}
