import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderType, OrderStatus, PurityGrade, PaymentMethod } from '@aurumsave/shared';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, unique: true, index: true })
  orderId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: OrderType })
  orderType: OrderType;

  @Prop({ required: true, ref: 'Quote' })
  quoteId: string;

  @Prop({ required: true, enum: PurityGrade })
  purity: PurityGrade;

  @Prop({ required: true, type: Number })
  weightMilligrams: number;

  @Prop({ required: true, type: Number })
  totalPoisha: number;

  @Prop({ required: true, enum: OrderStatus, default: OrderStatus.CREATED, index: true })
  status: OrderStatus;

  @Prop({ enum: PaymentMethod })
  paymentMethod?: PaymentMethod;

  @Prop()
  paymentId?: string;

  @Prop({ index: true })
  idempotencyKey?: string;

  @Prop({
    type: {
      accountType: { type: String, enum: ['BKASH', 'NAGAD', 'BANK'] },
      accountNumber: String,
      bankName: String,
      routingNumber: String,
    },
  })
  payoutDetails?: {
    accountType: string;
    accountNumber: string;
    bankName?: string;
    routingNumber?: string;
  };

  @Prop({
    type: [
      {
        status: { type: String, enum: OrderStatus, required: true },
        note: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  statusHistory: Array<{
    status: OrderStatus;
    note?: string;
    timestamp: Date;
  }>;

  @Prop()
  completedAt?: Date;

  @Prop()
  failureReason?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
OrderSchema.index({ orderId: 1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
