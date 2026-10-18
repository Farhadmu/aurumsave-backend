import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PurityGrade } from '@aurumsave/shared';

export type JewellerySellRequestDocument = JewellerySellRequest & Document;

@Schema({ timestamps: true })
export class JewellerySellRequest {
  @Prop({ required: true, unique: true, index: true })
  requestId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  customerName: string;

  @Prop({ required: true, trim: true })
  customerPhone: string;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, enum: PurityGrade })
  claimedPurity: PurityGrade;

  @Prop({ required: true, type: Number })
  claimedGrossWeightGrams: number;

  @Prop({ type: [String], default: [] })
  photos: string[];

  @Prop({ required: true })
  preferredPickupPointId: string;

  @Prop({
    required: true,
    enum: [
      'SUBMITTED',
      'SCHEDULED_FOR_ASSAY',
      'ASSAYED_OFFER_MADE',
      'ACCEPTED_BY_CUSTOMER',
      'REJECTED',
      'DISBURSED',
    ],
    default: 'SUBMITTED',
    index: true,
  })
  status: string;

  @Prop({ enum: PurityGrade })
  actualPurity?: PurityGrade;

  @Prop({ type: Number })
  actualGrossWeightGrams?: number;

  @Prop({ type: Number, default: 0 })
  stoneWeightDeductionGrams?: number;

  @Prop({ type: Number })
  actualNetGoldWeightGrams?: number;

  @Prop({ type: Number })
  calculatedOfferPoisha?: number;

  @Prop({ enum: ['BKASH', 'NAGAD', 'BANK_TRANSFER', 'GOLD_WALLET_CREDIT'] })
  disbursementMethod?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assayStaffId?: Types.ObjectId;

  @Prop()
  assayStaffNotes?: string;

  @Prop()
  assayedAt?: Date;
}

export const JewellerySellRequestSchema = SchemaFactory.createForClass(JewellerySellRequest);
JewellerySellRequestSchema.index({ customerId: 1, createdAt: -1 });
JewellerySellRequestSchema.index({ status: 1, preferredPickupPointId: 1 });
