import { Controller, Post, Get, Param, Body, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@aurumsave/shared';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto, ProcessWebhookDto, SimulateSandboxPaymentDto } from './payment.dto';
import { PaymentVerificationService } from './providers/payment-verification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly verificationService: PaymentVerificationService,
  ) {}

  @Get('providers/status')
  @ApiOperation({ summary: 'Get current configuration and staging readiness status for all payment providers' })
  getProvidersStatus() {
    const statuses = this.verificationService.getProvidersStatus();
    return {
      success: true,
      data: statuses,
      timestamp: new Date().toISOString(),
    };
  }

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
  @ApiOperation({ summary: 'Get payment status and details (with ownership enforcement)' })
  async getPayment(@Param('id') paymentId: string, @CurrentUser() user: any) {
    const result = await this.paymentService.getPaymentDetails(paymentId, user);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FINANCE_OFFICER, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Execute authorized refund for payment (Finance & Admin only)' })
  async refundPayment(
    @Param('id') paymentId: string,
    @Body('reason') reason: string,
    @CurrentUser('id') officerId: string,
    @CurrentUser('role') officerRole: any,
  ) {
    const result = await this.paymentService.refundPayment(paymentId, officerId, officerRole, reason);
    return {
      success: true,
      message: result.message,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('sandbox/simulate')
  @ApiOperation({ summary: 'Development / Sandbox Payment Simulator (disabled in production)' })
  async simulateSandbox(@Body() dto: SimulateSandboxPaymentDto) {
    const result = await this.paymentService.simulateSandboxPayment(dto);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Secure provider-verified webhook endpoint for gateway callbacks' })
  async webhook(
    @Body() dto: ProcessWebhookDto,
    @Headers() allHeaders: Record<string, string>,
  ) {
    const signature = dto.signature || allHeaders['x-signature'] || allHeaders['x-gateway-signature'];
    const result = await this.paymentService.processWebhook(
      {
        ...dto,
        signature,
      },
      allHeaders,
    );
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}

