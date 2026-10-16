import { IsEnum, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurityGrade, OrderType } from '@aurumsave/shared';

export class CreateQuoteDto {
  @ApiProperty({ enum: OrderType, default: OrderType.BUY })
  @IsEnum(OrderType)
  orderType: OrderType;

  @ApiProperty({ enum: PurityGrade, default: PurityGrade.K24 })
  @IsEnum(PurityGrade)
  purity: PurityGrade;

  @ApiPropertyOptional({ description: 'Weight in grams to buy/sell', example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  grams?: number;

  @ApiPropertyOptional({ description: 'BDT amount to spend', example: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(500)
  amountBdt?: number;
}
