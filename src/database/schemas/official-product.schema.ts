import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PurityGrade } from '@aurumsave/shared';

export type OfficialProductDocument = OfficialProduct & Document;

@Schema({ timestamps: true })
export class OfficialProduct {
  @Prop({ required: true, unique: true, index: true })
  productId: string;

  @Prop({ required: true, trim: true })
  titleEn: string;

  @Prop({ required: true, trim: true })
  titleBn: string;

  @Prop({ required: true, unique: true, index: true })
  slug: string;

  @Prop({ required: true, enum: ['MINTED_BAR', 'CAST_BAR', 'COIN'], default: 'MINTED_BAR' })
  productType: 'MINTED_BAR' | 'CAST_BAR' | 'COIN';

  @Prop({ required: true, enum: PurityGrade, default: PurityGrade.K24, index: true })
  purity: PurityGrade;

  @Prop({ required: true, type: Number })
  weightGrams: number; // 1.0, 5.0, 10.0, 11.664

  @Prop({ required: true, type: Number })
  weightMilligrams: number; // 1000, 5000, 10000, 11664

  @Prop({ required: true, type: Number, default: 45000 })
  makingFeePoisha: number; // Making & blister assay charge in Poisha

  @Prop({ required: true, type: Number, default: 10 })
  inStockQuantity: number;

  @Prop({ required: true, type: Number, default: 0 })
  reservedQuantity: number;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true, default: 'BSTI & PAMP Assay Certified' })
  certifier: string;

  @Prop({ required: true, default: 'LBMA Good Delivery Standard' })
  standard: string;

  @Prop({ default: true, index: true })
  isActive: boolean;
}

export const OfficialProductSchema = SchemaFactory.createForClass(OfficialProduct);
OfficialProductSchema.index({ isActive: 1, weightGrams: 1 });
