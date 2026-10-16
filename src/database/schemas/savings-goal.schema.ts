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
export class FamilyMember {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ required: true, enum: ['ADMIN', 'CONTRIBUTOR'], default: 'CONTRIBUTOR' })
  role: 'ADMIN' | 'CONTRIBUTOR';

  @Prop({ default: Date.now })
  joinedAt: Date;

  @Prop({ default: 0 })
  totalContributedMg: number;
}

export const FamilyMemberSchema = SchemaFactory.createForClass(FamilyMember);

@Schema({ _id: false })
export class GoalContribution {
  @Prop({ type: Types.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  contributorUserId?: Types.ObjectId;

  @Prop({ trim: true })
  contributorName?: string;

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

  @Prop({ default: false, index: true })
  isFamilyGoal?: boolean;

  @Prop({ type: [FamilyMemberSchema], default: [] })
  familyMembers?: FamilyMember[];

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: [GoalContributionSchema], default: [] })
  contributions: GoalContribution[];
}

export const SavingsGoalSchema = SchemaFactory.createForClass(SavingsGoal);
SavingsGoalSchema.index({ userId: 1, status: 1 });
SavingsGoalSchema.index({ 'familyMembers.userId': 1 });
