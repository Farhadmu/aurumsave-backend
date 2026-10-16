import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PurityGrade } from '@aurumsave/shared';

export type SavingsPlanDocument = SavingsPlan & Document;

export enum PlanFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum PlanStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true })
export class SavingsPlan {
  @Prop({ required: true, unique: true, index: true })
  planId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, enum: PlanFrequency, default: PlanFrequency.MONTHLY })
  frequency: PlanFrequency;

  @Prop({ required: true, type: Number })
  amountPoisha: number; // Stored in poisha integer

  @Prop({ required: true, enum: PurityGrade, default: PurityGrade.K24 })
  purity: PurityGrade;

  @Prop({ required: true, enum: PlanStatus, default: PlanStatus.ACTIVE, index: true })
  status: PlanStatus;

  @Prop({ required: true })
  paymentMethod: string; // e.g. BKASH_MANDATE, NAGAD_DIRECT, BANK_CARD

  @Prop({ type: Number, default: 0 })
  accumulatedGoldMg: number;

  @Prop({ type: Number, default: 0 })
  totalContributionsCount: number;

  @Prop({ required: true })
  nextDebitDate: Date;

  @Prop()
  lastExecutedAt?: Date;

  @Prop({ default: true })
  hasConsentMandate: boolean;

  @Prop()
  cancelledAt?: Date;

  @Prop({ trim: true })
  notes?: string;
}

export const SavingsPlanSchema = SchemaFactory.createForClass(SavingsPlan);
SavingsPlanSchema.index({ userId: 1, status: 1 });
SavingsPlanSchema.index({ nextDebitDate: 1, status: 1 });
