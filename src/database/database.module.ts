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

import * as mongoose from 'mongoose';

const logger = new Logger('DatabaseModule');

let mongodInstance: MongoMemoryServer | null = null;

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const configuredUri = configService.get<string>('MONGODB_URI');
        let shouldUseConfigured = false;

        if (configuredUri && configuredUri.trim() !== '') {
          try {
            logger.log(`Verifying MongoDB reachability at: ${configuredUri}...`);
            const testConn = await mongoose.createConnection(configuredUri, {
              serverSelectionTimeoutMS: 2000,
            }).asPromise();
            await testConn.close();
            shouldUseConfigured = true;
          } catch (err: any) {
            const isProd = configService.get<string>('NODE_ENV') === 'production';
            if (isProd) {
              logger.error(
                `CRITICAL: Persistent MongoDB connection failed in production mode (${configuredUri}). Failing safe: ${err.message}`,
              );
              throw new Error(
                `Production startup aborted: Configured persistent MongoDB instance is unreachable. Ephemeral database fallback is strictly prohibited in production.`,
              );
            }
            logger.warn(
              `External MongoDB at "${configuredUri}" unreachable in development. Gracefully falling back to embedded MongoMemoryServer...`,
            );
          }
        } else {
          const isProd = configService.get<string>('NODE_ENV') === 'production';
          if (isProd) {
            throw new Error(
              `Production startup aborted: MONGODB_URI environment variable is required in production mode.`,
            );
          }
        }

        if (shouldUseConfigured && configuredUri) {
          logger.log(`Connecting to external MongoDB instance...`);
          return { uri: configuredUri };
        }

        logger.log(`Initializing embedded high-performance MongoDB instance for local development...`);
        if (!mongodInstance) {
          mongodInstance = await MongoMemoryServer.create();
        }
        const memoryUri = mongodInstance.getUri();
        logger.log(`Embedded MongoDB active at: ${memoryUri}`);
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
