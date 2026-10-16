import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PurityGrade } from '@aurumsave/shared';

export type PriceAlertDocument = PriceAlert & Document;

export enum AlertDirection {
  ABOVE = 'ABOVE',
  BELOW = 'BELOW',
}

@Schema({ timestamps: true })
export class PriceAlert {
  @Prop({ required: true, unique: true, index: true })
  alertId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: PurityGrade, default: PurityGrade.K24 })
  purity: PurityGrade;

  @Prop({ required: true, type: Number })
  targetPricePerGramPoisha: number;

  @Prop({ required: true, enum: AlertDirection })
  direction: AlertDirection;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: false })
  isTriggered: boolean;

  @Prop()
  triggeredAt?: Date;

  @Prop({ type: [String], default: ['IN_APP', 'EMAIL'] })
  notificationChannels: string[];
}

export const PriceAlertSchema = SchemaFactory.createForClass(PriceAlert);
PriceAlertSchema.index({ userId: 1, isActive: 1 });
PriceAlertSchema.index({ purity: 1, isActive: 1 });
