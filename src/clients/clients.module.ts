import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from 'src/clients/entities/client.entity';
import { ClientBilling } from 'src/clients/entities/client-billing.entity';
import { ClientContact } from 'src/clients/entities/client-contact.entity';
import { ClientDelivery } from 'src/clients/entities/client-delivery.entity';
import { ClientPaymentTerms } from 'src/clients/entities/client-payment-terms.entity';
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
    ]),
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
