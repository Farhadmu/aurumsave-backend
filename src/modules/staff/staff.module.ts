import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import { Payment, PaymentSchema } from '../../database/schemas/payment.schema';
import { LedgerEntry, LedgerEntrySchema } from '../../database/schemas/ledger-entry.schema';
import { GoldHolding, GoldHoldingSchema } from '../../database/schemas/gold-holding.schema';
import { SupportTicket, SupportTicketSchema } from '../../database/schemas/support-ticket.schema';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: GoldHolding.name, schema: GoldHoldingSchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
    ]),
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
