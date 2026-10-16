import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from '@aurumsave/shared';

export type SupportMessageDocument = SupportMessage & Document;

@Schema({ timestamps: true })
export class SupportMessage {
  @Prop({ required: true, index: true })
  ticketId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true, enum: Role })
  senderRole: Role;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ default: false, index: true })
  isInternalNote: boolean; // Accessible only to staff, never shown to customer

  @Prop({
    type: [
      {
        fileName: String,
        secureUrl: String,
        fileSize: Number,
      },
    ],
    default: [],
  })
  attachments: Array<{
    fileName: string;
    secureUrl: string;
    fileSize: number;
  }>;
}

export const SupportMessageSchema = SchemaFactory.createForClass(SupportMessage);
SupportMessageSchema.index({ ticketId: 1, createdAt: 1 });
