import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderType, PurityGrade } from '@aurumsave/shared';

export type QuoteDocument = Quote & Document;

@Schema({ timestamps: true })
export class Quote {
  @Prop({ required: true, unique: true })
  quoteId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: OrderType })
  orderType: OrderType;

  @Prop({ required: true, enum: PurityGrade })
  purity: PurityGrade;

  @Prop({ required: true, type: Number })
  weightMilligrams: number; // Precision in milligrams

  @Prop({ required: true, type: Number })
  ratePerMilligramPoisha: number;

  @Prop({ required: true, type: Number })
  subtotalPoisha: number;

  @Prop({ required: true, type: Number, default: 0 })
  platformFeePoisha: number;

  @Prop({ required: true, type: Number, default: 0 })
  vaultStorageFeePoisha: number;

  @Prop({ required: true, type: Number })
  totalPoisha: number;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  isUsed: boolean;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);
QuoteSchema.index({ userId: 1, expiresAt: 1, isUsed: 1 });
