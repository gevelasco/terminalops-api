import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { ExpensesService } from '../expenses/expenses.service';
import { CreateExpenseDto } from '../expenses/dto/create-expense.dto';
import { DashboardService } from '../dashboard/dashboard.service';
import { CompaniesService } from './companies.service';
import { UpdateCompanyOperationalSettingsDto } from './dto/update-company-operational-settings.dto';
import { serializeCompanyOperationalSettings } from './company-operational-settings.serializer';

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
    private readonly expensesService: ExpensesService,
    private readonly dashboardService: DashboardService,
  ) {}

  @Get(':companyId')
  @ApiOperation({ summary: 'Perfil de empresa (id numérico público)' })
  async findOne(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    assertCompanyAccess(user, publicCompanyId);
    const company = await this.companiesService.findByPublicId(publicCompanyId);
    return serializeCompanyOperationalSettings(company);
  }

  @Patch(':companyId/settings/operational')
  @ApiOperation({ summary: 'Configuración operativa de la empresa (solo admin)' })
  async updateOperationalSettings(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @Body() dto: UpdateCompanyOperationalSettingsDto,
    @LoggedUser() user: AuthUser,
  ) {
    const company = await this.companiesService.updateOperationalSettings(
      user,
      publicCompanyId,
      dto,
    );
    return serializeCompanyOperationalSettings(company);
  }

  @Get(':companyId/clients')
  async listClients(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.clientsService.findAll(companyId, publicCompanyId);
  }

  @Post(':companyId/clients')
  async createClient(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @Body() dto: CreateClientDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.clientsService.create(companyId, publicCompanyId, dto);
  }

  @Get(':companyId/operators')
  async listOperators(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.operatorsService.findAll(companyId, publicCompanyId);
  }

  @Post(':companyId/operators')
  async createOperator(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @Body() dto: CreateOperatorDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.operatorsService.create(companyId, publicCompanyId, dto);
  }

  @Get(':companyId/units')
  async listUnits(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.unitsService.findAll(companyId, publicCompanyId);
  }

  @Post(':companyId/units')
  async createUnit(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @Body() dto: CreateUnitDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.unitsService.create(companyId, publicCompanyId, dto);
  }

  @Get(':companyId/equipment')
  async listEquipment(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.equipmentService.findAll(companyId, publicCompanyId);
  }

  @Post(':companyId/equipment')
  async createEquipment(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @Body() dto: CreateEquipmentDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.equipmentService.create(companyId, publicCompanyId, dto);
  }

  @Get(':companyId/trips')
  async listTrips(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.tripsService.findAll(companyId, publicCompanyId);
  }

  @Post(':companyId/trips')
  async createTrip(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @Body() dto: CreateTripDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.tripsService.create(companyId, publicCompanyId, dto);
  }

  @Get(':companyId/expenses')
  async listExpenses(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.expensesService.findAll(companyId, publicCompanyId);
  }

  @Post(':companyId/expenses')
  async createExpense(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @Body() dto: CreateExpenseDto,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.expensesService.create(companyId, publicCompanyId, dto);
  }

  @Get(':companyId/dashboard/alerts')
  async dashboardAlerts(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.dashboardService.listAlerts(companyId);
  }

  @Get(':companyId/dashboard/critical-alerts')
  async dashboardCriticalAlerts(
    @Param('companyId', ParseIntPipe) publicCompanyId: number,
    @LoggedUser() user: AuthUser,
  ) {
    const companyId = await this.companiesService.assertAccessAndResolve(
      user,
      publicCompanyId,
    );
    return this.dashboardService.listCriticalAlerts(companyId);
  }
}
