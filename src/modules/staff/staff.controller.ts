import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Role,
  AuditAction,
  DualApprovalOperation,
  DualApprovalStatus,
  PurchaseOrderStatus,
  CmsContentType,
} from '@aurumsave/shared';
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

  // ==========================================
  // MODULE 1: BUSINESS OVERVIEW & ANALYTICS
  // ==========================================
  @Get('admin/overview')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'Platform operational metrics and key performance indicators' })
  async getOverview() {
    const data = await this.staffService.getAdminOverview();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================
  // MODULE 2: GOLD MARGINS & SOURCING ECONOMICS
  // ==========================================
  @Get('admin/margins')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE_OFFICER, Role.AUDITOR)
  @ApiOperation({ summary: 'Real-time gold margin, unit economics and sourcing cost analysis' })
  async getMargins() {
    const data = await this.staffService.getGoldMarginAnalysis();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================
  // MODULE 2B: SUPPLIERS & PURCHASE ORDERS
  // ==========================================
  @Get('admin/suppliers')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE_OFFICER, Role.AUDITOR)
  @ApiOperation({ summary: 'List wholesale bullion suppliers and current procurement quotes' })
  async getSuppliers() {
    const data = await this.staffService.getSuppliers();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/suppliers')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create or update wholesale bullion supplier' })
  async upsertSupplier(
    @Body() dto: any,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') adminRole: Role,
  ) {
    const result = await this.staffService.upsertSupplier(dto, adminId, adminRole);
    return {
      success: true,
      data: result.supplier,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('admin/purchase-orders')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE_OFFICER, Role.AUDITOR)
  @ApiOperation({ summary: 'List wholesale bullion purchase orders' })
  async getPurchaseOrders() {
    const data = await this.staffService.getPurchaseOrders();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/purchase-orders')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create wholesale bullion purchase order' })
  async createPurchaseOrder(
    @Body() dto: any,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') adminRole: Role,
  ) {
    const result = await this.staffService.createPurchaseOrder(dto, adminId, adminRole);
    return {
      success: true,
      data: result.purchaseOrder,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/purchase-orders/:poNumber/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FINANCE_OFFICER)
  @ApiOperation({ summary: 'Update purchase order status' })
  async updatePurchaseOrderStatus(
    @Param('poNumber') poNumber: string,
    @Body('status') status: PurchaseOrderStatus,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') adminRole: Role,
  ) {
    const result = await this.staffService.updatePurchaseOrderStatus(poNumber, status, adminId, adminRole);
    return {
      success: true,
      data: result.purchaseOrder,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================
  // MODULE 2C: PHYSICAL VAULT CUSTODY RECORDS
  // ==========================================
  @Get('admin/vault-custody')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE_OFFICER, Role.AUDITOR)
  @ApiOperation({ summary: 'List vaulted physical bullion bars, serials, and assay certificates' })
  async getVaultCustody() {
    const data = await this.staffService.getVaultCustodyRecords();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/vault-custody')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Add certified bullion bar to physical vault registry' })
  async addVaultRecord(
    @Body() dto: any,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') adminRole: Role,
  ) {
    const result = await this.staffService.addVaultCustodyRecord(dto, adminId, adminRole);
    return {
      success: true,
      data: result.vaultRecord,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================
  // MODULE 3: CUSTOMER & ACCOUNT RESTRICTIONS
  // ==========================================
  @Get('admin/users')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR)
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

  @Post('admin/users/:id/freeze')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Freeze or unfreeze customer account with mandatory reason' })
  async setAccountFreeze(
    @Param('id') userId: string,
    @Body('isFrozen') isFrozen: boolean,
    @Body('reason') reason: string,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') adminRole: Role,
  ) {
    const result = await this.staffService.setUserAccountFreeze(userId, isFrozen, reason || 'Administrative freeze', adminId, adminRole);
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

  // ==========================================
  // MODULE 4: RECONCILIATION & AUDIT
  // ==========================================
  @Get('operations/reconciliation')
  @Roles(Role.FINANCE_OFFICER, Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'Automated financial reconciliation report' })
  async getReconciliation() {
    const report = await this.staffService.getReconciliationReport();
    return {
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('operations/reports/financial')
  @Roles(Role.FINANCE_OFFICER, Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'Comprehensive financial statement and volume report' })
  async getFinancialReports() {
    const report = await this.staffService.getFinancialReports();
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

  // ==========================================
  // MODULE 5: DUAL APPROVAL MAKER-CHECKER ENGINE
  // ==========================================
  @Get('admin/dual-approvals')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'List dual-approval requests' })
  async listDualApprovals(@Query('status') status?: DualApprovalStatus) {
    const data = await this.staffService.listDualApprovals(status);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/dual-approvals')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Submit dual-approval request for high-risk operation' })
  async createDualApproval(
    @Body() dto: { operationType: DualApprovalOperation; payload: Record<string, any>; reason: string },
    @CurrentUser('id') makerId: string,
    @CurrentUser('role') makerRole: Role,
    @CurrentUser('email') makerEmail: string,
  ) {
    const result = await this.staffService.createDualApprovalRequest(dto, makerId, makerRole, makerEmail);
    return {
      success: true,
      message: result.message,
      data: result.request,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/dual-approvals/:requestId/decide')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Approve or reject a dual-approval request (Checker != Maker)' })
  async decideDualApproval(
    @Param('requestId') requestId: string,
    @Body('decision') decision: 'APPROVED' | 'REJECTED',
    @Body('note') note: string,
    @CurrentUser('id') checkerId: string,
    @CurrentUser('role') checkerRole: Role,
    @CurrentUser('email') checkerEmail: string,
  ) {
    const result = await this.staffService.decideDualApprovalRequest(
      requestId,
      decision,
      note || 'Dual approval decision recorded',
      checkerId,
      checkerRole,
      checkerEmail,
    );
    return {
      success: true,
      message: result.message,
      data: result.request,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================
  // MODULE 6: AI ADVISOR CONFIGURATION
  // ==========================================
  @Get('admin/ai/config')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'Get AI Advisor configuration and parameters' })
  async getAiConfig() {
    const data = await this.staffService.getAiAdvisorSettings();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/ai/config')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Update AI Advisor model, prompt version, and guardrails' })
  async updateAiConfig(
    @Body() config: any,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') adminRole: Role,
  ) {
    const result = await this.staffService.updateAiAdvisorSettings(config, adminId, adminRole);
    return {
      success: true,
      message: result.message,
      data: result.config,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================
  // MODULE 7: HOMEPAGE CMS & BILINGUAL CONTENT
  // ==========================================
  @Get('admin/cms')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'List CMS content items' })
  async getCms(@Query('contentType') contentType?: CmsContentType) {
    const data = await this.staffService.getCmsContents(contentType);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/cms')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Publish or update bilingual CMS content' })
  async upsertCms(
    @Body() dto: any,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') adminRole: Role,
  ) {
    const result = await this.staffService.upsertCmsContent(dto, adminId, adminRole);
    return {
      success: true,
      data: result.content,
      timestamp: new Date().toISOString(),
    };
  }

  // ==========================================
  // MODULE 8: PLATFORM SETTINGS & EMERGENCY CONTROLS
  // ==========================================
  @Get('admin/settings')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR)
  @ApiOperation({ summary: 'Get platform operational configurations and compliance limits' })
  async getSettings() {
    const settings = await this.staffService.getPlatformSettings();
    return {
      success: true,
      data: settings,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('admin/settings')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Modify platform configuration (Super Admin / Admin)' })
  async updateSetting(
    @Body('key') key: string,
    @Body('value') value: any,
    @Body('description') description: string,
    @CurrentUser('id') adminId: string,
    @CurrentUser('role') adminRole: Role,
  ) {
    const result = await this.staffService.updatePlatformSetting(key, value, description, adminId, adminRole);
    return {
      success: true,
      message: result.message,
      data: result.setting,
      timestamp: new Date().toISOString(),
    };
  }
}
