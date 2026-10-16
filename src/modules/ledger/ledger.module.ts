import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LedgerEntry, LedgerEntrySchema } from '../../database/schemas/ledger-entry.schema';
import { GoldHolding, GoldHoldingSchema } from '../../database/schemas/gold-holding.schema';
import { LedgerService } from './ledger.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: GoldHolding.name, schema: GoldHoldingSchema },
    ]),
  ],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
