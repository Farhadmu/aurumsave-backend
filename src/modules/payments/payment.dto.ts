import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@aurumsave/shared';

export class InitiatePaymentDto {
  @ApiProperty({ description: 'Order ID to pay for' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.BKASH })
  @IsEnum(PaymentMethod)
  gateway: PaymentMethod;
}

export class ProcessWebhookDto {
  @ApiProperty({ description: 'Platform payment identifier' })
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiProperty({ description: 'External transaction ID from provider gateway' })
  @IsString()
  @IsNotEmpty()
  gatewayTransactionId: string;

  @ApiPropertyOptional({ description: 'HMAC-SHA256 cryptographic signature header/token' })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional({ description: 'Gateway webhook timestamp' })
  @IsOptional()
  @IsString()
  timestamp?: string;

  @ApiPropertyOptional({ description: 'Provider status code or flag' })
  @IsOptional()
  @IsString()
  gatewayStatusCode?: string;
}

export class SimulateSandboxPaymentDto {
  @ApiProperty({ description: 'Payment identifier to simulate' })
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  success?: boolean;
}
