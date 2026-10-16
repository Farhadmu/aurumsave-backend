import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role, KycStatus, AuditAction, PurityGrade } from '@aurumsave/shared';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { CustomerProfile, CustomerProfileDocument } from '../../database/schemas/customer-profile.schema';
import { GoldHolding, GoldHoldingDocument } from '../../database/schemas/gold-holding.schema';
import { AuditService } from '../audit/audit.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(CustomerProfile.name) private readonly profileModel: Model<CustomerProfileDocument>,
    @InjectModel(GoldHolding.name) private readonly holdingModel: Model<GoldHoldingDocument>,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.userModel.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      role: Role.CUSTOMER, // Strict server-enforced role boundary: public registration can only create customer accounts
      kycStatus: KycStatus.NOT_SUBMITTED,
      isActive: true,
      isEmailVerified: true, // Auto-verified for seamless MVP experience
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

  async verifyEmail(userId: string, token?: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
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
