import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DestinationRatesModule } from 'src/destination-rates/destination-rates.module';
import { OperationalCentersModule } from 'src/operational-centers/operational-centers.module';
import { Client } from 'src/clients/entities/client.entity';
import { ClientBilling } from 'src/clients/entities/client-billing.entity';
import { ClientContact } from 'src/clients/entities/client-contact.entity';
import { ClientDelivery } from 'src/clients/entities/client-delivery.entity';
import { ClientPaymentTerms } from 'src/clients/entities/client-payment-terms.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { ClientsBalanceService } from './clients-balance.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      ClientBilling,
      ClientPaymentTerms,
      ClientContact,
      ClientDelivery,
      Trip,
      Expense,
    ]),
    DestinationRatesModule,
    OperationalCentersModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService, ClientsBalanceService],
  exports: [ClientsService, ClientsBalanceService],
})
export class ClientsModule {}
