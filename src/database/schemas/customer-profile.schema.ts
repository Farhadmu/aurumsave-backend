import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CustomerProfileDocument = CustomerProfile & Document;

@Schema({ timestamps: true })
export class CustomerProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: Types.ObjectId;

  @Prop({ trim: true })
  nidNumber?: string;

  @Prop()
  dateOfBirth?: Date;

  @Prop({ trim: true })
  occupation?: string;

  @Prop({
    type: {
      addressLine1: String,
      city: String,
      district: String,
      division: String,
      postalCode: String,
    },
    default: {},
  })
  address: {
    addressLine1?: string;
    city?: string;
    district?: string;
    division?: string;
    postalCode?: string;
  };

  @Prop({
    type: {
      name: String,
      relationship: String,
      phone: String,
    },
  })
  nominee?: {
    name: string;
    relationship: string;
    phone: string;
  };

  @Prop({ trim: true })
  preferredBkashNumber?: string;

  @Prop({
    type: {
      bankName: String,
      accountName: String,
      accountNumber: String,
      branchName: String,
      routingNumber: String,
    },
  })
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchName: string;
    routingNumber: string;
  };
}

export const CustomerProfileSchema = SchemaFactory.createForClass(CustomerProfile);
CustomerProfileSchema.index({ userId: 1 });
