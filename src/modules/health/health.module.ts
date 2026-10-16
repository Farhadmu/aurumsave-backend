import { Module } from '@nestjs/common';
import { PriceModule } from '../prices/price.module';
import { PaymentModule } from '../payments/payment.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PriceModule, PaymentModule],
  controllers: [HealthController],
})
export class HealthModule {}
