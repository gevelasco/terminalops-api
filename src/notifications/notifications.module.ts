import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { ExpensesModule } from 'src/expenses/expenses.module';
import { Trip } from 'src/trips/entities/trip.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { NotificationsService } from './notifications.service';
import { PaymentReminderScheduler } from './payment-reminder.scheduler';
import { PaymentReminderService } from './payment-reminder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Expense, Company, Unit, Equipment]),
    ExpensesModule,
  ],
  providers: [
    NotificationsService,
    PaymentReminderService,
    PaymentReminderScheduler,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
