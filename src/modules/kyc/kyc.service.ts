import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { KycStatus, Role, AuditAction } from '@aurumsave/shared';
import { KycApplication, KycApplicationDocument } from '../../database/schemas/kyc-application.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { AuditService } from '../audit/audit.service';
import { SubmitKycDto, ReviewKycDto } from './kyc.dto';

const STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'kyc');

@Injectable()
export class KycService {
  constructor(
    @InjectModel(KycApplication.name) private readonly kycModel: Model<KycApplicationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly auditService: AuditService,
  ) {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  }

  async uploadDocument(userId: string, file: any) {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type "${file.mimetype}". Allowed types: JPG, PNG, WEBP, PDF`,
      );
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File size exceeds the 5MB maximum limit');
    }

    // Inspect magic bytes to prevent disguised executable payloads
    if (!file.buffer || file.buffer.length < 4) {
      throw new BadRequestException('Invalid or empty file payload');
    }

    const buf = file.buffer;
    let isMagicValid = false;

    if (file.mimetype === 'image/jpeg' && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      isMagicValid = true;
    } else if (
      file.mimetype === 'image/png' &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    ) {
      isMagicValid = true;
    } else if (
      file.mimetype === 'image/webp' &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP'
    ) {
      isMagicValid = true;
    } else if (
      file.mimetype === 'application/pdf' &&
      buf.toString('ascii', 0, 4) === '%PDF'
    ) {
      isMagicValid = true;
    }

    if (!isMagicValid) {
      throw new BadRequestException(
        'File content signature (magic bytes) does not match declared MIME type. Potential disguised payload rejected.',
      );
    }

    const ext = path.extname(file.originalname) || '.jpg';
    const storageKey = `kyc_${userId}_${uuidv4().substring(0, 12)}${ext}`;
    const filePath = path.join(STORAGE_DIR, storageKey);

    await fs.promises.writeFile(filePath, file.buffer);

    return {
      storageKey,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  async getDocumentPath(
    storageKey: string,
    requestingUser?: { id: string; role: Role },
  ): Promise<{ filePath: string; mimeType: string }> {
    const safeKey = path.basename(storageKey);
    const filePath = path.join(STORAGE_DIR, safeKey);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Document file not found in private storage');
    }

    if (requestingUser) {
      const isStaffWithKycAccess = [
        Role.KYC_OFFICER,
        Role.ADMIN,
        Role.SUPER_ADMIN,
      ].includes(requestingUser.role);

      if (requestingUser.role === Role.CUSTOMER) {
        // Customer can ONLY access their own document
        const isOwnDoc = safeKey.startsWith(`kyc_${requestingUser.id}_`);
        if (!isOwnDoc) {
          throw new ForbiddenException('Cross-customer document access is strictly forbidden');
        }
      } else if (!isStaffWithKycAccess) {
        // Auditors, Finance, Support agents cannot view private KYC identity documents
        throw new ForbiddenException(
          `Users with role ${requestingUser.role} are not authorized to inspect confidential customer KYC documents`,
        );
      }
    }

    const ext = path.extname(safeKey).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.pdf') mimeType = 'application/pdf';

    return { filePath, mimeType };
  }

  async submitKyc(userId: string, dto: SubmitKycDto): Promise<KycApplicationDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KycStatus.APPROVED) {
      throw new BadRequestException('Your KYC is already approved and verified');
    }

    const pending = await this.kycModel.findOne({
      userId: userObjectId,
      status: KycStatus.PENDING_REVIEW,
    });
    if (pending) {
      throw new BadRequestException('You already have a KYC application pending compliance review');
    }

    if (!dto.documents || dto.documents.length === 0) {
      throw new BadRequestException('At least one identity verification document must be attached');
    }

    const sanitizedDocs = dto.documents.map((d) => {
      const storageKey = d.storageKey || (d.securePath ? path.basename(d.securePath) : `kyc_${userId}_${uuidv4().substring(0, 8)}.jpg`);
      return {
        docType: d.docType,
        storageKey,
        fileName: d.fileName || `${d.docType}.jpg`,
        fileSize: d.fileSize || 1024 * 1024,
        mimeType: d.mimeType || 'image/jpeg',
        securePath: storageKey,
        uploadedAt: new Date(),
      };
    });

    const application = await this.kycModel.create({
      userId: userObjectId,
      status: KycStatus.PENDING_REVIEW,
      idType: dto.idType,
      idNumber: dto.idNumber,
      documents: sanitizedDocs,
    });

    user.kycStatus = KycStatus.PENDING_REVIEW;
    await user.save();

    await this.auditService.log({
      actorId: userId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.KYC_SUBMITTED,
      entityType: 'KycApplication',
      entityId: application._id.toString(),
      details: { idType: dto.idType, docCount: dto.documents.length },
    });

    return application;
  }

  async getMyKycStatus(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const [latest, history] = await Promise.all([
      this.kycModel.findOne({ userId: userObjectId }).sort({ createdAt: -1 }),
      this.kycModel.find({ userId: userObjectId }).sort({ createdAt: -1 }).limit(10),
    ]);

    return {
      currentStatus: latest ? latest.status : KycStatus.NOT_SUBMITTED,
      latestApplication: latest,
      history,
    };
  }

  async getComplianceQueue(status?: KycStatus, limit: number = 20, skip: number = 0) {
    const query: any = {};
    if (status) query.status = status;
    else query.status = KycStatus.PENDING_REVIEW;

    const [applications, total] = await Promise.all([
      this.kycModel
        .find(query)
        .sort({ createdAt: 1 }) // First in, first reviewed
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email phone createdAt')
        .lean(),
      this.kycModel.countDocuments(query),
    ]);

    return { applications, total, limit, skip };
  }

  async reviewKyc(
    applicationId: string,
    reviewerId: string,
    reviewerRole: Role,
    dto: ReviewKycDto,
  ): Promise<KycApplicationDocument> {
    const application = await this.kycModel.findById(applicationId);
    if (!application) {
      throw new NotFoundException('KYC application not found');
    }

    if (application.status !== KycStatus.PENDING_REVIEW) {
      throw new BadRequestException(`Application has already been resolved with status: ${application.status}`);
    }

    application.status = dto.decision;
    application.reviewedBy = new Types.ObjectId(reviewerId);
    application.reviewNotes = dto.reviewNotes;
    application.rejectionReason = dto.rejectionReason;
    application.reviewedAt = new Date();
    await application.save();

    // Update customer's primary user document
    const user = await this.userModel.findById(application.userId);
    if (user) {
      user.kycStatus = dto.decision;
      await user.save();
    }

    await this.auditService.log({
      actorId: reviewerId,
      actorRole: reviewerRole,
      action: AuditAction.KYC_REVIEWED,
      entityType: 'KycApplication',
      entityId: application._id.toString(),
      details: {
        customerId: application.userId.toString(),
        decision: dto.decision,
        reason: dto.rejectionReason,
      },
    });

    return application;
  }
}
