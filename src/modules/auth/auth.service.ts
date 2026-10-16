import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Role, KycStatus, AuditAction, PurityGrade, CONVERSIONS } from '@aurumsave/shared';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { CustomerProfile, CustomerProfileDocument } from '../../database/schemas/customer-profile.schema';
import { GoldHolding, GoldHoldingDocument } from '../../database/schemas/gold-holding.schema';
import { AuditService } from '../audit/audit.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from './auth.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  public static readonly DEMO_USERS = [
    {
      email: 'superadmin@aurumsave.com',
      password: 'Aurum#SuperAdmin2026!',
      fullName: 'Chief Executive Administrator',
      phone: '+8801700000001',
      role: Role.SUPER_ADMIN,
      kycStatus: KycStatus.APPROVED,
    },
    {
      email: 'compliance@aurumsave.com',
      password: 'Aurum#Compliance2026!',
      fullName: 'Tariqul Islam (Compliance Head)',
      phone: '+8801700000002',
      role: Role.KYC_OFFICER,
      kycStatus: KycStatus.APPROVED,
    },
    {
      email: 'finance@aurumsave.com',
      password: 'Aurum#Finance2026!',
      fullName: 'Nazia Rahman (Treasury Operations)',
      phone: '+8801700000003',
      role: Role.FINANCE_OFFICER,
      kycStatus: KycStatus.APPROVED,
    },
    {
      email: 'support@aurumsave.com',
      password: 'Aurum#Support2026!',
      fullName: 'Sadia Ahmed (Customer Care Lead)',
      phone: '+8801700000004',
      role: Role.SUPPORT_AGENT,
      kycStatus: KycStatus.APPROVED,
    },
    {
      email: 'auditor@aurumsave.com',
      password: 'Aurum#Auditor2026!',
      fullName: 'External Risk & Security Auditor',
      phone: '+8801700000005',
      role: Role.AUDITOR,
      kycStatus: KycStatus.APPROVED,
    },
    {
      email: 'customer@aurumsave.com',
      password: 'Aurum#Customer2026!',
      fullName: 'Mohammad Farhan Chowdhury',
      phone: '+8801712345678',
      role: Role.CUSTOMER,
      kycStatus: KycStatus.APPROVED,
    },
  ];

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(CustomerProfile.name) private readonly profileModel: Model<CustomerProfileDocument>,
    @InjectModel(GoldHolding.name) private readonly holdingModel: Model<GoldHoldingDocument>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureSeedUsers();
  }

  async ensureSeedUsers() {
    if (this.configService.get<string>('DISABLE_DEMO_SEED') === 'true') {
      return;
    }

    try {
      const salt = await bcrypt.genSalt(10);
      for (const item of AuthService.DEMO_USERS) {
        const existing = await this.userModel.findOne({ email: item.email }).select('+passwordHash');
        if (!existing) {
          const passwordHash = await bcrypt.hash(item.password, salt);
          const user = await this.userModel.create({
            email: item.email,
            passwordHash,
            fullName: item.fullName,
            phone: item.phone,
            role: item.role,
            kycStatus: item.kycStatus,
            isActive: true,
            isEmailVerified: true,
          });

          if (user.role === Role.CUSTOMER) {
            await this.profileModel.findOneAndUpdate(
              { userId: user._id },
              {
                userId: user._id,
                nidNumber: '19922692015000123',
                occupation: 'Private Service',
                address: {
                  addressLine1: 'Road 11, Banani',
                  city: 'Dhaka',
                  district: 'Dhaka',
                  division: 'Dhaka',
                  postalCode: '1213',
                },
              },
              { upsert: true },
            );

            const holdingCount = await this.holdingModel.countDocuments({ userId: user._id });
            if (holdingCount === 0) {
              const k24Grams = 10;
              const k22Grams = 5;
              await this.holdingModel.create([
                {
                  userId: user._id,
                  purity: PurityGrade.K24,
                  weightMilligramsAvailable: k24Grams * CONVERSIONS.MILLIGRAMS_PER_GRAM,
                  weightMilligramsPending: 0,
                  totalCostPoisha: k24Grams * 12450 * CONVERSIONS.POISHA_PER_BDT,
                  averageCostPerMilligramPoisha: Math.round((12450 * CONVERSIONS.POISHA_PER_BDT) / 1000),
                },
                {
                  userId: user._id,
                  purity: PurityGrade.K22,
                  weightMilligramsAvailable: k22Grams * CONVERSIONS.MILLIGRAMS_PER_GRAM,
                  weightMilligramsPending: 0,
                  totalCostPoisha: k22Grams * 11412 * CONVERSIONS.POISHA_PER_BDT,
                  averageCostPerMilligramPoisha: Math.round((11412 * CONVERSIONS.POISHA_PER_BDT) / 1000),
                },
                {
                  userId: user._id,
                  purity: PurityGrade.K21,
                  weightMilligramsAvailable: 0,
                  weightMilligramsPending: 0,
                  totalCostPoisha: 0,
                  averageCostPerMilligramPoisha: 0,
                },
                {
                  userId: user._id,
                  purity: PurityGrade.K18,
                  weightMilligramsAvailable: 0,
                  weightMilligramsPending: 0,
                  totalCostPoisha: 0,
                  averageCostPerMilligramPoisha: 0,
                },
              ]);
            }
          }
          this.logger.log(`[BOOTSTRAP] Demo evaluation account created: ${item.email} (${item.role})`);
        } else {
          // If user exists, ensure password and verification status are aligned with documented credentials
          const isMatch = await bcrypt.compare(item.password, existing.passwordHash);
          if (!isMatch || !existing.isEmailVerified || !existing.isActive || existing.role !== item.role) {
            existing.passwordHash = await bcrypt.hash(item.password, salt);
            existing.isEmailVerified = true;
            existing.isActive = true;
            existing.role = item.role;
            existing.kycStatus = KycStatus.APPROVED;
            await existing.save();
            this.logger.log(`[BOOTSTRAP] Updated credentials & verification for demo account: ${item.email}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Failed to ensure demo evaluation accounts on startup: ${err.message}`);
    }
  }

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const autoVerify = this.configService.get<string>('AUTO_VERIFY_EMAILS') === 'true' || !isProd;
    const emailVerificationToken = !autoVerify ? crypto.randomBytes(32).toString('hex') : undefined;

    const user = await this.userModel.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      role: Role.CUSTOMER, // Strict server-enforced role boundary: public registration can only create customer accounts
      kycStatus: KycStatus.NOT_SUBMITTED,
      isActive: true,
      isEmailVerified: autoVerify,
      emailVerificationToken,
    });

    // Initialize customer profile if role is customer
    if (user.role === Role.CUSTOMER) {
      await this.profileModel.create({
        userId: user._id,
      });

      // Initialize holdings for 24K and 22K with 0 balance
      const purities = [PurityGrade.K24, PurityGrade.K22, PurityGrade.K21, PurityGrade.K18];
      for (const purity of purities) {
        await this.holdingModel.create({
          userId: user._id,
          purity,
          weightMilligramsAvailable: 0,
          weightMilligramsPending: 0,
          totalCostPoisha: 0,
          averageCostPerMilligramPoisha: 0,
        });
      }
    }

    await this.auditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AuditAction.USER_REGISTERED,
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email, role: user.role },
      ipAddress,
      userAgent,
    });

    const token = this.generateToken(user);

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus,
        isActive: user.isActive,
      },
      token,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .select('+passwordHash');

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been suspended. Please contact AurumSave compliance.');
    }

    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    if (isProd && !user.isEmailVerified) {
      throw new UnauthorizedException('Email verification is required before logging into production.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      await this.auditService.log({
        actorRole: Role.CUSTOMER,
        action: AuditAction.SYSTEM_ALERT,
        entityType: 'User',
        entityId: user._id.toString(),
        details: { reason: 'FAILED_LOGIN_ATTEMPT', email: user.email },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    user.lastLoginAt = new Date();
    await user.save();

    await this.auditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AuditAction.USER_LOGGED_IN,
      entityType: 'User',
      entityId: user._id.toString(),
      details: { email: user.email },
      ipAddress,
      userAgent,
    });

    const token = this.generateToken(user);

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus,
        isActive: user.isActive,
      },
      token,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).select('+passwordHash');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(dto.newPassword, salt);
    await user.save();

    await this.auditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: user._id.toString(),
    });

    return { message: 'Password updated successfully' };
  }

  async getProfileWithDetails(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.profileModel.findOne({ userId: user._id }).lean();

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
      },
      profile: profile || null,
    };
  }

  async updateProfile(userId: string, dto: any) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.fullName) user.fullName = dto.fullName;
    if (dto.phone) user.phone = dto.phone;
    await user.save();

    let profile = await this.profileModel.findOne({ userId: user._id });
    if (!profile) {
      profile = await this.profileModel.create({ userId: user._id });
    }

    if (dto.occupation) profile.occupation = dto.occupation;
    if (dto.address) profile.address = { ...profile.address, ...dto.address };
    if (dto.nominee) profile.nominee = { ...profile.nominee, ...dto.nominee };
    if (dto.preferredBkashNumber) profile.preferredBkashNumber = dto.preferredBkashNumber;
    if (dto.bankDetails) profile.bankDetails = { ...profile.bankDetails, ...dto.bankDetails };
    await profile.save();

    await this.auditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AuditAction.PROFILE_UPDATED,
      entityType: 'User',
      entityId: user._id.toString(),
      details: { updatedFields: Object.keys(dto) },
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        kycStatus: user.kycStatus,
      },
      profile,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't disclose whether email exists
      return {
        success: true,
        message: 'If an account with that email exists, password reset instructions have been generated.',
      };
    }

    const resetToken = require('crypto').randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await this.auditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AuditAction.SYSTEM_ALERT,
      entityType: 'User',
      entityId: user._id.toString(),
      details: { event: 'PASSWORD_RESET_REQUESTED', email: user.email },
    });

    return {
      success: true,
      message: 'Password reset token generated. Verification email delivery requires an active SMTP provider integration.',
      resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
    };
  }

  async resetPassword(token: string, newPass: string) {
    const user = await this.userModel
      .findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      })
      .select('+passwordHash +passwordResetToken +passwordResetExpires');

    if (!user) {
      throw new BadRequestException('Password reset token is invalid or has expired');
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPass, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    await this.auditService.log({
      actorId: user._id,
      actorRole: user.role,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: user._id.toString(),
      details: { method: 'TOKEN_RESET' },
    });

    return { message: 'Password has been reset successfully. You may now log in.' };
  }

  async verifyEmail(userIdOrToken: string, token?: string) {
    if (!userIdOrToken && !token) {
      throw new BadRequestException('Verification token or user identification is required');
    }

    let user: UserDocument | null = null;
    const lookupToken = token || (userIdOrToken && !/^[0-9a-fA-F]{24}$/.test(userIdOrToken) ? userIdOrToken : null);

    if (lookupToken) {
      user = await this.userModel.findOne({ emailVerificationToken: lookupToken }).select('+emailVerificationToken');
    }

    if (!user && userIdOrToken && /^[0-9a-fA-F]{24}$/.test(userIdOrToken)) {
      user = await this.userModel.findById(userIdOrToken);
    }

    if (!user) {
      throw new BadRequestException('Invalid or expired email verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    return { message: 'Email address verified successfully' };
  }

  async logout(userId: string, role: Role) {
    await this.auditService.log({
      actorId: userId,
      actorRole: role,
      action: AuditAction.USER_LOGGED_OUT,
      entityType: 'User',
      entityId: userId,
    });
    return { success: true, message: 'Logged out successfully' };
  }

  private generateToken(user: UserDocument): string {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    return this.jwtService.sign(payload);
  }
}
