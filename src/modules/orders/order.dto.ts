import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, OrderStatus } from '@aurumsave/shared';

export class PayoutDetailsDto {
  @ApiProperty({ example: 'BKASH', enum: ['BKASH', 'NAGAD', 'BANK'] })
  @IsString()
  @IsNotEmpty()
  accountType: string;

  @ApiProperty({ example: '01700000000' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiPropertyOptional({ example: 'City Bank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: '12345678' })
  @IsOptional()
  @IsString()
  routingNumber?: string;
}

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

  @ApiPropertyOptional({ type: PayoutDetailsDto })
  @IsOptional()
  payoutDetails?: PayoutDetailsDto;
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
