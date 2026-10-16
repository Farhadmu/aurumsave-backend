import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, OrderType } from '@aurumsave/shared';
import { AiService } from './ai.service';
import { RiskEngineService } from './risk-engine.service';
import { FinancialIntelligenceService } from './financial-intelligence.service';
import { StaffCopilotService } from './staff-copilot.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('AI Intelligence & Autonomous Engines')
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly riskEngineService: RiskEngineService,
    private readonly financialIntelligenceService: FinancialIntelligenceService,
    private readonly staffCopilotService: StaffCopilotService,
  ) {}

  /**
   * Public / Authenticated grounded FAQ & knowledge base assistant
   */
  @Post('assistant')
  @ApiOperation({ summary: 'Ask grounded questions regarding gold savings, BAJUS rates, and policies' })
  async askAssistant(@Body('query') query: string) {
    if (!query || query.trim() === '') {
      return {
        success: false,
        message: 'Query string is required',
        timestamp: new Date().toISOString(),
      };
    }
    const response = await this.aiService.askAssistant(query);
    return {
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Risk Intelligence Evaluation endpoint
   */
  @Post('risk/evaluate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE_OFFICER, Role.KYC_OFFICER, Role.AUDITOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Evaluate multi-signal fraud, velocity, and transaction risk' })
  async evaluateRisk(
    @Body()
    body: {
      userId: string;
      orderType: OrderType;
      amountBdt: number;
      weightGrams: number;
      ipAddress?: string;
    },
  ) {
    const result = await this.riskEngineService.evaluateTransactionRisk(body);
    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Financial Intelligence: Double-entry ledger invariants
   */
  @Get('financial/invariants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR, Role.FINANCE_OFFICER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Automated double-entry ledger & vault balance conservation check' })
  async auditInvariants() {
    const data = await this.financialIntelligenceService.auditDoubleEntryInvariants();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Financial Intelligence: Payment Gateway Settlement Reconciliation
   */
  @Get('financial/reconciliation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR, Role.FINANCE_OFFICER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Automated gateway settlement reconciliation and orphan detection' })
  async auditReconciliation(@Query('hours') hours?: string) {
    const windowHours = hours ? parseInt(hours, 10) : 48;
    const data = await this.financialIntelligenceService.auditGatewaySettlements(windowHours);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Financial Intelligence: Physical Vault Reserve Coverage
   */
  @Get('financial/reserve-coverage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.AUDITOR, Role.FINANCE_OFFICER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Physical bullion vault inventory vs digital customer liabilities' })
  async auditReserveCoverage() {
    const data = await this.financialIntelligenceService.calculateReserveCoverage();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Staff Copilot: Compliance KYC Verification Assistant
   */
  @Post('copilot/kyc/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.KYC_OFFICER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Compliance Copilot KYC verification and BFIU sanction analysis' })
  async evaluateKyc(@Param('id') id: string) {
    const data = await this.staffCopilotService.evaluateKycApplication(id);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Staff Copilot: Treasury Cash Rebalancing Assistant
   */
  @Get('copilot/treasury')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.FINANCE_OFFICER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Treasury Copilot liquidity rebalancing recommendations' })
  async getTreasuryAdvice() {
    const data = await this.staffCopilotService.generateTreasuryRebalancingAdvice();
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Staff Copilot: Customer Support Ticket Response Drafter
   */
  @Post('copilot/support/:ticketId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT_AGENT, Role.FINANCE_OFFICER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer Support Copilot bilingual grounded response drafter' })
  async draftSupportResponse(@Param('ticketId') ticketId: string) {
    const data = await this.staffCopilotService.generateSupportResponse(ticketId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
