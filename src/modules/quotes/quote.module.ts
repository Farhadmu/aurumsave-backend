import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Quote, QuoteSchema } from '../../database/schemas/quote.schema';
import { PriceModule } from '../prices/price.module';
import { QuoteService } from './quote.service';
import { QuoteController } from './quote.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Quote.name, schema: QuoteSchema }]),
    PriceModule,
  ],
  controllers: [QuoteController],
  providers: [QuoteService],
  exports: [QuoteService],
})
export class QuoteModule {}
