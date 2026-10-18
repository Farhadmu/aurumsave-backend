import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  PurityGrade,
  MarketplaceCategory,
  MarketplaceListingStatus,
  MarketplaceVerificationStatus,
  ItemCondition,
} from '@aurumsave/shared';

export type MarketplaceListingDocument = MarketplaceListing & Document;

@Schema({ timestamps: true })
export class MarketplaceListing {
  @Prop({ required: true, unique: true, index: true })
  listingId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  sellerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  sellerName: string;

  @Prop({ required: true, enum: MarketplaceCategory, index: true })
  category: MarketplaceCategory;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], required: true })
  photos: string[];

  @Prop({ required: true, enum: PurityGrade })
  claimedPurity: PurityGrade;

  @Prop({ required: true, type: Number })
  claimedGrossWeightGrams: number;

  @Prop({ required: true, type: Number })
  claimedNetGoldWeightGrams: number;

  @Prop({ type: Number, default: 0 })
  stoneWastageDeductionGrams: number;

  @Prop({ required: true, enum: ItemCondition })
  condition: ItemCondition;

  @Prop({ required: true, type: Number })
  askingPricePoisha: number;

  @Prop({
    required: true,
    enum: MarketplaceListingStatus,
    default: MarketplaceListingStatus.PENDING_REVIEW,
    index: true,
  })
  status: MarketplaceListingStatus;

  @Prop({
    required: true,
    enum: MarketplaceVerificationStatus,
    default: MarketplaceVerificationStatus.UNVERIFIED,
    index: true,
  })
  verificationStatus: MarketplaceVerificationStatus;

  @Prop({ enum: PurityGrade })
  verifiedPurity?: PurityGrade;

  @Prop({ type: Number })
  verifiedNetGoldWeightGrams?: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  verifiedByStaffId?: Types.ObjectId;

  @Prop()
  verifiedAt?: Date;

  @Prop()
  verificationNotes?: string;

  @Prop()
  rejectionReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reservedByUserId?: Types.ObjectId;

  @Prop()
  reservationExpiresAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  buyerId?: Types.ObjectId;

  @Prop()
  soldAt?: Date;

  @Prop()
  escrowOrderId?: string;
}

export const MarketplaceListingSchema = SchemaFactory.createForClass(MarketplaceListing);
MarketplaceListingSchema.index({ status: 1, category: 1, createdAt: -1 });
MarketplaceListingSchema.index({ sellerId: 1, createdAt: -1 });
