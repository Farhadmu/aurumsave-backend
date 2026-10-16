import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role, KycStatus } from '@aurumsave/shared';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ required: true, enum: Role, default: Role.CUSTOMER, index: true })
  role: Role;

  @Prop({ required: true, enum: KycStatus, default: KycStatus.NOT_SUBMITTED, index: true })
  kycStatus: KycStatus;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isTwoFactorEnabled: boolean;

  @Prop({ select: false })
  twoFactorSecret?: string;

  @Prop()
  lastLoginAt?: Date;

  @Prop({ default: false })
  isEmailVerified: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1, kycStatus: 1 });
