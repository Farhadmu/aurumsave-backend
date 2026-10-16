import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Role, AuditAction } from '@aurumsave/shared';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';

const GENESIS_HASH = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async onModuleInit() {
    await this.ensureHistoricalChainIntegrity();
  }

  async ensureHistoricalChainIntegrity() {
    const unhashedCount = await this.auditModel.countDocuments({
      $or: [{ entryHash: { $exists: false } }, { entryHash: null }],
    });
    if (unhashedCount > 0) {
      this.logger.log(`Sealing ${unhashedCount} legacy audit logs with cryptographic SHA-256 hash chaining...`);
      const allLogs = await this.auditModel.find().sort({ createdAt: 1, _id: 1 });
      let currentPrev = GENESIS_HASH;
      for (const log of allLogs) {
        log.previousHash = currentPrev;
        const payloadToHash = `${currentPrev}:${log.logId}:${log.action}:${log.actorRole}:${log.entityType}:${log.entityId || ''}:${JSON.stringify(log.details || {})}`;
        log.entryHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');
        await log.save();
        currentPrev = log.entryHash;
      }
      this.logger.log('All legacy audit logs have been cryptographically sealed.');
    }
  }

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
      const last = await this.auditModel.findOne().sort({ createdAt: -1 });
      const previousHash = last?.entryHash || GENESIS_HASH;
      const logId = `AUD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      const payloadToHash = `${previousHash}:${logId}:${params.action}:${params.actorRole}:${params.entityType}:${params.entityId || ''}:${JSON.stringify(params.details || {})}`;
      const entryHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

      const created = await this.auditModel.create({
        logId,
        actorId: params.actorId ? new Types.ObjectId(params.actorId.toString()) : undefined,
        actorRole: params.actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details || {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        previousHash,
        entryHash,
      });

      this.logger.log(`[AUDIT] ${params.action} on ${params.entityType}:${params.entityId || 'N/A'} by ${params.actorRole}`);
      return created;
    } catch (err: any) {
      this.logger.error(`Failed to record audit log: ${err.message}`, err.stack);
      throw err;
    }
  }

  async verifyChainIntegrity(limit?: number) {
    let query = this.auditModel.find().sort({ createdAt: 1, _id: 1 });
    if (limit && limit > 0) {
      query = query.limit(limit);
    }
    const logs = await query.lean();

    let isChainValid = true;
    let verifiedCount = 0;
    let brokenAt: string | null = null;
    let errorDetail: string | null = null;

    if (logs.length === 0) {
      return {
        isChainValid: true,
        verifiedCount: 0,
        totalRecords: 0,
        brokenAt: null,
        message: 'No audit records present in ledger.',
        timestamp: new Date().toISOString(),
      };
    }

    for (let i = 0; i < logs.length; i++) {
      const current = logs[i];

      // 1. Detect missing hash
      if (!current.entryHash) {
        isChainValid = false;
        brokenAt = current.logId;
        errorDetail = `Audit entry ${current.logId} at sequence #${i} is missing its cryptographic entryHash`;
        break;
      }

      // 2. Detect broken links and genesis mismatch
      if (i === 0) {
        if (current.previousHash !== GENESIS_HASH) {
          isChainValid = false;
          brokenAt = current.logId;
          errorDetail = `Genesis link mismatch for log ${current.logId}: expected ${GENESIS_HASH}, found ${current.previousHash}`;
          break;
        }
      } else {
        const prev = logs[i - 1];
        if (current.previousHash !== prev.entryHash) {
          isChainValid = false;
          brokenAt = current.logId;
          errorDetail = `Broken chain link at log ${current.logId}: previousHash does not match predecessor ${prev.logId} entryHash`;
          break;
        }
      }

      // 3. Recalculate hash and detect modified/tampered entries
      const payloadToHash = `${current.previousHash}:${current.logId}:${current.action}:${current.actorRole}:${current.entityType}:${current.entityId || ''}:${JSON.stringify(current.details || {})}`;
      const recomputedHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

      if (current.entryHash !== recomputedHash) {
        isChainValid = false;
        brokenAt = current.logId;
        errorDetail = `Cryptographic checksum mismatch on entry ${current.logId}: record content has been altered or tampered with`;
        break;
      }

      verifiedCount++;
    }

    return {
      isChainValid,
      verifiedCount,
      totalRecords: logs.length,
      brokenAt,
      errorDetail,
      timestamp: new Date().toISOString(),
    };
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
