import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import { Payment, PaymentSchema } from '../../database/schemas/payment.schema';
import { LedgerEntry, LedgerEntrySchema } from '../../database/schemas/ledger-entry.schema';
import { GoldHolding, GoldHoldingSchema } from '../../database/schemas/gold-holding.schema';
import { SupportTicket, SupportTicketSchema } from '../../database/schemas/support-ticket.schema';
import { PlatformSetting, PlatformSettingSchema } from '../../database/schemas/platform-setting.schema';
import { DualApprovalRequest, DualApprovalRequestSchema } from '../../database/schemas/dual-approval.schema';
import { Supplier, SupplierSchema } from '../../database/schemas/supplier.schema';
import { VaultCustodyRecord, VaultCustodyRecordSchema } from '../../database/schemas/vault-custody.schema';
import { PurchaseOrder, PurchaseOrderSchema } from '../../database/schemas/purchase-order.schema';
import { CmsContent, CmsContentSchema } from '../../database/schemas/cms-content.schema';
import { GoldPrice, GoldPriceSchema } from '../../database/schemas/gold-price.schema';
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
      { name: PlatformSetting.name, schema: PlatformSettingSchema },
      { name: DualApprovalRequest.name, schema: DualApprovalRequestSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: VaultCustodyRecord.name, schema: VaultCustodyRecordSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: CmsContent.name, schema: CmsContentSchema },
      { name: GoldPrice.name, schema: GoldPriceSchema },
    ]),
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
