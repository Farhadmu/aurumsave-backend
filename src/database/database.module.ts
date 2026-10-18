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
import { SavingsGoal, SavingsGoalSchema } from './schemas/savings-goal.schema';
import { DualApprovalRequest, DualApprovalRequestSchema } from './schemas/dual-approval.schema';
import { Supplier, SupplierSchema } from './schemas/supplier.schema';
import { VaultCustodyRecord, VaultCustodyRecordSchema } from './schemas/vault-custody.schema';
import { PurchaseOrder, PurchaseOrderSchema } from './schemas/purchase-order.schema';
import { CmsContent, CmsContentSchema } from './schemas/cms-content.schema';
import { OfficialProduct, OfficialProductSchema } from './schemas/official-product.schema';
import { MarketplaceListing, MarketplaceListingSchema } from './schemas/marketplace-listing.schema';
import { PickupPoint, PickupPointSchema } from './schemas/pickup-point.schema';
import { CommerceOrder, CommerceOrderSchema } from './schemas/commerce-order.schema';
import { JewellerySellRequest, JewellerySellRequestSchema } from './schemas/jewellery-sell-request.schema';

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
        const isRender = !!process.env.RENDER;
        const isProd = configService.get<string>('NODE_ENV') === 'production' || isRender;

        if (configuredUri && configuredUri.trim() !== '') {
          // Normalize and mask URI for safe logging
          const maskedUri = configuredUri.replace(/:([^:@]+)@/, ':****@');
          logger.log(`Configuring persistent MongoDB connection to: ${maskedUri}`);

          return {
            uri: configuredUri,
            dbName: 'aurumsave',
            serverSelectionTimeoutMS: 30000,
            connectTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            retryWrites: true,
            w: 'majority' as const,
          };
        }

        if (isProd) {
          throw new Error(
            'Production startup aborted: MONGODB_URI environment variable is required in production or Render environments.',
          );
        }

        // Local development offline fallback
        logger.log('No MONGODB_URI supplied. Initializing embedded MongoDB instance for local development...');
        if (!mongodInstance) {
          mongodInstance = await MongoMemoryServer.create({
            binary: {
              version: '7.0.14',
            },
          });
        }
        const memoryUri = mongodInstance.getUri();
        logger.log(`Embedded MongoDB active at: ${memoryUri}`);
        return {
          uri: memoryUri,
          dbName: 'aurumsave',
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
      { name: SavingsGoal.name, schema: SavingsGoalSchema },
      { name: DualApprovalRequest.name, schema: DualApprovalRequestSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: VaultCustodyRecord.name, schema: VaultCustodyRecordSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: CmsContent.name, schema: CmsContentSchema },
      { name: OfficialProduct.name, schema: OfficialProductSchema },
      { name: MarketplaceListing.name, schema: MarketplaceListingSchema },
      { name: PickupPoint.name, schema: PickupPointSchema },
      { name: CommerceOrder.name, schema: CommerceOrderSchema },
      { name: JewellerySellRequest.name, schema: JewellerySellRequestSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
