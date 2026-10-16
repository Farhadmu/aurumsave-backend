import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlatformSettingDocument = PlatformSetting & Document;

@Schema({ timestamps: true })
export class PlatformSetting {
  @Prop({ required: true, unique: true, trim: true })
  key: string;

  @Prop({ required: true, type: Object })
  value: any;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const PlatformSettingSchema = SchemaFactory.createForClass(PlatformSetting);
