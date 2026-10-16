import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto, ProcessWebhookDto } from './payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate payment for an order via MFS or Card' })
  async initiate(
    @CurrentUser('id') userId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    const result = await this.paymentService.initiatePayment(userId, dto);
    return {
      success: true,
      message: 'Payment session created',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment status and details' })
  async getPayment(@Param('id') paymentId: string) {
    const result = await this.paymentService.getPaymentDetails(paymentId);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook endpoint for payment gateway confirmation' })
  async webhook(@Body() dto: ProcessWebhookDto) {
    const result = await this.paymentService.processWebhook(dto);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
