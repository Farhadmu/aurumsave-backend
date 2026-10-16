import { Module, Global, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { User, UserSchema } from './schemas/user.schema';
import { CustomerProfile, CustomerProfileSchema } from './schemas/customer-profile.schema';
import { KycApplication, KycApplicationSchema } from './schemas/kyc-application.schema';
import { GoldPrice, GoldPriceSchema } from './schemas/gold-price.schema';
import { Quote, QuoteSchema } from './schemas/quote.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { GoldHolding, GoldHoldingSchema } from './schemas/gold-holding.schema';
import { LedgerEntry, LedgerEntrySchema } from './schemas/ledger-entry.schema';
import { SupportTicket, SupportTicketSchema } from './schemas/support-ticket.schema';
import { SupportMessage, SupportMessageSchema } from './schemas/support-message.schema';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { PlatformSetting, PlatformSettingSchema } from './schemas/platform-setting.schema';

const logger = new Logger('DatabaseModule');

let mongodInstance: MongoMemoryServer | null = null;

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI');
        if (uri && uri.trim() !== '') {
          logger.log(`Connecting to configured MongoDB instance...`);
          return { uri };
        }

        // Automated fallback to MongoMemoryServer for reliable offline/standalone execution
        logger.warn(`No MONGODB_URI detected. Initializing embedded high-performance MongoDB instance...`);
        if (!mongodInstance) {
          mongodInstance = await MongoMemoryServer.create();
        }
        const memoryUri = mongodInstance.getUri();
        logger.log(`Embedded MongoDB initialized at: ${memoryUri}`);
        return {
          uri: memoryUri,
        };
      },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: CustomerProfile.name, schema: CustomerProfileSchema },
      { name: KycApplication.name, schema: KycApplicationSchema },
      { name: GoldPrice.name, schema: GoldPriceSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: GoldHolding.name, schema: GoldHoldingSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: SupportMessage.name, schema: SupportMessageSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: PlatformSetting.name, schema: PlatformSettingSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
