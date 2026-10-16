import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PurityGrade } from '@aurumsave/shared';

export class SendGiftDto {
  @ApiProperty({ description: 'Recipient phone number (e.g. 01712345678) or email' })
  @IsString()
  @IsNotEmpty()
  recipientIdentifier: string;

  @ApiProperty({ description: 'Weight in grams (minimum 0.1g / 100mg)' })
  @IsNumber()
  @Min(0.1)
  weightGrams: number;

  @ApiPropertyOptional({ enum: PurityGrade, default: PurityGrade.K24 })
  @IsOptional()
  @IsString()
  purity?: PurityGrade;

  @ApiPropertyOptional({ description: 'Personal luxury gift message' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class LookupRecipientDto {
  @ApiProperty({ description: 'Phone number or email to lookup and mask for security' })
  @IsString()
  @IsNotEmpty()
  recipientIdentifier: string;
}

export class ClaimGiftDto {
  @ApiPropertyOptional({ description: 'Optional thank you note upon accepting' })
  @IsOptional()
  @IsString()
  note?: string;
}
