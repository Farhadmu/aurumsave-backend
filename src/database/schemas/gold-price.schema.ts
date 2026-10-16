import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PurityGrade } from '@aurumsave/shared';

export type GoldPriceDocument = GoldPrice & Document;

@Schema({ timestamps: true })
export class GoldPrice {
  @Prop({ required: true, enum: PurityGrade, index: true })
  purity: PurityGrade;

  @Prop({ required: true, type: Number })
  buyPricePerGramPoisha: number; // In Poisha (1/100 BDT)

  @Prop({ required: true, type: Number })
  sellPricePerGramPoisha: number; // In Poisha

  @Prop({ required: true, trim: true, default: 'BAJUS_OFFICIAL' })
  source: string;

  @Prop({ required: true })
  effectiveAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  isStale: boolean;

  @Prop({ type: Number, default: 2.5 })
  spreadPercentage: number;
}

export const GoldPriceSchema = SchemaFactory.createForClass(GoldPrice);
GoldPriceSchema.index({ purity: 1, effectiveAt: -1 });
