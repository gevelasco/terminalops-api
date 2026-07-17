import {
  BadRequestException,
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
import { APP_MODULE_CODES } from '../common/constants/app-modules';
import { assertModuleRead, assertModuleWrite } from '../common/utils/module-permission.util';
import type AuthUser from '../types/auth-user.type';
import { ClientsService } from '../clients/clients.service';
import { ClientsBalanceService } from '../clients/clients-balance.service';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { OperatorsService } from '../operators/operators.service';
import { CreateOperatorDto } from '../operators/dto/create-operator.dto';
import { UnitsService } from '../units/units.service';
import { CreateUnitDto } from '../units/dto/create-unit.dto';
import { EquipmentService } from '../equipment/equipment.service';
import { CreateEquipmentDto } from '../equipment/dto/create-equipment.dto';
import { parseAvailableQuery } from '../fleet/fleet-available-list.util';
import { rejectClientFleetStatusMutation } from '../fleet/fleet-status-lock.util';
import { rejectClientTripStatusMutation } from '../trips/trip-status-lock.util';
import { TripsService } from '../trips/trips.service';
import { CreateTripDto } from '../trips/dto/create-trip.dto';
import { ListTripLinkOptionsQueryDto } from '../trips/dto/list-trip-link-options-query.dto';
import { ListResourceLinkOptionsQueryDto } from '../common/dto/list-resource-link-options-query.dto';
import { ListTripsQueryDto } from '../trips/dto/list-trips-query.dto';
import { FuelEstimateRequestDto } from '../trips/dto/fuel-estimate.dto';
import { FuelEstimatorService } from '../trips/fuel/fuel-estimator.service';
import { ExpensesService } from '../expenses/expenses.service';
import { CreateExpenseDto } from '../expenses/dto/create-expense.dto';
import { ListExpensesQueryDto } from '../expenses/dto/list-expenses-query.dto';
import { ExpensesCalendarQueryDto } from '../expenses/dto/expenses-calendar-query.dto';
import { DestinationRatesService } from '../destination-rates/destination-rates.service';
import { CreateDestinationRateDto } from '../destination-rates/dto/create-destination-rate.dto';
import { CheckDestinationRateRouteQueryDto } from '../destination-rates/dto/check-destination-rate-route.dto';
import { MatchDestinationRateQueryDto } from '../destination-rates/dto/match-destination-rate-query.dto';
import { OperationConfigurationsService } from '../operation-configurations/operation-configurations.service';
import { CreateOperationConfigurationDto } from '../operation-configurations/dto/create-operation-configuration.dto';
import { OperationalCentersService } from '../operational-centers/operational-centers.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { ReportsGeneralQueryDto } from '../reports/dto/reports-general-query.dto';
import { ReportsService } from '../reports/reports.service';
import { FleetOverviewService } from '../fleet/fleet-overview.service';
import { FleetBrandsService } from '../fleet/fleet-brands.service';
import { CompaniesService } from './companies.service';
import { UpdateCompanyOperationalSettingsDto } from './dto/update-company-operational-settings.dto';
import { UpdateCompanyAccountDto } from './dto/update-company-account.dto';
import { UpdateCompanyDieselReferencePriceDto } from './dto/update-company-diesel-reference-price.dto';
import { FuelPriceService } from '../fuel/fuel-price.service';
import { serializeCompanyOperationalSettings } from './company-operational-settings.serializer';
import { UsersService } from '../users/users.service';
import { CreateCompanyUserDto } from '../users/dto/create-company-user.dto';
import { UpdateCompanyUserDto } from '../users/dto/update-company-user.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsQueryDto } from '../notifications/dto/notifications-query.dto';



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
    private readonly clientsBalanceService: ClientsBalanceService,
    private readonly operatorsService: OperatorsService,
    private readonly unitsService: UnitsService,
    private readonly equipmentService: EquipmentService,
    private readonly tripsService: TripsService,
    private readonly fuelEstimator: FuelEstimatorService,
    private readonly fuelPriceService: FuelPriceService,
    private readonly expensesService: ExpensesService,
    private readonly destinationRatesService: DestinationRatesService,
    private readonly operationConfigurationsService: OperationConfigurationsService,
    private readonly operationalCentersService: OperationalCentersService,
    private readonly dashboardService: DashboardService,
    private readonly reportsService: ReportsService,
    private readonly fleetOverviewService: FleetOverviewService,
    private readonly fleetBrandsService: FleetBrandsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
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
    return serializeCompanyOperationalSettings(company, center);
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
    return serializeCompanyOperationalSettings(company, center);
  }

  @Patch(':companyId/settings/diesel-reference-price')
  @ApiOperation({
    summary: 'Precio de referencia de diésel de la empresa (solo admin)',
  })
  async updateDieselReferencePrice(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: UpdateCompanyDieselReferencePriceDto,
    @LoggedUser() user: AuthUser,
  ) {
    const company = await this.companiesService.updateDieselReferencePrice(
      user,
      companyId,
      dto.pricePerLiter,
    );
    return this.fuelPriceService.resolveDieselForCompany(company);
  }

  @Get(':companyId/clients/picker')
  @ApiOperation({ summary: 'Clientes ligeros para filtros y selects (id + nombre)' })
  async listClientPickerOptions(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.clientsService.findPickerOptions(tenantId);
  }

  @Get(':companyId/clients/balance-overview')
  @ApiOperation({ summary: 'Balance comercial agregado por cliente' })
  async getClientsBalanceOverview(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.clientsBalanceService.getBalanceOverview(tenantId);
  }

  @Get(':companyId/clients/:clientId/balance')
  @ApiOperation({ summary: 'Balance comercial y cartera de un cliente' })
  async getClientBalance(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('clientId') clientId: string,
    @Query('from') periodFrom: string | undefined,
    @Query('to') periodTo: string | undefined,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.clientsBalanceService.getClientBalance(
      tenantId,
      clientId,
      periodFrom,
      periodTo,
    );
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
    assertModuleWrite(user, APP_MODULE_CODES.CLIENTS);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.clientsService.create(tenantId, dto, user);
  }

  @Get(':companyId/operators/link-options')
  @ApiOperation({
    summary: 'Operadores ligeros para vincular (nombre, estatus)',
  })
  async listOperatorLinkOptions(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: ListResourceLinkOptionsQueryDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.operatorsService.findLinkOptions(tenantId, query);
  }

  @Get(':companyId/operators')
  async listOperators(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('available') available: string | undefined,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.operatorsService.findAll(tenantId, {
      available: parseAvailableQuery(available),
    });
  }

  @Post(':companyId/operators')
  async createOperator(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Req() req: Request,
    @Body() dto: CreateOperatorDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.OPERATORS);
    rejectClientFleetStatusMutation(req.body as Record<string, unknown>);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.operatorsService.create(tenantId, dto);
  }

  @Get(':companyId/units/link-options')
  @ApiOperation({
    summary: 'Unidades ligeras para vincular (código operativo, estatus)',
  })
  async listUnitLinkOptions(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: ListResourceLinkOptionsQueryDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.unitsService.findLinkOptions(tenantId, query);
  }

  @Get(':companyId/units')
  async listUnits(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query('includeFleetTenure') includeFleetTenure: string | undefined,
    @Query('available') available: string | undefined,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.unitsService.findAll(tenantId, {
      includeTenure: parseIncludeFleetTenure(includeFleetTenure),
      available: parseAvailableQuery(available),
    });
  }

  @Post(':companyId/units')
  async createUnit(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Req() req: Request,
    @Body() dto: CreateUnitDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    rejectClientFleetStatusMutation(req.body as Record<string, unknown>);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.unitsService.create(tenantId, dto, user);
  }

  @Get(':companyId/equipment/link-options')
  @ApiOperation({
    summary: 'Equipos ligeros para vincular (código operativo, estatus)',
  })
  async listEquipmentLinkOptions(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: ListResourceLinkOptionsQueryDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.equipmentService.findLinkOptions(tenantId, query);
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
    @Req() req: Request,
    @Body() dto: CreateEquipmentDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.FLEET);
    rejectClientFleetStatusMutation(req.body as Record<string, unknown>);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.equipmentService.create(tenantId, dto, user);
  }

  @Get(':companyId/trips/link-options')
  @ApiOperation({
    summary: 'Maniobras ligeras para vincular (código, estatus, fecha)',
  })
  async listTripLinkOptions(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: ListTripLinkOptionsQueryDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.tripsService.findLinkOptions(tenantId, query);
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
    @Query() query: ListTripsQueryDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.tripsService.findAll(tenantId, query);
  }

  @Post(':companyId/trips')
  async createTrip(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateTripDto,
    @Req() req: Request,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.TRIPS);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    rejectClientTripStatusMutation(req.body as Record<string, unknown>);
    return this.tripsService.create(tenantId, dto, req.body as Record<string, unknown>);
  }

  @Post(':companyId/trips/fuel-estimate')
  @ApiOperation({ summary: 'Estimación operativa de diesel para nueva maniobra' })
  async estimateTripFuel(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: FuelEstimateRequestDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.TRIPS);
    await this.companiesService.assertAccessAndResolve(user, companyId);
    const company = await this.companiesService.findOne(companyId);
    if (!company.dieselControlEnabled) {
      throw new ForbiddenException(
        'El control automático de diesel está desactivado para esta empresa',
      );
    }
    const diesel = await this.fuelPriceService.resolveDieselForCompany(company);
    const dieselPricePerLiter = diesel.pricePerLiter ?? undefined;
    return await this.fuelEstimator.estimate(dto, { dieselPricePerLiter });
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
    assertModuleWrite(user, APP_MODULE_CODES.CLIENTS);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.operationConfigurationsService.create(tenantId, dto);
  }

  @Get(':companyId/operational-centers')
  @ApiOperation({
    summary:
      'Centros operativos de la empresa y precio de referencia de diésel vigente',
  })
  async listOperationalCenters(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    const [centers, company] = await Promise.all([
      this.operationalCentersService.findAll(tenantId),
      this.companiesService.findOne(companyId),
    ]);
    const dieselReferencePrice =
      await this.fuelPriceService.resolveDieselForCompany(company);
    return { centers, dieselReferencePrice };
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

  @Get(':companyId/destination-rates/match')
  @ApiOperation({
    summary: 'Match de tarifa aplicable a una maniobra (origen + CP + localidad)',
  })
  async matchDestinationRate(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: MatchDestinationRateQueryDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.destinationRatesService.matchManeuverRate(tenantId, query);
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
    assertModuleWrite(user, APP_MODULE_CODES.CLIENTS);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.destinationRatesService.create(tenantId, dto);
  }

  @Get(':companyId/expenses/calendar')
  async expensesCalendar(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: ExpensesCalendarQueryDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.expensesService.getCalendar(tenantId, query);
  }

  @Get(':companyId/expenses')
  async listExpenses(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: ListExpensesQueryDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.expensesService.findAll(tenantId, query);
  }

  @Post(':companyId/expenses')
  async createExpense(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateExpenseDto,
    @LoggedUser() user: AuthUser,
  ) {
    assertModuleWrite(user, APP_MODULE_CODES.EXPENSES);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.expensesService.create(tenantId, dto, user);
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

  @Get(':companyId/notifications')
  @ApiOperation({
    summary:
      'Feed de notificaciones por empresa (eventos + vencimientos calculados)',
  })
  async notificationsFeed(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: NotificationsQueryDto,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.notificationsService.getFeed(tenantId, query);
  }

  @Get(':companyId/dashboard/summary')
  @ApiOperation({
    summary:
      'Resumen operativo del día (estatus en vivo + día calendario MX)',
  })
  async dashboardSummary(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.dashboardService.getSummary(tenantId);
  }

  @Get(':companyId/dashboard/insights')
  @ApiOperation({
    summary:
      'Widgets del dashboard (flujo 30 días, destinos, recientes, mix operativo)',
  })
  async dashboardInsights(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.dashboardService.getInsights(tenantId);
  }

  @Get(':companyId/reports/balance')
  @ApiOperation({
    summary: 'Reporte Balance (cobros, cartera, gastos y obligaciones del periodo)',
  })
  async reportsBalance(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
    @Query() query: ReportsGeneralQueryDto,
  ) {
    assertModuleRead(user, APP_MODULE_CODES.REPORTS);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.reportsService.getBalance(tenantId, query);
  }

  @Get(':companyId/reports/maniobras')
  @ApiOperation({
    summary: 'Reporte Maniobras (KPIs operativos + gráficas del periodo filtrado)',
  })
  async reportsManiobras(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
    @Query() query: ReportsGeneralQueryDto,
  ) {
    assertModuleRead(user, APP_MODULE_CODES.REPORTS);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.reportsService.getManiobras(tenantId, query);
  }

  @Get(':companyId/reports/fleet')
  @ApiOperation({
    summary: 'Reporte Flota (estado, cumplimiento, actividad y gastos del periodo)',
  })
  async reportsFleet(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
    @Query() query: ReportsGeneralQueryDto,
  ) {
    assertModuleRead(user, APP_MODULE_CODES.REPORTS);
    const tenantId = await this.companiesService.assertAccessAndResolve(
      user,
      companyId,
    );
    return this.reportsService.getFleet(tenantId, query);
  }

  @Get(':companyId/account')
  @ApiOperation({ summary: 'Información de licencia y facturación (propietario)' })
  async companyAccount(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    await this.companiesService.assertAccessAndResolve(user, companyId);
    return this.usersService.getCompanyAccount(companyId, user);
  }

  @Patch(':companyId/account')
  @ApiOperation({ summary: 'Actualizar nombre / leyenda de empresa' })
  async updateCompanyAccount(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: UpdateCompanyAccountDto,
    @LoggedUser() user: AuthUser,
  ) {
    await this.companiesService.assertAccessAndResolve(user, companyId);
    await this.companiesService.updateAccountInfo(user, companyId, dto);
    return this.usersService.getCompanyAccount(companyId, user);
  }

  @Get(':companyId/users')
  @ApiOperation({ summary: 'Usuarios de la empresa' })
  async companyUsers(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    await this.companiesService.assertAccessAndResolve(user, companyId);
    return this.usersService.listCompanyUsers(companyId, user);
  }

  @Post(':companyId/users')
  @ApiOperation({ summary: 'Crear usuario de empresa' })
  async createCompanyUser(
    @Param('companyId', ParseIntPipe) companyId: number,
    @LoggedUser() user: AuthUser,
    @Body() dto: CreateCompanyUserDto,
  ) {
    await this.companiesService.assertAccessAndResolve(user, companyId);
    return this.usersService.createCompanyUser(companyId, user, dto);
  }

  @Patch(':companyId/users/:userId')
  @ApiOperation({ summary: 'Actualizar usuario de empresa' })
  async updateCompanyUser(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @LoggedUser() user: AuthUser,
    @Body() dto: UpdateCompanyUserDto,
  ) {
    await this.companiesService.assertAccessAndResolve(user, companyId);
    return this.usersService.updateCompanyUser(companyId, userId, user, dto);
  }
}
