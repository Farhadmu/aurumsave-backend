import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TicketStatus, TicketPriority } from '@aurumsave/shared';

export type SupportTicketDocument = SupportTicket & Document;

@Schema({ timestamps: true })
export class SupportTicket {
  @Prop({ required: true, unique: true, index: true })
  ticketId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  subject: string;

  @Prop({ required: true, trim: true })
  category: string; // e.g. PAYMENT_ISSUE, GOLD_DELIVERY, KYC_QUESTION, ACCOUNT_SECURITY

  @Prop({ required: true, enum: TicketPriority, default: TicketPriority.MEDIUM, index: true })
  priority: TicketPriority;

  @Prop({ required: true, enum: TicketStatus, default: TicketStatus.OPEN, index: true })
  status: TicketStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ index: true })
  relatedOrderId?: string;

  @Prop()
  resolvedAt?: Date;

  @Prop()
  closedAt?: Date;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
SupportTicketSchema.index({ ticketId: 1 });
SupportTicketSchema.index({ userId: 1, createdAt: -1 });
SupportTicketSchema.index({ status: 1, priority: -1 });
