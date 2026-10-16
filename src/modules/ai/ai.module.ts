import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { RiskEngineService } from './risk-engine.service';
import { FinancialIntelligenceService } from './financial-intelligence.service';
import { StaffCopilotService } from './staff-copilot.service';

import { Order, OrderSchema } from '../../database/schemas/order.schema';
import { Payment, PaymentSchema } from '../../database/schemas/payment.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { LedgerEntry, LedgerEntrySchema } from '../../database/schemas/ledger-entry.schema';
import { GoldHolding, GoldHoldingSchema } from '../../database/schemas/gold-holding.schema';
import { KycApplication, KycApplicationSchema } from '../../database/schemas/kyc-application.schema';
import { SupportTicket, SupportTicketSchema } from '../../database/schemas/support-ticket.schema';
import { SupportMessage, SupportMessageSchema } from '../../database/schemas/support-message.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: User.name, schema: UserSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: GoldHolding.name, schema: GoldHoldingSchema },
      { name: KycApplication.name, schema: KycApplicationSchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: SupportMessage.name, schema: SupportMessageSchema },
    ]),
  ],
  controllers: [AiController],
  providers: [
    AiService,
    RiskEngineService,
    FinancialIntelligenceService,
    StaffCopilotService,
  ],
  exports: [
    AiService,
    RiskEngineService,
    FinancialIntelligenceService,
    StaffCopilotService,
  ],
})
export class AiModule {}
