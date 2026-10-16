import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PurityGrade } from '@aurumsave/shared';

export type GoldHoldingDocument = GoldHolding & Document;

@Schema({ timestamps: true })
export class GoldHolding {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: PurityGrade })
  purity: PurityGrade;

  @Prop({ required: true, type: Number, default: 0 })
  weightMilligramsAvailable: number; // In milligrams for precision

  @Prop({ required: true, type: Number, default: 0 })
  weightMilligramsPending: number;

  @Prop({ required: true, type: Number, default: 0 })
  totalCostPoisha: number; // Minor units

  @Prop({ required: true, type: Number, default: 0 })
  averageCostPerMilligramPoisha: number;
}

export const GoldHoldingSchema = SchemaFactory.createForClass(GoldHolding);
GoldHoldingSchema.index({ userId: 1, purity: 1 }, { unique: true });
