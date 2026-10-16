import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, KycStatus } from '@aurumsave/shared';
import { KycService } from './kyc.service';
import { SubmitKycDto, ReviewKycDto } from './kyc.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('KYC & Compliance')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('kyc/applications')
  @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Submit KYC identity verification documents' })
  async submitKyc(@CurrentUser('id') userId: string, @Body() dto: SubmitKycDto) {
    const result = await this.kycService.submitKyc(userId, dto);
    return {
      success: true,
      message: 'KYC documents submitted for compliance review',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('kyc/status')
  @ApiOperation({ summary: 'Get current user KYC status and history' })
  async getStatus(@CurrentUser('id') userId: string) {
    const result = await this.kycService.getMyKycStatus(userId);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('compliance/kyc/queue')
  @Roles(Role.KYC_OFFICER, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Compliance Officer KYC verification queue' })
  async getQueue(
    @Query('status') status?: KycStatus,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    const result = await this.kycService.getComplianceQueue(status, limit, skip);
    return {
      success: true,
      data: result.applications,
      meta: { total: result.total, limit: result.limit, skip: result.skip },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('compliance/kyc/:id/review')
  @Roles(Role.KYC_OFFICER, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve, reject, or request correction on KYC application' })
  async reviewApplication(
    @Param('id') applicationId: string,
    @CurrentUser('id') reviewerId: string,
    @CurrentUser('role') reviewerRole: Role,
    @Body() dto: ReviewKycDto,
  ) {
    const result = await this.kycService.reviewKyc(applicationId, reviewerId, reviewerRole, dto);
    return {
      success: true,
      message: `KYC application marked as ${dto.decision}`,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
