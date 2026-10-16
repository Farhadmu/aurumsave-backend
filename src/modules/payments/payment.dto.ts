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
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gatewayTransactionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  success?: boolean;
}
