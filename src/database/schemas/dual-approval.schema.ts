import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { DualApprovalOperation, DualApprovalStatus, Role } from '@aurumsave/shared';

export type DualApprovalRequestDocument = DualApprovalRequest & Document;

@Schema({ timestamps: true })
export class DualApprovalRequest {
  @Prop({ required: true, unique: true, index: true })
  requestId: string;

  @Prop({ required: true, enum: DualApprovalOperation, index: true })
  operationType: DualApprovalOperation;

  @Prop({ required: true, type: Object })
  payload: Record<string, any>;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  makerId: Types.ObjectId;

  @Prop({ required: true, enum: Role })
  makerRole: Role;

  @Prop({ trim: true })
  makerName?: string;

  @Prop({
    required: true,
    enum: DualApprovalStatus,
    default: DualApprovalStatus.PENDING,
    index: true,
  })
  status: DualApprovalStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  checkerId?: Types.ObjectId;

  @Prop({ enum: Role })
  checkerRole?: Role;

  @Prop({ trim: true })
  checkerName?: string;

  @Prop({ trim: true })
  decisionNote?: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export const DualApprovalRequestSchema = SchemaFactory.createForClass(DualApprovalRequest);
DualApprovalRequestSchema.index({ status: 1, expiresAt: 1 });
DualApprovalRequestSchema.index({ makerId: 1, createdAt: -1 });
