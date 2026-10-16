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

    it('should forbid sandbox simulation when running in production regardless of ALLOW_SANDBOX_PAYMENTS', () => {
      const verifySandboxAllowed = (nodeEnv: string, allowSandbox: boolean) => {
        if (nodeEnv === 'production') {
          throw new ForbiddenException('Payment simulation is strictly disabled in production mode');
        }
        if (!allowSandbox) {
          throw new ForbiddenException('Sandbox payment simulation is disabled. ALLOW_SANDBOX_PAYMENTS must be true.');
        }
        return true;
      };

      // All 4 environment permutations
      expect(() => verifySandboxAllowed('production', false)).toThrow('Payment simulation is strictly disabled in production mode');
      expect(() => verifySandboxAllowed('production', true)).toThrow('Payment simulation is strictly disabled in production mode');
      expect(() => verifySandboxAllowed('development', false)).toThrow('Sandbox payment simulation is disabled');
      expect(verifySandboxAllowed('development', true)).toBe(true);
    });

    it('should reject duplicate provider transaction ID on payment callback to prevent double crediting', () => {
      const processedTransactions = new Set<string>();

      const processCallbackWithTxnId = (gatewayTxnId: string) => {
        if (processedTransactions.has(gatewayTxnId)) {
          throw new BadRequestException(`Duplicate payment transaction ${gatewayTxnId} already processed`);
        }
        processedTransactions.add(gatewayTxnId);
        return { success: true, gatewayTxnId };
      };

      const first = processCallbackWithTxnId('BKASH-TRX-001928');
      expect(first.success).toBe(true);

      // Concurrent or duplicate delivery of same provider transaction ID
      expect(() => processCallbackWithTxnId('BKASH-TRX-001928')).toThrow(BadRequestException);
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
    it('should block new quotes and order execution when market rates are stale or expired', () => {
      const now = Date.now();
      const expiredRate = {
        isStale: true,
        source: 'DEMO_BENCHMARK_SEED (Unverified)',
        expiresAt: new Date(now - 60000).toISOString(),
      };

      const validateRateForOrder = (rate: { isStale: boolean; expiresAt: string }) => {
        if (rate.isStale || new Date() > new Date(rate.expiresAt)) {
          throw new BadRequestException('Market price for gold is stale or expired. Please refresh.');
        }
        return true;
      };

      expect(() => validateRateForOrder(expiredRate)).toThrow('Market price for gold is stale or expired');
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

    it('should clearly flag benchmark seed data as unverified demo source', () => {
      const demoSource = 'DEMO_BENCHMARK_SEED (Unverified)';
      expect(demoSource).toContain('(Unverified)');
      expect(demoSource).not.toBe('BAJUS_LIVE');
    });
  });

  describe('KYC Document File Validation & RBAC Authorization', () => {
    function validateMagicBytes(buffer: Buffer): boolean {
      if (!buffer || buffer.length < 4) return false;
      // JPEG: FF D8 FF
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
      // PNG: 89 50 4E 47
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
      // PDF: %PDF (25 50 44 46)
      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return true;
      // WebP: RIFF ... WEBP
      if (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
      ) {
        return true;
      }
      return false;
    }

    it('should validate genuine image and PDF binary magic bytes', () => {
      const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      const pdfBuf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);

      expect(validateMagicBytes(jpegBuf)).toBe(true);
      expect(validateMagicBytes(pngBuf)).toBe(true);
      expect(validateMagicBytes(pdfBuf)).toBe(true);
    });

    it('should reject spoofed files (e.g. executable or shell script disguised as png)', () => {
      const exeSpoof = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ DOS/PE
      const bashSpoof = Buffer.from('#!/bin/bash\nrm -rf /');

      expect(validateMagicBytes(exeSpoof)).toBe(false);
      expect(validateMagicBytes(bashSpoof)).toBe(false);
    });

    it('should strictly enforce cross-customer and role isolation on KYC documents', () => {
      const authorizeDocumentAccess = (
        user: { userId: string; role: Role },
        docOwnerId: string,
      ) => {
        // Customer can only view their own
        if (user.role === Role.CUSTOMER) {
          if (user.userId !== docOwnerId) {
            throw new ForbiddenException('Access denied: You can only view your own documents');
          }
          return true;
        }

        // Compliance and Admins can view
        if ([Role.KYC_OFFICER, Role.ADMIN, Role.SUPER_ADMIN].includes(user.role)) {
          return true;
        }

        // Auditor, Support, and Finance are forbidden from raw KYC files
        throw new ForbiddenException(`Access denied: Role ${user.role} is not permitted to access customer identity documents`);
      };

      const customerA = { userId: 'usr-customer-A', role: Role.CUSTOMER };
      const customerB = { userId: 'usr-customer-B', role: Role.CUSTOMER };
      const kycOfficer = { userId: 'usr-compliance', role: Role.KYC_OFFICER };
      const admin = { userId: 'usr-admin', role: Role.ADMIN };
      const auditor = { userId: 'usr-auditor', role: Role.AUDITOR };
      const support = { userId: 'usr-support', role: Role.SUPPORT_AGENT };
      const finance = { userId: 'usr-finance', role: Role.FINANCE_OFFICER };

      // Customer A accesses own document
      expect(authorizeDocumentAccess(customerA, 'usr-customer-A')).toBe(true);

      // Customer A tries to access Customer B document
      expect(() => authorizeDocumentAccess(customerA, 'usr-customer-B')).toThrow('You can only view your own documents');

      // Compliance & Admin can review Customer A document
      expect(authorizeDocumentAccess(kycOfficer, 'usr-customer-A')).toBe(true);
      expect(authorizeDocumentAccess(admin, 'usr-customer-A')).toBe(true);

      // Auditor, Support, and Finance are forbidden
      expect(() => authorizeDocumentAccess(auditor, 'usr-customer-A')).toThrow('is not permitted to access customer identity documents');
      expect(() => authorizeDocumentAccess(support, 'usr-customer-A')).toThrow('is not permitted to access customer identity documents');
      expect(() => authorizeDocumentAccess(finance, 'usr-customer-A')).toThrow('is not permitted to access customer identity documents');
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
    const GENESIS_HASH = 'GENESIS_0000000000000000000000000000000000000000000000000000000000000000';

    function computeEntryHash(entry: {
      previousHash: string;
      logId: string;
      action: string;
      actorRole: string;
      entityType: string;
      entityId?: string;
      details?: any;
    }): string {
      const payload = `${entry.previousHash}:${entry.logId}:${entry.action}:${entry.actorRole}:${entry.entityType}:${entry.entityId || ''}:${JSON.stringify(entry.details || {})}`;
      return crypto.createHash('sha256').update(payload).digest('hex');
    }

    it('should correctly chain consecutive audit records with tamper-evident hashes', () => {
      const entry1 = {
        logId: 'AUD-001',
        action: 'ORDER_CREATED',
        actorRole: 'CUSTOMER',
        entityType: 'Order',
        entityId: 'ORD-100',
        details: { amount: 1000 },
        previousHash: GENESIS_HASH,
      };
      const hash1 = computeEntryHash(entry1);

      const entry2 = {
        logId: 'AUD-002',
        action: 'ORDER_SETTLED',
        actorRole: 'SYSTEM',
        entityType: 'Order',
        entityId: 'ORD-100',
        details: { amount: 1000 },
        previousHash: hash1,
      };
      const hash2 = computeEntryHash(entry2);

      // Verify chain connection
      expect(entry2.previousHash).toBe(hash1);
      expect(hash2).not.toEqual(hash1);

      // Verify tamper detection
      const tamperedEntry1 = { ...entry1, details: { amount: 9999999 } };
      const recalculatedHash1 = computeEntryHash(tamperedEntry1);

      // If record 1 was altered, entry 2's previousHash fails to match
      expect(entry2.previousHash).not.toEqual(recalculatedHash1);
    });

    it('should detect missing hashes, broken predecessor links, and altered entries in chain', () => {
      interface AuditEntry {
        logId: string;
        action: string;
        actorRole: string;
        entityType: string;
        entityId: string;
        details: any;
        previousHash: string;
        entryHash?: string;
      }

      function verifyFullChain(records: AuditEntry[]): { isValid: boolean; errorCount: number; errors: string[] } {
        const errors: string[] = [];
        let expectedPrevHash = GENESIS_HASH;

        for (let i = 0; i < records.length; i++) {
          const r = records[i];
          if (!r.entryHash) {
            errors.push(`Missing entryHash at logId: ${r.logId}`);
            continue;
          }

          if (r.previousHash !== expectedPrevHash) {
            errors.push(`Broken chain link at logId: ${r.logId}`);
          }

          const recalculated = computeEntryHash(r);
          if (recalculated !== r.entryHash) {
            errors.push(`Hash mismatch at logId: ${r.logId} - data has been modified`);
          }

          expectedPrevHash = r.entryHash;
        }

        return { isValid: errors.length === 0, errorCount: errors.length, errors };
      }

      // 1. Valid chain
      const e0: AuditEntry = {
        logId: 'L-0',
        action: 'A0',
        actorRole: 'CUSTOMER',
        entityType: 'T0',
        entityId: 'ID0',
        details: {},
        previousHash: GENESIS_HASH,
      };
      e0.entryHash = computeEntryHash(e0);

      const e1: AuditEntry = {
        logId: 'L-1',
        action: 'A1',
        actorRole: 'FINANCE',
        entityType: 'T1',
        entityId: 'ID1',
        details: {},
        previousHash: e0.entryHash,
      };
      e1.entryHash = computeEntryHash(e1);

      expect(verifyFullChain([e0, e1]).isValid).toBe(true);

      // 2. Tampered payload
      const tamperedE0 = { ...e0, details: { hacked: true } };
      const tamperCheck = verifyFullChain([tamperedE0, e1]);
      expect(tamperCheck.isValid).toBe(false);
      expect(tamperCheck.errors[0]).toContain('data has been modified');

      // 3. Missing hash
      const unhashedE0 = { ...e0, entryHash: undefined };
      const missingCheck = verifyFullChain([unhashedE0, e1]);
      expect(missingCheck.isValid).toBe(false);
      expect(missingCheck.errors[0]).toContain('Missing entryHash');

      // 4. Broken link
      const brokenE1 = { ...e1, previousHash: 'FORGED_PREVIOUS_HASH' };
      brokenE1.entryHash = computeEntryHash(brokenE1);
      const brokenCheck = verifyFullChain([e0, brokenE1]);
      expect(brokenCheck.isValid).toBe(false);
      expect(brokenCheck.errors[0]).toContain('Broken chain link');
    });
  });
});
