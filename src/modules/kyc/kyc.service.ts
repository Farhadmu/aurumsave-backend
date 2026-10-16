import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KycStatus, Role, AuditAction } from '@aurumsave/shared';
import { KycApplication, KycApplicationDocument } from '../../database/schemas/kyc-application.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { AuditService } from '../audit/audit.service';
import { SubmitKycDto, ReviewKycDto } from './kyc.dto';

@Injectable()
export class KycService {
  constructor(
    @InjectModel(KycApplication.name) private readonly kycModel: Model<KycApplicationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly auditService: AuditService,
  ) {}

  async submitKyc(userId: string, dto: SubmitKycDto): Promise<KycApplicationDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KycStatus.APPROVED) {
      throw new BadRequestException('Your KYC is already approved and verified');
    }

    const application = await this.kycModel.create({
      userId: userObjectId,
      status: KycStatus.PENDING_REVIEW,
      idType: dto.idType,
      idNumber: dto.idNumber,
      documents: dto.documents.map((d) => ({
        ...d,
        uploadedAt: new Date(),
      })),
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
