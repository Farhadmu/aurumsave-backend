import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PurityGrade } from '@aurumsave/shared';
import { PriceService } from './price.service';

@ApiTags('Gold Pricing')
@Controller('gold/prices')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Get()
  @ApiOperation({ summary: 'Get current verified BAJUS live gold prices and spreads' })
  async getCurrentRates() {
    const rates = await this.priceService.getCurrentRates();
    return {
      success: true,
      data: rates,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get historical gold price trends' })
  @ApiQuery({ name: 'purity', enum: PurityGrade, required: false })
  @ApiQuery({ name: 'days', type: Number, required: false })
  async getHistory(
    @Query('purity') purity?: PurityGrade,
    @Query('days') days?: number,
  ) {
    const history = await this.priceService.getPriceHistory(
      purity || PurityGrade.K24,
      days ? Number(days) : 30,
    );
    return {
      success: true,
      data: history,
      timestamp: new Date().toISOString(),
    };
  }
}
