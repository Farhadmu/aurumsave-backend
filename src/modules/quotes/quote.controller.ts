import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuoteService } from './quote.service';
import { CreateQuoteDto } from './quote.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Quotes')
@Controller('gold/quotes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  @ApiOperation({ summary: 'Request a guaranteed 5-minute buy/sell quote' })
  async createQuote(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateQuoteDto,
  ) {
    const quote = await this.quoteService.createQuote(userId, dto);
    return {
      success: true,
      data: quote,
      timestamp: new Date().toISOString(),
    };
  }
}
