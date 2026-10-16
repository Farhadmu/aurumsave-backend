import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Portfolio')
@Controller('portfolio')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  @ApiOperation({ summary: 'Get live portfolio valuation, holdings, and gains/losses' })
  async getPortfolio(@CurrentUser('id') userId: string) {
    const summary = await this.portfolioService.getPortfolioSummary(userId);
    return {
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get portfolio balance change history' })
  async getHistory(@CurrentUser('id') userId: string) {
    const result = await this.portfolioService.getPortfolioHistory(userId);
    return {
      success: true,
      data: result.entries,
      meta: { total: result.total },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('statement')
  @ApiOperation({ summary: 'Generate and retrieve official customer account statement' })
  async getStatement(
    @CurrentUser('id') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const statement = await this.portfolioService.getAccountStatement(userId, startDate, endDate);
    return {
      success: true,
      data: statement,
      timestamp: new Date().toISOString(),
    };
  }
}
