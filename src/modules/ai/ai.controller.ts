import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AiService } from './ai.service';

@ApiTags('Grounded AI Assistant')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('assistant')
  @ApiOperation({ summary: 'Ask grounded questions regarding gold savings, BAJUS rates, and policies' })
  async askAssistant(@Body('query') query: string) {
    if (!query || query.trim() === '') {
      return {
        success: false,
        message: 'Query string is required',
        timestamp: new Date().toISOString(),
      };
    }
    const response = await this.aiService.askAssistant(query);
    return {
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    };
  }
}
