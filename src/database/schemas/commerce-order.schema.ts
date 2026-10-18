import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  CommerceOrderType,
  FulfillmentStatus,
  PurityGrade,
} from '@aurumsave/shared';

export type CommerceOrderDocument = CommerceOrder & Document;

@Schema({ timestamps: true })
export class CommerceOrder {
  @Prop({ required: true, unique: true, index: true })
  orderId: string;

  @Prop({ required: true, enum: CommerceOrderType, index: true })
  commerceType: CommerceOrderType;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  buyerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  sellerId?: Types.ObjectId;

  @Prop({ type: [Object], required: true })
  items: Array<{
    productId?: string;
    listingId?: string;
    title: string;
    purity: PurityGrade;
    weightGrams: number;
    unitPricePoisha: number;
    makingFeePoisha: number;
    quantity: number;
    totalPoisha: number;
  }>;

  @Prop({ required: true, type: Number })
  subtotalPoisha: number;

  @Prop({ type: Number, default: 0 })
  platformFeePoisha: number;

  @Prop({ type: Number, default: 0 })
  assayFeePoisha: number;

  @Prop({ required: true, type: Number })
  totalPoisha: number;

  @Prop({
    required: true,
    enum: ['AWAITING_PAYMENT', 'ESCROW_HELD', 'SETTLED_TO_SELLER', 'REFUNDED', 'FAILED'],
    default: 'AWAITING_PAYMENT',
    index: true,
  })
  paymentStatus: string;

  @Prop({
    enum: ['BKASH', 'NAGAD', 'STRIPE', 'WALLET', 'BANK_TRANSFER'],
    default: 'BKASH',
  })
  paymentMethod: string;

  @Prop()
  paymentReference?: string;

  @Prop({
    required: true,
    enum: FulfillmentStatus,
    default: FulfillmentStatus.PENDING_INSPECTION,
    index: true,
  })
  fulfillmentStatus: FulfillmentStatus;

  @Prop({
    enum: ['HOME_DELIVERY', 'PICKUP_POINT'],
    default: 'PICKUP_POINT',
    index: true,
  })
  deliveryMethod: 'HOME_DELIVERY' | 'PICKUP_POINT';

  @Prop({ type: Object })
  shippingAddress?: {
    fullName: string;
    phone: string;
    alternativePhone?: string;
    recipientNid?: string;
    division: string;
    district: string;
    upazila?: string;
    addressLine: string;
    postalCode?: string;
    instructions?: string;
  };

  @Prop({ index: true })
  trackingNumber?: string;

  @Prop({ index: true })
  pickupPointId?: string;

  @Prop({ required: true })
  pickupVerificationOtp: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  handoverConfirmedByStaffId?: Types.ObjectId;

  @Prop()
  handoverConfirmedAt?: Date;

  @Prop()
  handoverNotes?: string;
}

export const CommerceOrderSchema = SchemaFactory.createForClass(CommerceOrder);
CommerceOrderSchema.index({ buyerId: 1, createdAt: -1 });
CommerceOrderSchema.index({ sellerId: 1, createdAt: -1 });
CommerceOrderSchema.index({ fulfillmentStatus: 1, pickupPointId: 1 });
