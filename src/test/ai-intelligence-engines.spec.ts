import { SavingsAdvisorService } from '../modules/goals/savings-advisor.service';
import { RiskEngineService } from '../modules/ai/risk-engine.service';
import { FinancialIntelligenceService } from '../modules/ai/financial-intelligence.service';
import { StaffCopilotService } from '../modules/ai/staff-copilot.service';
import { KycStatus, OrderType, PurityGrade, PaymentStatus, OrderStatus } from '@aurumsave/shared';

describe('AurumSave AI Intelligence Transformation Suite', () => {
  describe('Pillar 1: Smart Savings & Goal Advisor Engine', () => {
    let advisorService: SavingsAdvisorService;

    beforeEach(() => {
      const mockPriceService = {
        getRateForPurity: jest.fn().mockResolvedValue({ buyPricePerGramBdt: 12450 }),
      };
      advisorService = new SavingsAdvisorService(mockPriceService as any, {} as any);
    });

    it('should compute deterministic scenarios across Conservative (3%), Baseline (9%), and Dynamic (15%) trajectories', async () => {
      const simulation = await advisorService.simulate({
        targetAmountBdt: 150000,
        targetMonths: 12,
        monthlyBudgetBdt: 12000,
      });

      expect(simulation).toBeDefined();
      expect(simulation.feasibilityScore).toBeGreaterThanOrEqual(0);
      expect(simulation.feasibilityScore).toBeLessThanOrEqual(100);
      expect(simulation.scenarios.conservative.projectedMaturityValueBdt).toBeGreaterThan(0);
      expect(simulation.scenarios.baseline.projectedMaturityValueBdt).toBeGreaterThan(
        simulation.scenarios.conservative.projectedMaturityValueBdt,
      );
      expect(simulation.scenarios.dynamic.projectedMaturityValueBdt).toBeGreaterThan(
        simulation.scenarios.baseline.projectedMaturityValueBdt,
      );
      expect(simulation.targetGrams).toBeGreaterThan(0);
      expect(simulation.targetBhori).toBeGreaterThan(0);
    });

    it('should generate grounded bilingual (English and Bangla) advice without hallucination', async () => {
      const simulation = await advisorService.simulate({
        targetAmountBdt: 100000,
        targetMonths: 6,
        monthlyBudgetBdt: 5000,
      });

      expect(simulation.recommendations.bilingualNotes.en.length).toBeGreaterThan(0);
      expect(simulation.recommendations.bilingualNotes.bn.length).toBeGreaterThan(0);
      expect(simulation.recommendations.bilingualNotes.en.length).toBe(
        simulation.recommendations.bilingualNotes.bn.length,
      );

      // Verify mathematical citations
      expect(
        simulation.recommendations.bilingualNotes.en.some((a) => a.includes('BAJUS') || a.includes('BDT') || a.includes('grams') || a.includes('bhori')),
      ).toBe(true);
      expect(
        simulation.recommendations.bilingualNotes.bn.some((a) => a.includes('বাজুস') || a.includes('টাকা') || a.includes('গ্রাম') || a.includes('ভরি')),
      ).toBe(true);
    });

    it('should flag underfunded goals and adjust feasibility score below 60', async () => {
      // 150k target in 1 month with only 1,000 BDT monthly contribution
      const simulation = await advisorService.simulate({
        targetAmountBdt: 150000,
        targetMonths: 1,
        monthlyBudgetBdt: 1000,
      });

      expect(simulation.feasibilityScore).toBeLessThan(60);
      expect(simulation.status).toBe('underfunded');
      expect(simulation.recommendations.suggestedMonthlyBdt).toBeGreaterThan(100000);
    });
  });

  describe('Pillar 2: Fraud & Risk Intelligence Engine', () => {
    let riskEngine: RiskEngineService;
    let mockOrderModel: any;
    let mockPaymentModel: any;
    let mockUserModel: any;

    beforeEach(() => {
      mockOrderModel = {
        countDocuments: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue([{ totalBdt: 10000, avgBdt: 5000 }]),
        find: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([]),
        }),
        findOne: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue(null),
        }),
      };
      mockPaymentModel = {
        countDocuments: jest.fn().mockResolvedValue(0),
      };
      mockUserModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: 'user-123',
            kycStatus: KycStatus.APPROVED,
            createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
          }),
        }),
      };

      riskEngine = new RiskEngineService(mockOrderModel, mockPaymentModel, mockUserModel);
    });

    it('should assign LOW risk and ALLOW action for regular verified transactions', async () => {
      const evaluation = await riskEngine.evaluateTransactionRisk({
        userId: '507f191e810c19729de860ea',
        orderType: OrderType.BUY,
        amountBdt: 5000,
        weightGrams: 0.5,
      });

      expect(evaluation.riskLevel).toBe('LOW');
      expect(evaluation.action).toBe('ALLOW');
      expect(evaluation.riskScore).toBeLessThan(30);
      expect(evaluation.explanation.en.toLowerCase()).toContain('normal');
      expect(evaluation.explanation.bn).toContain('স্বাভাবিক');
    });

    it('should flag unverified accounts attempting elevated transaction amounts', async () => {
      mockUserModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'user-unverified',
          kycStatus: KycStatus.PENDING_REVIEW,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours old
        }),
      });

      const evaluation = await riskEngine.evaluateTransactionRisk({
        userId: '507f191e810c19729de860ea',
        orderType: OrderType.BUY,
        amountBdt: 120000, // Above unverified limit & new account threshold
        weightGrams: 10.0,
      });

      expect(evaluation.riskScore).toBeGreaterThanOrEqual(30);
      expect(
        evaluation.signals.some(
          (s) => s.code === 'UNVERIFIED_ELEVATED_VALUE' || s.code === 'NEW_ACCOUNT_LARGE_TRANSACTION',
        ),
      ).toBe(true);
    });

    it('should trigger CRITICAL risk and HALT_AND_FREEZE on severe burst attacks', async () => {
      mockOrderModel.countDocuments.mockResolvedValue(8);
      mockPaymentModel.countDocuments.mockResolvedValue(6);
      mockOrderModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({
          completedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 mins ago
        }),
      });

      const evaluation = await riskEngine.evaluateTransactionRisk({
        userId: '507f191e810c19729de860ea',
        orderType: OrderType.SELL,
        amountBdt: 200000,
        weightGrams: 20.0,
      });

      expect(evaluation.riskScore).toBeGreaterThanOrEqual(75);
      expect(evaluation.riskLevel).toMatch(/HIGH|CRITICAL/);
      expect(['QUEUE_FOR_STAFF_REVIEW', 'HALT_AND_FREEZE']).toContain(evaluation.action);
    });
  });

  describe('Pillar 3: Financial & Operational Intelligence Engine', () => {
    let financialService: FinancialIntelligenceService;
    let mockLedgerModel: any;
    let mockHoldingModel: any;
    let mockPaymentModel: any;
    let mockOrderModel: any;

    beforeEach(() => {
      mockHoldingModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { userId: 'u1', purity: PurityGrade.K24, weightMilligramsAvailable: 10000 },
            { userId: 'u2', purity: PurityGrade.K22, weightMilligramsAvailable: 15000 },
          ]),
        }),
      };
      mockLedgerModel = {
        aggregate: jest.fn().mockResolvedValue([
          {
            totalCreditGoldMg: 25000,
            totalDebitGoldMg: 0,
            totalCreditPoisha: 25000000,
            totalDebitPoisha: 0,
            totalCount: 2,
          },
        ]),
      };
      mockPaymentModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              paymentId: 'PAY-1',
              orderId: 'ORD-1',
              gateway: 'BKASH',
              amountPoisha: 500000,
              status: PaymentStatus.SUCCESSFUL,
              createdAt: new Date(),
            },
          ]),
        }),
      };
      mockOrderModel = {
        findOne: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            orderId: 'ORD-1',
            status: OrderStatus.COMPLETED,
          }),
        }),
      };

      financialService = new FinancialIntelligenceService(
        mockLedgerModel,
        mockHoldingModel,
        mockPaymentModel,
        mockOrderModel,
      );
    });

    it('should verify double-entry invariant with 0.00mg discrepancy on balanced records', async () => {
      const audit = await financialService.auditDoubleEntryInvariants();

      expect(audit.status).toBe('HEALTHY');
      expect(audit.metrics.goldDiscrepancyMg).toBe(0);
      expect(audit.metrics.isGoldConserved).toBe(true);
      expect(audit.metrics.totalCustomerGoldMg).toBe(25000);
      expect(audit.metrics.negativeHoldingsCount).toBe(0);
      expect(audit.summary.en).toContain('100% verified');
      expect(audit.summary.bn).toContain('নিখুঁতভাবে মিলেছে');
    });

    it('should detect discrepancy when customer holdings deviate from ledger aggregate', async () => {
      // Invariant breach: holdings sum to 30,000mg but ledger only credits 25,000mg
      mockHoldingModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { userId: 'u1', purity: PurityGrade.K24, weightMilligramsAvailable: 30000 },
        ]),
      });

      const audit = await financialService.auditDoubleEntryInvariants();

      expect(audit.status).toBe('DISCREPANCY_DETECTED');
      expect(audit.metrics.goldDiscrepancyMg).toBe(5000);
      expect(audit.metrics.isGoldConserved).toBe(false);
      expect(audit.anomalies.length).toBeGreaterThan(0);
      expect(audit.anomalies[0].type).toBe('GOLD_CONSERVATION_BREACH');
    });

    it('should verify physical vault reserve coverage ratio exceeds 100%', async () => {
      const coverage = await financialService.calculateReserveCoverage();

      expect(coverage.status).toBe('OPTIMAL');
      expect(coverage.reserveCoverageRatioPct).toBeGreaterThanOrEqual(100);
      expect(coverage.allocatedVaultLocations.length).toBe(2);
      expect(coverage.fiatLiquidityReserve.totalLiquidBdt).toBeGreaterThan(0);
      expect(coverage.recommendations.en.length).toBeGreaterThan(0);
      expect(coverage.recommendations.bn.length).toBeGreaterThan(0);
    });
  });

  describe('Pillar 4: Staff AI Copilots', () => {
    let copilotService: StaffCopilotService;
    let mockKycModel: any;
    let mockTicketModel: any;
    let mockMessageModel: any;
    let mockUserModel: any;
    let mockOrderModel: any;
    let mockHoldingModel: any;

    beforeEach(() => {
      mockKycModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: 'kyc-123',
            userId: 'user-123',
            idType: 'NID',
            idNumber: '1985123456', // 10-digit Smart NID
            documents: [
              { docType: 'NID_FRONT', fileName: 'nid_front.jpg' },
              { docType: 'NID_BACK', fileName: 'nid_back.jpg' },
            ],
          }),
        }),
      };
      mockTicketModel = {
        findOne: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            ticketId: 'TCK-1001',
            userId: 'user-123',
            subject: 'bKash payment confirmation',
            category: 'PAYMENT_ISSUE',
          }),
        }),
      };
      mockMessageModel = {};
      mockUserModel = {
        findById: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            _id: 'user-123',
            fullName: 'Farhad Ahmed',
            kycStatus: KycStatus.APPROVED,
          }),
        }),
      };
      mockOrderModel = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue([
            { orderId: 'ORD-999', orderType: OrderType.BUY, totalPoisha: 1200000, status: OrderStatus.COMPLETED },
          ]),
        }),
      };
      mockHoldingModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { purity: PurityGrade.K24, weightMilligramsAvailable: 11664 },
          ]),
        }),
      };

      copilotService = new StaffCopilotService(
        mockKycModel,
        mockTicketModel,
        mockMessageModel,
        mockUserModel,
        mockOrderModel,
        mockHoldingModel,
      );
    });

    it('Compliance Copilot: should validate valid 10-digit Smart NID and recommend APPROVE', async () => {
      const evaluation = await copilotService.evaluateKycApplication('kyc-123');

      expect(evaluation.recommendation).toBe('APPROVE');
      expect(evaluation.riskLevel).toBe('LOW');
      expect(evaluation.confidenceScorePct).toBeGreaterThanOrEqual(90);
      expect(evaluation.checks.every((c) => c.passed)).toBe(true);
      expect(evaluation.explanation.bn).toContain('সফলভাবে উত্তীর্ণ');
    });

    it('Treasury Copilot: should generate actionable rebalancing advice across MFS and bank accounts', async () => {
      const advice = await copilotService.generateTreasuryRebalancingAdvice();

      expect(advice.overallTreasuryHealth).toBe('REBALANCING_RECOMMENDED');
      expect(advice.actionableTransfers.length).toBeGreaterThan(0);
      expect(advice.actionableTransfers[0].priority).toBe('HIGH');
      expect(advice.actionableTransfers[0].reason.en).toBeDefined();
      expect(advice.actionableTransfers[0].reason.bn).toBeDefined();
    });

    it('Support Copilot: should generate grounded dual English & Bangla draft response citing platform rules', async () => {
      const draft = await copilotService.generateSupportResponse('TCK-1001');

      expect(draft.customerName).toBe('Farhad Ahmed');
      expect(draft.draftResponseEn).toContain('Dear Farhad Ahmed');
      expect(draft.draftResponseEn).toContain('bKash');
      expect(draft.draftResponseBn).toContain('প্রিয় Farhad Ahmed');
      expect(draft.draftResponseBn).toContain('বিকাশ');
      expect(draft.groundedPolicyCitation).toContain('MFS Settlement');
      expect(draft.relevantRecentOrders.length).toBe(1);
    });
  });
});
