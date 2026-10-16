import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GoldGift, GoldGiftSchema } from '../../database/schemas/gold-gift.schema';
import { GoldHolding, GoldHoldingSchema } from '../../database/schemas/gold-holding.schema';
import { LedgerEntry, LedgerEntrySchema } from '../../database/schemas/ledger-entry.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { GiftController } from './gift.controller';
import { GiftService } from './gift.service';
import { AuditModule } from '../audit/audit.module';
import { PriceModule } from '../prices/price.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GoldGift.name, schema: GoldGiftSchema },
      { name: GoldHolding.name, schema: GoldHoldingSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuditModule,
    PriceModule,
  ],
  controllers: [GiftController],
  providers: [GiftService],
  exports: [GiftService],
})
export class GiftModule {}
