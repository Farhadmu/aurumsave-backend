import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CmsContentType } from '@aurumsave/shared';

export type CmsContentDocument = CmsContent & Document;

@Schema({ timestamps: true })
export class CmsContent {
  @Prop({ required: true, unique: true, index: true })
  slug: string; // e.g. "hero-banner", "faq-hallmark", "academy-bhori-guide"

  @Prop({ required: true, enum: CmsContentType, index: true })
  contentType: CmsContentType;

  @Prop({ required: true, trim: true })
  titleEn: string;

  @Prop({ required: true, trim: true })
  titleBn: string;

  @Prop({ required: true })
  bodyEn: string;

  @Prop({ required: true })
  bodyBn: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;

  @Prop({ default: true, index: true })
  isPublished: boolean;

  @Prop({ default: 0, type: Number })
  priorityOrder: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const CmsContentSchema = SchemaFactory.createForClass(CmsContent);
CmsContentSchema.index({ contentType: 1, isPublished: 1, priorityOrder: 1 });
