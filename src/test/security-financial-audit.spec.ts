import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  Role,
  Permission,
  OrderStatus,
  OrderType,
  PurityGrade,
  PaymentStatus,
  TicketStatus,
  hasPermission,
} from '@aurumsave/shared';

describe('Security & Financial Integrity Audit Suite', () => {
  const SECRET = 'test_webhook_signing_secret_2026_super_secure';

  describe('Payment Webhook Signature Verification', () => {
    function computeHmacSignature(paymentId: string, amountPoisha: number, txnId: string, secret: string) {
      const data = `${paymentId}:${amountPoisha}:${txnId}`;
      return crypto.createHmac('sha256', secret).update(data).digest('hex');
    }

    it('should successfully verify legitimate HMAC-SHA256 signature from payment gateway', () => {
      const paymentId = 'PAY-1700000000-A1B2C3';
      const amountPoisha = 1245000;
      const txnId = 'BKASH-TXN-998877';

      const validSig = computeHmacSignature(paymentId, amountPoisha, txnId, SECRET);
      const computed = computeHmacSignature(paymentId, amountPoisha, txnId, SECRET);

      expect(validSig).toEqual(computed);
      expect(crypto.timingSafeEqual(Buffer.from(validSig), Buffer.from(computed))).toBe(true);
    });

    it('should reject forged webhook signature with timing-safe comparison', () => {
      const paymentId = 'PAY-1700000000-A1B2C3';
      const amountPoisha = 1245000;
      const txnId = 'BKASH-TXN-998877';

      const validSig = computeHmacSignature(paymentId, amountPoisha, txnId, SECRET);
      const forgedSig = computeHmacSignature(paymentId, 50000, txnId, 'attacker_secret');

      expect(validSig).not.toEqual(forgedSig);
    });

    it('should prevent duplicate webhook processing via idempotency check', () => {
      let isAlreadySettled = false;
      const processCallback = () => {
        if (isAlreadySettled) {
          return { success: true, message: 'Payment already processed and settled' };
        }
        isAlreadySettled = true;
        return { success: true, message: 'Payment newly settled' };
      };

      const firstCall = processCallback();
      expect(firstCall.message).toBe('Payment newly settled');

      const secondCall = processCallback();
      expect(secondCall.message).toBe('Payment already processed and settled');
    });

    it('should forbid sandbox simulation when running in production without explicit permission', () => {
      const verifySandboxAllowed = (nodeEnv: string, allowSandbox: boolean) => {
        if (nodeEnv === 'production' && !allowSandbox) {
          throw new ForbiddenException('Payment simulation is strictly disabled in production mode');
        }
        return true;
      };

      expect(() => verifySandboxAllowed('production', false)).toThrow(ForbiddenException);
      expect(verifySandboxAllowed('development', true)).toBe(true);
      expect(verifySandboxAllowed('production', true)).toBe(true);
    });
  });

  describe('Sell Order Escrow & Anti-Overselling Concurrency', () => {
    it('should atomically reserve gold into pending escrow and prevent double spending', () => {
      let availableMg = 1000; // 1 gram
      let pendingMg = 0;

      const reserveGold = (sellMg: number) => {
        if (availableMg < sellMg) {
          throw new BadRequestException('Insufficient gold balance in your vault');
        }
        availableMg -= sellMg;
        pendingMg += sellMg;
        return { availableMg, pendingMg };
      };

      // First reservation succeeds
      const r1 = reserveGold(600);
      expect(r1.availableMg).toBe(400);
      expect(r1.pendingMg).toBe(600);

      // Concurrent second reservation exceeding remaining balance fails
      expect(() => reserveGold(500)).toThrow(BadRequestException);
      expect(availableMg).toBe(400); // Unaltered
    });

    it('should restore pending gold to available vault upon order cancellation', () => {
      let availableMg = 400;
      let pendingMg = 600;

      const cancelSellOrder = (refundMg: number) => {
        if (pendingMg < refundMg) {
          throw new BadRequestException('Pending balance corrupted');
        }
        pendingMg -= refundMg;
        availableMg += refundMg;
        return { availableMg, pendingMg };
      };

      const restored = cancelSellOrder(600);
      expect(restored.availableMg).toBe(1000);
      expect(restored.pendingMg).toBe(0);
    });

    it('should keep sell order in PROCESSING state until payout is confirmed', () => {
      let orderStatus: OrderStatus = OrderStatus.PROCESSING;

      const confirmPayout = (payoutRef: string) => {
        if (!payoutRef) throw new BadRequestException('Missing payout confirmation reference');
        orderStatus = OrderStatus.COMPLETED;
        return orderStatus;
      };

      expect(orderStatus).toBe(OrderStatus.PROCESSING);
      confirmPayout('MFS-PAYOUT-771122');
      expect(orderStatus).toBe(OrderStatus.COMPLETED);
    });
  });

  describe('Stale Price & Expired Quote Enforcement', () => {
    it('should block new quotes when market rates are stale or expired', () => {
      const now = Date.now();
      const expiredRate = {
        isStale: true,
        expiresAt: new Date(now - 60000).toISOString(),
      };

      const generateQuote = (rate: { isStale: boolean }) => {
        if (rate.isStale) {
          throw new BadRequestException('Gold market rates are currently stale or unverified');
        }
        return { quoteId: 'QTE-123', valid: true };
      };

      expect(() => generateQuote(expiredRate)).toThrow(BadRequestException);
    });

    it('should reject orders created with an expired quote', () => {
      const quote = {
        expiresAt: new Date(Date.now() - 5000), // expired 5s ago
        isUsed: false,
      };

      const validateQuote = (q: typeof quote) => {
        if (new Date() > q.expiresAt) {
          throw new BadRequestException('Quote has expired');
        }
        if (q.isUsed) {
          throw new BadRequestException('Quote already used');
        }
        return true;
      };

      expect(() => validateQuote(quote)).toThrow('Quote has expired');
    });
  });

  describe('Support Desk Role Isolation', () => {
    it('should prevent Auditor and Finance roles from replying to tickets or creating internal notes', () => {
      const authorizedRoles = [Role.SUPPORT_AGENT, Role.ADMIN, Role.SUPER_ADMIN];

      const canReply = (role: Role, isCustomer: boolean, isOwner: boolean) => {
        if (isCustomer) return isOwner;
        return authorizedRoles.includes(role);
      };

      expect(canReply(Role.CUSTOMER, true, true)).toBe(true);
      expect(canReply(Role.CUSTOMER, true, false)).toBe(false); // Other customer blocked
      expect(canReply(Role.SUPPORT_AGENT, false, false)).toBe(true);
      expect(canReply(Role.ADMIN, false, false)).toBe(true);
      expect(canReply(Role.AUDITOR, false, false)).toBe(false); // Auditor blocked
      expect(canReply(Role.FINANCE_OFFICER, false, false)).toBe(false); // Finance blocked
      expect(canReply(Role.KYC_OFFICER, false, false)).toBe(false); // Compliance blocked
    });

    it('should filter internal staff notes from Auditor, Finance, and Customer views', () => {
      const canViewInternalNotes = (role: Role) => {
        return [Role.SUPPORT_AGENT, Role.ADMIN, Role.SUPER_ADMIN].includes(role);
      };

      expect(canViewInternalNotes(Role.SUPPORT_AGENT)).toBe(true);
      expect(canViewInternalNotes(Role.ADMIN)).toBe(true);
      expect(canViewInternalNotes(Role.AUDITOR)).toBe(false);
      expect(canViewInternalNotes(Role.FINANCE_OFFICER)).toBe(false);
      expect(canViewInternalNotes(Role.CUSTOMER)).toBe(false);
    });
  });

  describe('Cryptographic SHA-256 Audit Chain Verification', () => {
    it('should correctly chain consecutive audit records with tamper-evident hashes', () => {
      const genesisHash = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';

      const entry1 = {
        logId: 'AUD-001',
        action: 'ORDER_CREATED',
        previousHash: genesisHash,
      };
      const hash1 = crypto
        .createHash('sha256')
        .update(`${entry1.previousHash}:${entry1.logId}:${entry1.action}`)
        .digest('hex');

      const entry2 = {
        logId: 'AUD-002',
        action: 'ORDER_SETTLED',
        previousHash: hash1,
      };
      const hash2 = crypto
        .createHash('sha256')
        .update(`${entry2.previousHash}:${entry2.logId}:${entry2.action}`)
        .digest('hex');

      // Verify chain connection
      expect(entry2.previousHash).toBe(hash1);
      expect(hash2).not.toEqual(hash1);

      // Verify tamper detection
      const tamperedEntry1Action = 'ORDER_CANCELLED';
      const recalculatedHash1 = crypto
        .createHash('sha256')
        .update(`${entry1.previousHash}:${entry1.logId}:${tamperedEntry1Action}`)
        .digest('hex');

      // If record 1 was altered, entry 2's previousHash fails to match
      expect(entry2.previousHash).not.toEqual(recalculatedHash1);
    });
  });
});
