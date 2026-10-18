import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PickupPointStatus } from '@aurumsave/shared';

export type PickupPointDocument = PickupPoint & Document;

@Schema({ timestamps: true })
export class PickupPoint {
  @Prop({ required: true, unique: true, index: true })
  pointId: string;

  @Prop({ required: true, trim: true })
  nameEn: string;

  @Prop({ required: true, trim: true })
  nameBn: string;

  @Prop({ required: true, index: true })
  division: string; // e.g. "Dhaka", "Chattogram", "Sylhet", etc.

  @Prop({ required: true, index: true })
  district: string; // e.g. "Dhaka", "Gazipur", "Bogura", etc.

  @Prop({ required: true })
  addressEn: string;

  @Prop({ required: true })
  addressBn: string;

  @Prop({ required: true })
  contactPerson: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  operatingHours: string; // "Sun - Thu: 10:00 AM - 6:00 PM"

  @Prop({
    type: [String],
    enum: ['OFFICIAL_STORE_PICKUP', 'MARKETPLACE_HANDOVER', 'JEWELLERY_ASSAY'],
    default: ['OFFICIAL_STORE_PICKUP', 'MARKETPLACE_HANDOVER', 'JEWELLERY_ASSAY'],
  })
  supportedServices: string[];

  @Prop({ required: true, default: 25 })
  dailyCapacity: number;

  @Prop({ default: 0 })
  currentScheduledToday: number;

  @Prop({
    required: true,
    enum: PickupPointStatus,
    default: PickupPointStatus.ACTIVE,
    index: true,
  })
  status: PickupPointStatus;

  @Prop({
    type: [String],
    default: [
      'Armed Guard Depository',
      'XRF Spectrometer Assay Laboratory On-Site',
      'CCTV Monitored Vault',
    ],
  })
  securityFeatures: string[];
}

export const PickupPointSchema = SchemaFactory.createForClass(PickupPoint);
PickupPointSchema.index({ division: 1, district: 1, status: 1 });
