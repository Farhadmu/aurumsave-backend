import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PriceService } from '../prices/price.service';

@ApiTags('System Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly priceService: PriceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Platform operational health and integration readiness check' })
  async checkHealth() {
    const isDbReady = this.connection.readyState === 1;
    let priceFeedReady = false;

    try {
      const rates = await this.priceService.getCurrentRates();
      priceFeedReady = rates.length > 0;
    } catch {
      priceFeedReady = false;
    }

    const memory = process.memoryUsage();

    return {
      success: isDbReady && priceFeedReady,
      status: isDbReady && priceFeedReady ? 'OPERATIONAL' : 'DEGRADED',
      components: {
        database: {
          status: isDbReady ? 'CONNECTED' : 'DISCONNECTED',
          name: this.connection.name,
        },
        priceFeed: {
          status: priceFeedReady ? 'ACTIVE' : 'UNAVAILABLE',
          provider: 'BAJUS_BENCHMARK',
        },
        paymentGateways: {
          status: 'SANDBOX_ACTIVE',
          supported: ['BKASH', 'NAGAD', 'SSLCOMMERZ'],
        },
      },
      system: {
        nodeVersion: process.version,
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssMb: Math.round(memory.rss / (1024 * 1024)),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
