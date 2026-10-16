import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Role, AuditAction } from '@aurumsave/shared';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async log(params: {
    actorId?: string | Types.ObjectId;
    actorRole: Role;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    try {
      const created = await this.auditModel.create({
        logId: `AUD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`,
        actorId: params.actorId ? new Types.ObjectId(params.actorId.toString()) : undefined,
        actorRole: params.actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });

      this.logger.log(`[AUDIT] ${params.action} on ${params.entityType}:${params.entityId || 'N/A'} by ${params.actorRole}`);
      return created;
    } catch (err: any) {
      this.logger.error(`Failed to record audit log: ${err.message}`, err.stack);
      // Fail safely without disrupting the primary transactional flow, but log critically
      throw err;
    }
  }

  async getAuditLogs(filters: {
    action?: AuditAction;
    actorId?: string;
    entityType?: string;
    limit?: number;
    skip?: number;
  }) {
    const query: any = {};
    if (filters.action) query.action = filters.action;
    if (filters.actorId) query.actorId = new Types.ObjectId(filters.actorId);
    if (filters.entityType) query.entityType = filters.entityType;

    const limit = Math.min(filters.limit || 50, 100);
    const skip = filters.skip || 0;

    const [logs, total] = await Promise.all([
      this.auditModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'fullName email role')
        .lean(),
      this.auditModel.countDocuments(query),
    ]);

    return { logs, total, limit, skip };
  }
}
