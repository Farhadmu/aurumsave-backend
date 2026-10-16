import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { KycStatus, KycDocumentType } from '@aurumsave/shared';

export type KycApplicationDocument = KycApplication & Document;

@Schema({ timestamps: true })
export class KycApplication {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: KycStatus, default: KycStatus.PENDING_REVIEW, index: true })
  status: KycStatus;

  @Prop({ required: true, trim: true })
  idType: string; // NID, PASSPORT, DRIVING_LICENSE

  @Prop({ required: true, trim: true })
  idNumber: string;

  @Prop({
    type: [
      {
        docType: { type: String, enum: KycDocumentType, required: true },
        fileName: { type: String, required: true },
        fileSize: { type: Number, required: true },
        mimeType: { type: String, required: true },
        securePath: { type: String, required: true }, // Not public URL
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  documents: Array<{
    docType: KycDocumentType;
    fileName: string;
    fileSize: number;
    mimeType: string;
    securePath: string;
    uploadedAt: Date;
  }>;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewNotes?: string;

  @Prop()
  rejectionReason?: string;

  @Prop()
  reviewedAt?: Date;
}

export const KycApplicationSchema = SchemaFactory.createForClass(KycApplication);
KycApplicationSchema.index({ userId: 1, createdAt: -1 });
KycApplicationSchema.index({ status: 1, createdAt: 1 });
