import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { GiftService } from '../modules/gifts/gift.service';
import { GoldGift, GiftStatus } from '../database/schemas/gold-gift.schema';
import { GoldHolding } from '../database/schemas/gold-holding.schema';
import { LedgerEntry } from '../database/schemas/ledger-entry.schema';
import { User } from '../database/schemas/user.schema';
import { AuditService } from '../modules/audit/audit.service';
import { PriceService } from '../modules/prices/price.service';
import { Role, PurityGrade } from '@aurumsave/shared';
import { SupportService } from '../modules/support/support.service';
import { SupportTicket } from '../database/schemas/support-ticket.schema';
import { SupportMessage } from '../database/schemas/support-message.schema';

describe('Phase 3: P2P Gold Gifting, Family Goals & Dispute Escalation', () => {
  let giftService: GiftService;
  let supportService: SupportService;

  const mockSenderId = new Types.ObjectId();
  const mockRecipientId = new Types.ObjectId();

  const mockSenderUser = {
    _id: mockSenderId,
    fullName: 'Mohammad Farhad',
    email: 'farhad@aurumsave.com',
    phone: '01711223344',
    isActive: true,
    isAccountFrozen: false,
    role: Role.CUSTOMER,
  };

  const mockRecipientUser = {
    _id: mockRecipientId,
    fullName: 'Nusrat Jahan',
    email: 'nusrat@aurumsave.com',
    phone: '01899887766',
    isActive: true,
    isAccountFrozen: false,
    role: Role.CUSTOMER,
    kycStatus: 'APPROVED',
  };

  const mockHolding = {
    userId: mockSenderId,
    purity: PurityGrade.K24,
    weightMilligramsAvailable: 10000, // 10 grams
    weightMilligramsPending: 0,
    save: jest.fn().mockResolvedValue(true),
  };

  const mockGiftModel: any = {
    create: jest.fn().mockImplementation((arr) => Promise.resolve(arr)),
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
    findOne: jest.fn(),
  };

  const mockHoldingModel: any = {
    findOne: jest.fn().mockResolvedValue(mockHolding),
    findOneAndUpdate: jest.fn(),
    create: jest.fn().mockImplementation((arr) => Promise.resolve(arr)),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };

  const mockLedgerModel: any = {
    create: jest.fn().mockImplementation((arr) => Promise.resolve(arr)),
  };

  const mockUserModel: any = {
    findById: jest.fn().mockImplementation((id) => {
      if (id.toString() === mockSenderId.toString()) return Promise.resolve(mockSenderUser);
      if (id.toString() === mockRecipientId.toString()) return Promise.resolve(mockRecipientUser);
      return Promise.resolve(null);
    }),
    findOne: jest.fn().mockImplementation((q) => {
      if (q.email === 'nusrat@aurumsave.com' || q.phone === '01899887766') return Promise.resolve(mockRecipientUser);
      if (q.email === 'farhad@aurumsave.com' || q.phone === '01711223344') return Promise.resolve(mockSenderUser);
      return Promise.resolve(null);
    }),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(true),
  };

  const mockPriceService = {
    getRateForPurity: jest.fn().mockResolvedValue({
      purity: PurityGrade.K24,
      sellPricePerGramPoisha: 1150000,
      buyPricePerGramPoisha: 1180000,
    }),
  };

  const mockTicketModel: any = {
    create: jest.fn().mockImplementation((doc) => Promise.resolve({ ...doc, save: jest.fn().mockResolvedValue(true) })),
    findOne: jest.fn(),
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }),
    }),
  };

  const mockMessageModel: any = {
    create: jest.fn().mockImplementation((doc) => Promise.resolve(doc)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GiftService,
        SupportService,
        { provide: getModelToken(GoldGift.name), useValue: mockGiftModel },
        { provide: getModelToken(GoldHolding.name), useValue: mockHoldingModel },
        { provide: getModelToken(LedgerEntry.name), useValue: mockLedgerModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(SupportTicket.name), useValue: mockTicketModel },
        { provide: getModelToken(SupportMessage.name), useValue: mockMessageModel },
        { provide: AuditService, useValue: mockAuditService },
        { provide: PriceService, useValue: mockPriceService },
        { provide: 'DatabaseConnection', useValue: { startSession: jest.fn() } },
      ],
    }).compile();

    giftService = module.get<GiftService>(GiftService);
    supportService = module.get<SupportService>(SupportService);
  });

  describe('1. P2P Gold Gifting & Escrow Lifecycle', () => {
    it('should mask recipient identity for privacy on lookup', async () => {
      const result = await giftService.lookupRecipient(mockSenderId.toString(), {
        recipientIdentifier: 'nusrat@aurumsave.com',
      });

      expect(result.found).toBe(true);
      expect(result.maskedName).toBe('N****t J***n');
      expect(result.maskedEmail).toBe('n***t@aurumsave.com');
      expect(result.maskedPhone).toBe('018****766');
    });

    it('should prevent sender from gifting gold to themselves', async () => {
      await expect(
        giftService.lookupRecipient(mockSenderId.toString(), {
          recipientIdentifier: 'farhad@aurumsave.com',
        }),
      ).rejects.toThrow('cannot send a gold gift to yourself');
    });

    it('should safely escrow gold and create gift record and ledger entry', async () => {
      mockHoldingModel.findOneAndUpdate.mockResolvedValueOnce({
        ...mockHolding,
        weightMilligramsAvailable: 9000,
        weightMilligramsPending: 1000,
      });

      const gift = await giftService.sendGift(mockSenderId.toString(), {
        recipientIdentifier: 'nusrat@aurumsave.com',
        weightGrams: 1.0, // 1000 mg
        message: 'Eid Mubarak! May this 24K gold bring prosperity.',
      });

      expect(gift).toBeDefined();
      expect(mockHoldingModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockSenderId,
          weightMilligramsAvailable: { $gte: 1000 },
        }),
        expect.objectContaining({
          $inc: { weightMilligramsAvailable: -1000, weightMilligramsPending: 1000 },
        }),
        expect.any(Object),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GOLD_GIFT_SENT',
          actorId: mockSenderId.toString(),
        }),
      );
    });

    it('should release escrow and return gold to sender on gift rejection', async () => {
      mockGiftModel.findOne.mockResolvedValueOnce({
        giftId: 'GFT-123456',
        senderId: mockSenderId,
        recipientId: mockRecipientId,
        recipientEmail: 'nusrat@aurumsave.com',
        purity: PurityGrade.K24,
        weightMilligrams: 1000,
        valuationAtGiftPoisha: 1150000,
        status: GiftStatus.PENDING_ACCEPTANCE,
        expiresAt: new Date(Date.now() + 100000),
        save: jest.fn().mockResolvedValue(true),
      });

      mockHoldingModel.findOneAndUpdate.mockResolvedValueOnce({
        ...mockHolding,
        weightMilligramsAvailable: 10000,
        weightMilligramsPending: 0,
      });

      const result = await giftService.rejectGift(mockRecipientId.toString(), 'GFT-123456');

      expect(result.success).toBe(true);
      expect(mockHoldingModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockSenderId,
          weightMilligramsPending: { $gte: 1000 },
        }),
        expect.objectContaining({
          $inc: { weightMilligramsPending: -1000, weightMilligramsAvailable: 1000 },
        }),
        expect.any(Object),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GOLD_GIFT_REJECTED',
        }),
      );
    });

    it('should credit recipient available balance and finalize transfer on gift accept', async () => {
      const pendingGift = {
        giftId: 'GFT-998877',
        senderId: mockSenderId,
        recipientId: mockRecipientId,
        recipientEmail: 'nusrat@aurumsave.com',
        purity: PurityGrade.K24,
        weightMilligrams: 2000, // 2 grams
        valuationAtGiftPoisha: 2300000,
        status: GiftStatus.PENDING_ACCEPTANCE,
        expiresAt: new Date(Date.now() + 100000),
        save: jest.fn().mockResolvedValue(true),
      };

      mockGiftModel.findOne.mockResolvedValueOnce(pendingGift);

      mockHoldingModel.findOneAndUpdate.mockResolvedValueOnce({
        ...mockHolding,
        weightMilligramsPending: 0,
      });

      mockHoldingModel.findOne.mockResolvedValueOnce({
        userId: mockRecipientId,
        purity: PurityGrade.K24,
        weightMilligramsAvailable: 3000,
        totalCostPoisha: 3000000,
        averageCostPerMilligramPoisha: 1000,
        save: jest.fn().mockResolvedValue(true),
      });

      const result = await giftService.acceptGift(mockRecipientId.toString(), 'GFT-998877');

      expect(result.success).toBe(true);
      expect(pendingGift.status).toBe(GiftStatus.ACCEPTED);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'GOLD_GIFT_CLAIMED',
          actorId: mockRecipientId.toString(),
        }),
      );
    });
  });

  describe('2. Support-to-Finance Order Dispute Escalation', () => {
    it('should escalate customer order dispute from support agent to finance', async () => {
      const mockTicket = {
        ticketId: 'TCK-554433',
        userId: mockSenderId,
        subject: 'bKash MFS payment deducted but order still awaiting',
        status: 'OPEN',
        relatedOrderId: 'ORD-776655',
        save: jest.fn().mockResolvedValue(true),
      };

      mockTicketModel.findOne.mockResolvedValueOnce(mockTicket);

      const staffAgent = { id: 'staff-supp-01', role: Role.SUPPORT_AGENT };
      const result = await supportService.escalateToFinance('TCK-554433', staffAgent, {
        reason: 'Payment verified in bank statement; customer awaiting manual settlement',
        relatedOrderId: 'ORD-776655',
      });

      expect(result.success).toBe(true);
      expect(mockTicket.status).toBe('ESCALATED_TO_FINANCE');
      expect(mockMessageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: 'TCK-554433',
          isInternalNote: true,
          message: expect.stringContaining('[DISPUTE ESCALATED TO FINANCE DEPT]'),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DISPUTE_RAISED',
          actorId: 'staff-supp-01',
        }),
      );
    });

    it('should reject dispute escalation attempts by unprivileged customer roles', async () => {
      const customerUser = { id: mockSenderId.toString(), role: Role.CUSTOMER };
      await expect(
        supportService.escalateToFinance('TCK-111111', customerUser, {
          reason: 'I want a refund now',
        }),
      ).rejects.toThrow('Only Support Agents and Admins can escalate tickets to Finance');
    });

    it('should execute authoritative four-eyes resolution by Finance Officer', async () => {
      const escalatedTicket = {
        ticketId: 'TCK-990011',
        userId: mockSenderId,
        escalatedToFinance: true,
        status: 'ESCALATED_TO_FINANCE',
        relatedOrderId: 'ORD-990011',
        save: jest.fn().mockResolvedValue(true),
      };

      mockTicketModel.findOne.mockResolvedValueOnce(escalatedTicket);

      const financeOfficer = { id: 'staff-fin-07', role: Role.FINANCE_OFFICER };
      const resolution = await supportService.resolveFinanceDispute(
        'TCK-990011',
        financeOfficer,
        {
          action: 'REFUND_APPROVED',
          note: 'bKash MFS transaction discrepancy verified with bank reconciliation report. Refund approved.',
        },
      );

      expect(resolution.success).toBe(true);
      expect(escalatedTicket.status).toBe('RESOLVED');
      expect(mockMessageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isInternalNote: false,
          message: expect.stringContaining('Your dispute has been reviewed and approved by our Finance Department'),
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DISPUTE_RESOLVED',
          actorId: 'staff-fin-07',
        }),
      );
    });
  });
});
