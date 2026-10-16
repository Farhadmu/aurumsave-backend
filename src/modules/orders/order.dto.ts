import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, OrderStatus } from '@aurumsave/shared';

export class CreateOrderDto {
  @ApiProperty({ description: 'Valid unexpired quote ID', example: 'QTE-1718000000-ABCDEF' })
  @IsString()
  @IsNotEmpty()
  quoteId: string;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.BKASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ description: 'Client-generated idempotency key to prevent double submits' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class FilterOrdersDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  skip?: number;
}
