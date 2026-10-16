import { Module } from '@nestjs/common';
import { PriceModule } from '../prices/price.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PriceModule],
  controllers: [HealthController],
})
export class HealthModule {}
