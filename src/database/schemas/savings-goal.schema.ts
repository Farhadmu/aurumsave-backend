import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SavingsGoalDocument = SavingsGoal & Document;

export enum GoalCategory {
  MARRIAGE = 'marriage',
  EDUCATION = 'education',
  FAMILY = 'family',
  EMERGENCY = 'emergency',
  HAJJ = 'hajj',
  CUSTOM = 'custom',
}

export enum GoalStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

@Schema({ _id: false })
export class GoalContribution {
  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ required: true })
  weightMg: number;

  @Prop({ required: true })
  amountBdt: number;

  @Prop({ default: Date.now })
  date: Date;

  @Prop()
  note?: string;
}

export const GoalContributionSchema = SchemaFactory.createForClass(GoalContribution);

@Schema({ timestamps: true })
export class SavingsGoal {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, enum: GoalCategory, default: GoalCategory.CUSTOM })
  category: GoalCategory;

  @Prop({ required: false })
  targetWeightMg?: number;

  @Prop({ required: false })
  targetAmountBdt?: number;

  @Prop({ default: 0 })
  currentWeightMg: number;

  @Prop({ default: 0 })
  currentAmountBdt: number;

  @Prop({ required: false })
  targetDate?: Date;

  @Prop({ required: false })
  suggestedMonthlyContributionBdt?: number;

  @Prop({ enum: ['daily', 'weekly', 'monthly'], default: 'monthly' })
  frequency: string;

  @Prop({ required: true, enum: GoalStatus, default: GoalStatus.ACTIVE, index: true })
  status: GoalStatus;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: [GoalContributionSchema], default: [] })
  contributions: GoalContribution[];
}

export const SavingsGoalSchema = SchemaFactory.createForClass(SavingsGoal);
SavingsGoalSchema.index({ userId: 1, status: 1 });
