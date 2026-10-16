import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GoldHolding, GoldHoldingSchema } from '../../database/schemas/gold-holding.schema';
import { PriceModule } from '../prices/price.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PortfolioService } from './portfolio.service';
import { PortfolioController } from './portfolio.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GoldHolding.name, schema: GoldHoldingSchema }]),
    PriceModule,
    LedgerModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
