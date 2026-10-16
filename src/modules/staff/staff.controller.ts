import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, AuditAction } from '@aurumsave/shared';
import { StaffService } from './staff.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Staff & Administration')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly auditService: AuditService,
  ) {}

  @Get('admin/overview')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Platform operational metrics and key performance indicators' })
  async getOverview() {
    const data = await this.staffService.getAdminOverview();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/users')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List and filter platform users' })
  async listUsers(
    @Query('role') role?: Role,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    const result = await this.staffService.listUsers(role, limit, skip);
    return {
      success: true,
      data: result.users,
      meta: { total: result.total, limit: result.limit, skip: result.skip },
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/users/:id/status')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Suspend or activate user account' })
  async setStatus(
    @Param('id') userId: string,
    @Body('isActive') isActive: boolean,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') adminRole: Role,
  ) {
    const result = await this.staffService.setUserActiveStatus(userId, isActive, adminId, adminRole);
    return {
      success: true,
      message: result.message,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/users/:id/role')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign or modify user role (Super Admin exclusive)' })
  async updateRole(
    @Param('id') userId: string,
    @Body('role') role: Role,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') adminRole: Role,
  ) {
    const result = await this.staffService.updateUserRole(userId, role, adminId, adminRole);
    return {
      success: true,
      message: result.message,
      data: result.user,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('operations/reconciliation')
  @Roles(Role.FINANCE_OFFICER, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Automated financial reconciliation report' })
  async getReconciliation() {
    const report = await this.staffService.getReconciliationReport();
    return {
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('audit/events')
  @Roles(Role.AUDITOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Read-only immutable audit trail inspection' })
  async getAuditLogs(
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: string,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ) {
    const result = await this.auditService.getAuditLogs({
      action,
      entityType,
      limit,
      skip,
    });
    return {
      success: true,
      data: result.logs,
      meta: { total: result.total, limit: result.limit, skip: result.skip },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('audit/verify')
  @Roles(Role.AUDITOR, Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Independently verify SHA-256 cryptographic audit chain integrity' })
  async verifyAuditChain(@Query('limit') limit?: number) {
    const result = await this.auditService.verifyChainIntegrity(limit || 100);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}
