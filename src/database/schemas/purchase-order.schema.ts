import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PurityGrade, PurchaseOrderStatus } from '@aurumsave/shared';

export type PurchaseOrderDocument = PurchaseOrder & Document;

@Schema({ timestamps: true })
export class PurchaseOrder {
  @Prop({ required: true, unique: true, index: true })
  poNumber: string; // e.g. "PO-2026-0042"

  @Prop({ required: true, index: true })
  supplierId: string;

  @Prop({ required: true, trim: true })
  supplierName: string;

  @Prop({ required: true, enum: PurityGrade })
  purity: PurityGrade;

  @Prop({ required: true, type: Number })
  weightGrams: number;

  @Prop({ required: true, type: Number })
  weightMilligrams: number;

  @Prop({ required: true, type: Number })
  ratePerGramPoisha: number;

  @Prop({ required: true, type: Number })
  totalPoisha: number;

  @Prop({
    required: true,
    enum: PurchaseOrderStatus,
    default: PurchaseOrderStatus.DRAFT,
    index: true,
  })
  status: PurchaseOrderStatus;

  @Prop({ trim: true })
  paymentReference?: string;

  @Prop({ trim: true })
  vaultRecordId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);
PurchaseOrderSchema.index({ status: 1, createdAt: -1 });
