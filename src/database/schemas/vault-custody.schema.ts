import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PurityGrade, VaultCustodyStatus } from '@aurumsave/shared';

export type VaultCustodyRecordDocument = VaultCustodyRecord & Document;

@Schema({ timestamps: true })
export class VaultCustodyRecord {
  @Prop({ required: true, unique: true, index: true })
  recordId: string;

  @Prop({ required: true, trim: true })
  vaultLocation: string; // e.g. "Gulshan-2 Depository, Dhaka"

  @Prop({ required: true, trim: true })
  depositoryPartner: string; // e.g. "Brinks Bangladesh / SecureVault Ltd."

  @Prop({ required: true, unique: true, trim: true, index: true })
  barSerialNumber: string; // e.g. "PAMP-SUISSE-9999-78129"

  @Prop({ required: true, enum: PurityGrade })
  purity: PurityGrade;

  @Prop({ required: true, type: Number })
  weightGrams: number;

  @Prop({ required: true, type: Number })
  weightMilligrams: number;

  @Prop({ required: true, trim: true })
  assayCertificateNumber: string; // e.g. "BSTI-HALLMARK-2026-908"

  @Prop({
    required: true,
    enum: VaultCustodyStatus,
    default: VaultCustodyStatus.IN_VAULT,
    index: true,
  })
  status: VaultCustodyStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  verifiedByStaffId?: Types.ObjectId;

  @Prop()
  verifiedAt?: Date;

  @Prop({ trim: true })
  notes?: string;
}

export const VaultCustodyRecordSchema = SchemaFactory.createForClass(VaultCustodyRecord);
VaultCustodyRecordSchema.index({ status: 1, purity: 1 });
