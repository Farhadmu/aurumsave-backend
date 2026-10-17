import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  Role,
  DualApprovalOperation,
  DualApprovalStatus,
  VaultCustodyStatus,
  PurchaseOrderStatus,
  CmsContentType,
  PurityGrade,
} from '@aurumsave/shared';
import { StaffService } from '../modules/staff/staff.service';
import { AuditService } from '../modules/audit/audit.service';
import { User } from '../database/schemas/user.schema';
import { Order } from '../database/schemas/order.schema';
import { Payment } from '../database/schemas/payment.schema';
import { LedgerEntry } from '../database/schemas/ledger-entry.schema';
import { GoldHolding } from '../database/schemas/gold-holding.schema';
import { SupportTicket } from '../database/schemas/support-ticket.schema';
import { PlatformSetting } from '../database/schemas/platform-setting.schema';
import { DualApprovalRequest } from '../database/schemas/dual-approval.schema';
import { Supplier } from '../database/schemas/supplier.schema';
import { VaultCustodyRecord } from '../database/schemas/vault-custody.schema';
import { PurchaseOrder } from '../database/schemas/purchase-order.schema';
import { CmsContent } from '../database/schemas/cms-content.schema';
import { GoldPrice } from '../database/schemas/gold-price.schema';

describe('Super Admin Control Center — Comprehensive Test Suite', () => {
  let service: StaffService;

  // Mock collections
  let mockUserModel: any;
  let mockOrderModel: any;
  let mockPaymentModel: any;
  let mockLedgerModel: any;
  let mockHoldingModel: any;
  let mockTicketModel: any;
  let mockSettingModel: any;
  let mockApprovalModel: any;
  let mockSupplierModel: any;
  let mockVaultModel: any;
  let mockPoModel: any;
  let mockCmsModel: any;
  let mockPriceModel: any;
  let mockAuditService: any;

  beforeEach(async () => {
    mockUserModel = {
      countDocuments: jest.fn().mockResolvedValue(150),
      find: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    };

    mockOrderModel = {
      countDocuments: jest.fn().mockResolvedValue(85),
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { totalPoisha: 1245000, orderType: 'BUY', status: 'COMPLETED', weightMilligrams: 1000 },
          { totalPoisha: 607500, orderType: 'SELL', status: 'COMPLETED', weightMilligrams: 500 },
        ]),
      }),
    };

    mockPaymentModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { paymentId: 'PAY-1', orderId: 'ORD-1', amountPoisha: 1245000, status: 'SUCCESSFUL' },
        ]),
      }),
    };

    mockLedgerModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { paymentId: 'PAY-1', type: 'GOLD_PURCHASE', creditGoldMg: 1000, debitGoldMg: 0 },
        ]),
      }),
    };

    mockHoldingModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { weightMilligramsAvailable: 1000, weightMilligramsPending: 0 },
        ]),
      }),
    };

    mockTicketModel = {
      countDocuments: jest.fn().mockResolvedValue(2),
    };

    mockSettingModel = {
      find: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
      findOne: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ key: 'TEST', value: true }),
    };

    mockApprovalModel = {
      countDocuments: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, _id: new Types.ObjectId() })),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
      findOne: jest.fn(),
    };

    mockSupplierModel = {
      countDocuments: jest.fn().mockResolvedValue(2),
      create: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockImplementation(() => {
        const result = [
          {
            supplierId: 'SUP-001',
            name: 'Bangladesh Bullion & Refinery Ltd.',
            purityGradesOffered: [PurityGrade.K24, PurityGrade.K22],
            currentBidQuotePoishaPerGram: 1205000,
            currentAskQuotePoishaPerGram: 1215000,
            isActive: true,
          },
        ];
        return {
          sort: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(result),
          }),
          lean: jest.fn().mockResolvedValue(result),
        };
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ supplierId: 'SUP-001' }),
    };

    mockVaultModel = {
      countDocuments: jest.fn().mockResolvedValue(3),
      create: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              recordId: 'VLT-1',
              purity: PurityGrade.K24,
              weightGrams: 100.0,
              weightMilligrams: 100000,
              status: VaultCustodyStatus.IN_VAULT,
            },
          ]),
        }),
        lean: jest.fn().mockResolvedValue([
          {
            recordId: 'VLT-1',
            purity: PurityGrade.K24,
            weightGrams: 100.0,
            weightMilligrams: 100000,
            status: VaultCustodyStatus.IN_VAULT,
          },
        ]),
      }),
    };

    mockPoModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
      create: jest.fn().mockImplementation((d) => Promise.resolve({ ...d, _id: new Types.ObjectId() })),
      findOne: jest.fn(),
    };

    mockCmsModel = {
      countDocuments: jest.fn().mockResolvedValue(3),
      create: jest.fn().mockResolvedValue([]),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
      findOneAndUpdate: jest.fn().mockResolvedValue({ slug: 'test' }),
    };

    mockPriceModel = {
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              purity: PurityGrade.K24,
              buyPricePerGramPoisha: 1245000, // ৳12,450/g retail sell
              sellPricePerGramPoisha: 1215000, // ৳12,150/g retail buyback
            },
          ]),
        }),
      }),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue({ logId: 'LOG-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: getModelToken(Payment.name), useValue: mockPaymentModel },
        { provide: getModelToken(LedgerEntry.name), useValue: mockLedgerModel },
        { provide: getModelToken(GoldHolding.name), useValue: mockHoldingModel },
        { provide: getModelToken(SupportTicket.name), useValue: mockTicketModel },
        { provide: getModelToken(PlatformSetting.name), useValue: mockSettingModel },
        { provide: getModelToken(DualApprovalRequest.name), useValue: mockApprovalModel },
        { provide: getModelToken(Supplier.name), useValue: mockSupplierModel },
        { provide: getModelToken(VaultCustodyRecord.name), useValue: mockVaultModel },
        { provide: getModelToken(PurchaseOrder.name), useValue: mockPoModel },
        { provide: getModelToken(CmsContent.name), useValue: mockCmsModel },
        { provide: getModelToken(GoldPrice.name), useValue: mockPriceModel },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<StaffService>(StaffService);
  });

  describe('Module 1: Business Overview & Vault Coverage Metrics', () => {
    it('calculates real-time GMV, vault physical gold backing, and customer liabilities', async () => {
      const overview = await service.getAdminOverview();
      expect(overview.totalCustomers).toBe(150);
      expect(overview.totalOrdersCount).toBe(85);
      expect(overview.totalVolumeBdt).toBeGreaterThan(0);
      expect(overview.totalCustomerLiabilitiesGrams).toBe(1.0); // 1,000 mg
      expect(overview.totalVaultPhysicalGrams).toBe(100.0); // 100,000 mg
      expect(overview.vaultCoverageRatio).toBeGreaterThanOrEqual(100);
      expect(overview.isVaultFullyBacked).toBe(true);
      expect(overview.systemStatus).toBe('HEALTHY');
    });
  });

  describe('Module 2: Gold Margin & Unit Economics Calculator', () => {
    it('computes gross margin and net contribution margin against wholesale supplier sourcing quotes', async () => {
      const margins = await service.getGoldMarginAnalysis();
      expect(margins.length).toBeGreaterThan(0);
      const k24 = margins.find((m) => m.purity === PurityGrade.K24);
      expect(k24).toBeDefined();
      expect(k24?.retailSellPricePerGramBdt).toBe(12450);
      expect(k24?.sourcingCostPerGramBdt).toBe(12150);
      expect(k24?.grossMarginPerGramBdt).toBe(300); // 12,450 - 12,150 = 300
      expect(k24?.grossMarginPercentage).toBeCloseTo(2.41, 1);
      expect(k24?.marginHealth).toBe('HEALTHY');
    });
  });

  describe('Module 5: Four-Eyes Maker-Checker Dual Approval Workflow', () => {
    it('creates a pending dual-approval request and logs audit event', async () => {
      const result = await service.createDualApprovalRequest(
        {
          operationType: DualApprovalOperation.EMERGENCY_KILLSWITCH,
          payload: { key: 'HALT_ALL_TRADING', value: true },
          reason: 'Excessive market volatility halt',
        },
        '65a123456789012345678901',
        Role.ADMIN,
        'maker@aurumsave.com',
      );

      expect(result.success).toBe(true);
      expect(result.request.status).toBe(DualApprovalStatus.PENDING);
      expect(mockAuditService.log).toHaveBeenCalled();
    });

    it('PREVENTS maker from approving their own request (Segregation of Duties)', async () => {
      const makerId = '65a123456789012345678901';
      mockApprovalModel.findOne.mockResolvedValue({
        requestId: 'APR-123456',
        makerId: new Types.ObjectId(makerId),
        status: DualApprovalStatus.PENDING,
      });

      await expect(
        service.decideDualApprovalRequest(
          'APR-123456',
          'APPROVED',
          'Attempted self-approval',
          makerId, // Same as maker!
          Role.SUPER_ADMIN,
          'maker@aurumsave.com',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a distinct authorized checker to approve request and executes action', async () => {
      const makerId = '65a123456789012345678901';
      const checkerId = '65b987654321098765432109'; // Different staff

      const mockRequest = {
        requestId: 'APR-123456',
        makerId: new Types.ObjectId(makerId),
        status: DualApprovalStatus.PENDING,
        operationType: DualApprovalOperation.EMERGENCY_KILLSWITCH,
        payload: { key: 'HALT_ALL_TRADING', value: true },
        save: jest.fn().mockResolvedValue(true),
      };
      mockApprovalModel.findOne.mockResolvedValue(mockRequest);

      const result = await service.decideDualApprovalRequest(
        'APR-123456',
        'APPROVED',
        'Verified circuit breaker criteria met',
        checkerId,
        Role.SUPER_ADMIN,
        'checker@aurumsave.com',
      );

      expect(result.success).toBe(true);
      expect(mockRequest.status).toBe(DualApprovalStatus.APPROVED);
      expect(mockSettingModel.findOneAndUpdate).toHaveBeenCalledWith(
        { key: 'HALT_ALL_TRADING' },
        expect.anything(),
        { upsert: true },
      );
    });
  });

  describe('Module 7: Bilingual CMS Studio', () => {
    it('creates or publishes localized content with English and Bengali text', async () => {
      const result = await service.upsertCmsContent(
        {
          slug: 'promo-eid-special',
          contentType: CmsContentType.ANNOUNCEMENT,
          titleEn: 'Zero Making Charges Eid Bullion',
          titleBn: 'ঈদ স্পেশাল ০% মেকিং চার্জ',
          bodyEn: 'Save more on pure 24K bullion bars.',
          bodyBn: 'খাঁটি ২৪ ক্যারেট স্বর্ণে সর্বোচ্চ সাশ্রয়।',
          isPublished: true,
        },
        '65a123456789012345678901',
        Role.SUPER_ADMIN,
      );

      expect(result.success).toBe(true);
      expect(mockCmsModel.findOneAndUpdate).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe('Module 8: Emergency Killswitches & Security Controls', () => {
    it('allows Super Admin to update emergency killswitch setting', async () => {
      const result = await service.updatePlatformSetting(
        'HALT_ALL_TRADING',
        true,
        'Market halt triggered during severe price fluctuation',
        '65a123456789012345678901',
        Role.SUPER_ADMIN,
      );

      expect(result.success).toBe(true);
      expect(mockSettingModel.findOneAndUpdate).toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });
});
