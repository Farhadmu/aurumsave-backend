import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '@aurumsave/shared';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true, unique: true, index: true })
  paymentId: string;

  @Prop({ required: true, index: true })
  orderId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: PaymentMethod })
  gateway: PaymentMethod;

  @Prop({ required: true, type: Number })
  amountPoisha: number;

  @Prop({ required: true, enum: PaymentStatus, default: PaymentStatus.INITIATED, index: true })
  status: PaymentStatus;

  @Prop({ index: true })
  gatewayTransactionId?: string;

  @Prop({ select: false })
  gatewaySignature?: string;

  @Prop({ type: Object, default: {} })
  gatewayResponseMetadata?: Record<string, any>;

  @Prop()
  verifiedAt?: Date;

  @Prop()
  failureReason?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ paymentId: 1 }, { unique: true });
PaymentSchema.index({ orderId: 1 });
PaymentSchema.index({ gatewayTransactionId: 1 }, { unique: true, sparse: true });
