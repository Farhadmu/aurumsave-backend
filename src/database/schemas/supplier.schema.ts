import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PurityGrade } from '@aurumsave/shared';

export type SupplierDocument = Supplier & Document;

@Schema({ timestamps: true })
export class Supplier {
  @Prop({ required: true, unique: true, index: true })
  supplierId: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  contactPerson: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  licenseNumber: string;

  @Prop({ type: [String], enum: PurityGrade, default: [PurityGrade.K24, PurityGrade.K22] })
  purityGradesOffered: PurityGrade[];

  @Prop({ required: true, type: Number })
  currentBidQuotePoishaPerGram: number; // Supplier will buy from us at this rate

  @Prop({ required: true, type: Number })
  currentAskQuotePoishaPerGram: number; // Supplier will sell to us at this rate (sourcing cost)

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ default: 5, type: Number })
  rating: number;
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
SupplierSchema.index({ isActive: 1, name: 1 });
