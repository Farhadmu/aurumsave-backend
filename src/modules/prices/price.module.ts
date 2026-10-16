import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GoldPrice, GoldPriceSchema } from '../../database/schemas/gold-price.schema';
import { PriceService } from './price.service';
import { PriceController } from './price.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GoldPrice.name, schema: GoldPriceSchema }]),
  ],
  controllers: [PriceController],
  providers: [PriceService],
  exports: [PriceService],
})
export class PriceModule {}
