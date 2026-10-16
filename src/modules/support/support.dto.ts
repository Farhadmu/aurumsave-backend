import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketStatus } from '@aurumsave/shared';

export class CreateTicketDto {
  @ApiProperty({ example: 'Payment debited but order shows pending' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'PAYMENT_ISSUE' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'I sent 10,000 BDT via bKash TrxID 9K8L2M but status has not updated.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({ example: 'ORD-1718000000-ABCDEF' })
  @IsOptional()
  @IsString()
  relatedOrderId?: string;
}

export class AddMessageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ default: false, description: 'Only visible to staff members' })
  @IsOptional()
  @IsBoolean()
  isInternalNote?: boolean;

  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  updateStatus?: TicketStatus;
}

export class EscalateDisputeDto {
  @ApiProperty({ description: 'Reason for escalating dispute to Finance Department' })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({ description: 'Optional related order ID' })
  @IsOptional()
  @IsString()
  relatedOrderId?: string;
}

export class ResolveDisputeDto {
  @ApiProperty({ enum: ['REFUND_APPROVED', 'DISPUTE_REJECTED', 'MANUAL_SETTLED'] })
  @IsString()
  @IsNotEmpty()
  action: 'REFUND_APPROVED' | 'DISPUTE_REJECTED' | 'MANUAL_SETTLED';

  @ApiProperty({ description: 'Authoritative financial resolution notes' })
  @IsString()
  @IsNotEmpty()
  note: string;
}

