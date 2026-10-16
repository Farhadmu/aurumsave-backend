import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoalCategory, GoalStatus } from '../../database/schemas/savings-goal.schema';

export class CreateGoalDto {
  @ApiProperty({ description: 'Target objective or title (e.g. Sister Wedding Gold, Hajj Reserve)' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: GoalCategory, default: GoalCategory.CUSTOM })
  @IsEnum(GoalCategory)
  category: GoalCategory;

  @ApiPropertyOptional({ description: 'Target gold weight in milligrams (e.g. 10000 = 10g)' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  targetWeightMg?: number;

  @ApiPropertyOptional({ description: 'Target monetary amount in BDT' })
  @IsOptional()
  @IsNumber()
  @Min(500)
  targetAmountBdt?: number;

  @ApiPropertyOptional({ description: 'Target accomplishment date (YYYY-MM-DD)' })
  @IsOptional()
  targetDate?: string;

  @ApiPropertyOptional({ enum: ['daily', 'weekly', 'monthly'], default: 'monthly' })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional({ description: 'Optional personal motivation notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: GoalCategory })
  @IsOptional()
  @IsEnum(GoalCategory)
  category?: GoalCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  targetWeightMg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  targetAmountBdt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  targetDate?: string;

  @ApiPropertyOptional({ enum: GoalStatus })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ContributeGoalDto {
  @ApiPropertyOptional({ description: 'Authoritative completed order ID if linking an actual gold purchase' })
  @IsOptional()
  @IsString()
  orderId?: string;

  @ApiProperty({ description: 'Gold weight in milligrams to allocate' })
  @IsNumber()
  @Min(1)
  weightMg: number;

  @ApiProperty({ description: 'Monetary value in BDT' })
  @IsNumber()
  @Min(1)
  amountBdt: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CalculatePlanDto {
  @ApiPropertyOptional({ description: 'Target weight in milligrams' })
  @IsOptional()
  @IsNumber()
  targetWeightMg?: number;

  @ApiPropertyOptional({ description: 'Target BDT amount' })
  @IsOptional()
  @IsNumber()
  targetAmountBdt?: number;

  @ApiProperty({ description: 'Time horizon in months (e.g. 6, 12, 24, 36)' })
  @IsNumber()
  @Min(1)
  targetMonths: number;
}
