import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { LedgerEntryType } from '@aurumsave/shared';

export type LedgerEntryDocument = LedgerEntry & Document;

@Schema({ timestamps: true })
export class LedgerEntry {
  @Prop({ required: true, unique: true })
  entryId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ index: true })
  orderId?: string;

  @Prop({ index: true })
  paymentId?: string;

  @Prop({ required: true, enum: LedgerEntryType })
  type: LedgerEntryType;

  // Fiat amounts in Poisha
  @Prop({ required: true, type: Number, default: 0 })
  debitPoisha: number;

  @Prop({ required: true, type: Number, default: 0 })
  creditPoisha: number;

  // Gold amounts in Milligrams
  @Prop({ required: true, type: Number, default: 0 })
  debitGoldMg: number;

  @Prop({ required: true, type: Number, default: 0 })
  creditGoldMg: number;

  // Running balance snapshot
  @Prop({ required: true, type: Number, default: 0 })
  runningGoldBalanceMg: number;

  @Prop({ required: true, type: Number, default: 0 })
  runningFiatBalancePoisha: number;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ select: false })
  checksum?: string; // cryptographic hash of previousEntryId + thisEntry for tamper-evident chain
}

export const LedgerEntrySchema = SchemaFactory.createForClass(LedgerEntry);
LedgerEntrySchema.index({ userId: 1, createdAt: -1 });
LedgerEntrySchema.index({ paymentId: 1, type: 1 }, { unique: true, sparse: true });
LedgerEntrySchema.index({ orderId: 1, type: 1 }, { unique: true, sparse: true });
