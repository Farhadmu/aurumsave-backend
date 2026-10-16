import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role, AuditAction } from '@aurumsave/shared';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } }) // Immutable: no updatedAt
export class AuditLog {
  @Prop({ required: true, unique: true, index: true })
  logId: string;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  actorId?: Types.ObjectId;

  @Prop({ required: true, enum: Role, index: true })
  actorRole: Role;

  @Prop({ required: true, enum: AuditAction, index: true })
  action: AuditAction;

  @Prop({ required: true, trim: true, index: true })
  entityType: string; // e.g. User, Order, KycApplication, LedgerEntry, Setting

  @Prop({ trim: true, index: true })
  entityId?: string;

  @Prop({ type: Object, default: {} })
  details: Record<string, any>;

  @Prop({ trim: true })
  ipAddress?: string;

  @Prop({ trim: true })
  userAgent?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ logId: 1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
