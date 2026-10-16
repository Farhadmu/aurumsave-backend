import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PurityGrade } from '@aurumsave/shared';

export type GoldGiftDocument = GoldGift & Document;

export enum GiftStatus {
  PENDING_ACCEPTANCE = 'pending_acceptance',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true })
export class GoldGift {
  @Prop({ required: true, unique: true, index: true })
  giftId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  senderId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  recipientEmail: string;

  @Prop({ trim: true })
  recipientPhone?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  recipientId?: Types.ObjectId;

  @Prop({ required: true, enum: PurityGrade, default: PurityGrade.K24 })
  purity: PurityGrade;

  @Prop({ required: true, type: Number })
  weightMilligrams: number;

  @Prop({ required: true, type: Number })
  valuationAtGiftPoisha: number;

  @Prop({ trim: true })
  message?: string;

  @Prop({ required: true, enum: GiftStatus, default: GiftStatus.PENDING_ACCEPTANCE, index: true })
  status: GiftStatus;

  @Prop()
  acceptedAt?: Date;

  @Prop({ required: true })
  expiresAt: Date;
}

export const GoldGiftSchema = SchemaFactory.createForClass(GoldGift);
GoldGiftSchema.index({ senderId: 1, createdAt: -1 });
GoldGiftSchema.index({ recipientEmail: 1, status: 1 });
