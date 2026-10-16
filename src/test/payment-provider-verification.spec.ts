import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule, getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import {
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  OrderType,
  PurityGrade,
  LedgerEntryType,
  CONVERSIONS,
} from '@aurumsave/shared';

import { Payment, PaymentSchema, PaymentDocument } from '../database/schemas/payment.schema';
import { Order, OrderSchema, OrderDocument } from '../database/schemas/order.schema';
import { GoldHolding, GoldHoldingSchema, GoldHoldingDocument } from '../database/schemas/gold-holding.schema';
import { LedgerEntry, LedgerEntrySchema, LedgerEntryDocument } from '../database/schemas/ledger-entry.schema';
import { AuditLog, AuditLogSchema, AuditLogDocument } from '../database/schemas/audit-log.schema';

import { PaymentService } from '../modules/payments/payment.service';
import { PaymentVerificationService } from '../modules/payments/providers/payment-verification.service';
import { BkashVerifier } from '../modules/payments/providers/bkash.verifier';
import { NagadVerifier } from '../modules/payments/providers/nagad.verifier';
import { SslCommerzVerifier } from '../modules/payments/providers/sslcommerz.verifier';
import { LedgerService } from '../modules/ledger/ledger.service';
import { AuditService } from '../modules/audit/audit.service';

const TEST_DB_URI =
  process.env.TEST_DATABASE_URL ||
  'mongodb://127.0.0.1:27017/aurumsave_test_provider_verification?replicaSet=rs0&directConnection=true';

describe('Payment Provider Verification & Settlement Suite (bKash, Nagad, SSLCommerz)', () => {
  let module: TestingModule;
  let connection: Connection;
  let paymentService: PaymentService;
  let verificationService: PaymentVerificationService;
  let bkashVerifier: BkashVerifier;
  let nagadVerifier: NagadVerifier;
  let sslVerifier: SslCommerzVerifier;
  let configService: ConfigService;

  let paymentModel: Model<PaymentDocument>;
  let orderModel: Model<OrderDocument>;
  let holdingModel: Model<GoldHoldingDocument>;
  let ledgerModel: Model<LedgerEntryDocument>;
  let auditModel: Model<AuditLogDocument>;

  // Generate real in-memory RSA keypairs for cryptographic signature verification tests
  const bkashKeypair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const nagadKeypair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              BKASH_APP_KEY: 'test_bkash_app_key',
              BKASH_APP_SECRET: 'test_bkash_app_secret',
              BKASH_USERNAME: 'test_bkash_username',
              BKASH_PASSWORD: 'test_bkash_password',
              BKASH_PUBLIC_KEY: bkashKeypair.publicKey,
              NAGAD_MERCHANT_ID: 'test_nagad_merchant',
              NAGAD_PG_PUBLIC_KEY: nagadKeypair.publicKey,
              NAGAD_MERCHANT_PRIVATE_KEY: nagadKeypair.privateKey,
              SSLCOMMERZ_STORE_ID: 'test_ssl_store',
              SSLCOMMERZ_STORE_PASSWORD: 'test_ssl_password',
            }),
          ],
        }),
        MongooseModule.forRoot(TEST_DB_URI),
        MongooseModule.forFeature([
          { name: Payment.name, schema: PaymentSchema },
          { name: Order.name, schema: OrderSchema },
          { name: GoldHolding.name, schema: GoldHoldingSchema },
          { name: LedgerEntry.name, schema: LedgerEntrySchema },
          { name: AuditLog.name, schema: AuditLogSchema },
        ]),
      ],
      providers: [
        PaymentService,
        PaymentVerificationService,
        BkashVerifier,
        NagadVerifier,
        SslCommerzVerifier,
        LedgerService,
        AuditService,
      ],
    }).compile();

    connection = module.get<Connection>(getConnectionToken());
    paymentService = module.get<PaymentService>(PaymentService);
    verificationService = module.get<PaymentVerificationService>(PaymentVerificationService);
    bkashVerifier = module.get<BkashVerifier>(BkashVerifier);
    nagadVerifier = module.get<NagadVerifier>(NagadVerifier);
    sslVerifier = module.get<SslCommerzVerifier>(SslCommerzVerifier);
    configService = module.get<ConfigService>(ConfigService);

    paymentModel = module.get<Model<PaymentDocument>>(getModelToken(Payment.name));
    orderModel = module.get<Model<OrderDocument>>(getModelToken(Order.name));
    holdingModel = module.get<Model<GoldHoldingDocument>>(getModelToken(GoldHolding.name));
    ledgerModel = module.get<Model<LedgerEntryDocument>>(getModelToken(LedgerEntry.name));
    auditModel = module.get<Model<AuditLogDocument>>(getModelToken(AuditLog.name));

    await Promise.all([
      paymentModel.createCollection().catch(() => {}),
      orderModel.createCollection().catch(() => {}),
      holdingModel.createCollection().catch(() => {}),
      ledgerModel.createCollection().catch(() => {}),
      auditModel.createCollection().catch(() => {}),
    ]);
  });

  afterAll(async () => {
    if (connection) {
      await connection.close();
    }
    if (module) {
      await module.close();
    }
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await Promise.all([
      paymentModel.deleteMany({}),
      orderModel.deleteMany({}),
      holdingModel.deleteMany({}),
      ledgerModel.deleteMany({}),
      auditModel.deleteMany({}),
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function seedTestPayment(gateway: PaymentMethod, amountPoisha: number = 6225000) {
    const userId = new Types.ObjectId().toString();
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const order = await orderModel.create({
      orderId,
      userId: new Types.ObjectId(userId),
      orderType: OrderType.BUY,
      quoteId: 'QTE-TEST-P0',
      purity: PurityGrade.K24,
      weightMilligrams: 5000,
      totalPoisha: amountPoisha,
      status: OrderStatus.AWAITING_PAYMENT,
      paymentMethod: gateway,
      paymentId,
      statusHistory: [{ status: OrderStatus.AWAITING_PAYMENT, timestamp: new Date() }],
    });

    const payment = await paymentModel.create({
      paymentId,
      orderId,
      userId: new Types.ObjectId(userId),
      gateway,
      amountPoisha,
      status: PaymentStatus.PENDING,
      gatewayResponseMetadata: { initiatedVia: 'GATEWAY_TEST' },
    });

    return { userId, order, payment };
  }

  // ==========================================
  // SECTION 1: bKash Provider Verification Tests
  // ==========================================
  describe('1. bKash Security Verification', () => {
    it('1.1 Rejects untrusted certificate identity URLs (SSRF protection)', () => {
      expect(bkashVerifier.isValidIdentityUrl('https://tokenized.pay.bka.sh/checkout/cert.pem')).toBe(true);
      expect(bkashVerifier.isValidIdentityUrl('https://sub.bkash.com/keys/cert.pem')).toBe(true);
      expect(bkashVerifier.isValidIdentityUrl('http://tokenized.pay.bka.sh/insecure.pem')).toBe(false);
      expect(bkashVerifier.isValidIdentityUrl('https://evil-attacker.com/malicious.pem')).toBe(false);
      expect(bkashVerifier.isValidIdentityUrl('https://bka.sh.attacker.com/cert.pem')).toBe(false);
    });

    it('1.2 Validates genuine RSA-SHA256 signature and rejects tampered signature', () => {
      const payload = { paymentID: 'BKASH_PAY_001', amount: '62250.00', trxID: 'TRX_BKASH_001' };
      const payloadString = JSON.stringify(payload);

      // Sign with private key
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(payloadString);
      const validSig = signer.sign(bkashKeypair.privateKey, 'base64');

      expect(bkashVerifier.verifyRsaSignature(payloadString, validSig, bkashKeypair.publicKey)).toBe(true);

      // Tampered payload
      const tamperedPayload = JSON.stringify({ ...payload, amount: '1000.00' });
      expect(bkashVerifier.verifyRsaSignature(tamperedPayload, validSig, bkashKeypair.publicKey)).toBe(false);

      // Corrupted signature
      expect(bkashVerifier.verifyRsaSignature(payloadString, 'corrupted_sig', bkashKeypair.publicKey)).toBe(false);
    });

    it('1.3 Rejects non-completed status and flags pending status correctly', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.BKASH, 6225000);

      // Mock outward query returning Initiated / Pending
      jest.spyOn(bkashVerifier, 'queryBkashPaymentStatus').mockResolvedValueOnce({
        paymentID: 'BKASH_PAY_PENDING',
        trxID: 'TRX_PENDING',
        transactionStatus: 'Initiated',
        amount: '62250.00',
        currency: 'BDT',
        merchantInvoiceNumber: payment.paymentId,
      });

      const result = await bkashVerifier.verifyPayment(payment, {
        paymentID: 'BKASH_PAY_PENDING',
      });

      expect(result.verified).toBe(false);
      expect(result.isPending).toBe(true);
      expect(result.failureReason).toContain('non-completed status');
    });

    it('1.4 Rejects amount mismatch between bKash provider status and internal payment', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.BKASH, 6225000); // 62,250 BDT

      jest.spyOn(bkashVerifier, 'queryBkashPaymentStatus').mockResolvedValueOnce({
        paymentID: 'BKASH_PAY_AMT_MISMATCH',
        trxID: 'TRX_MISMATCH',
        transactionStatus: 'Completed',
        amount: '50000.00', // Underpaid: 50,000 BDT instead of 62,250 BDT
        currency: 'BDT',
        merchantInvoiceNumber: payment.paymentId,
      });

      await expect(
        bkashVerifier.verifyPayment(payment, { paymentID: 'BKASH_PAY_AMT_MISMATCH' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('1.5 Rejects currency mismatch from bKash response', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.BKASH, 6225000);

      jest.spyOn(bkashVerifier, 'queryBkashPaymentStatus').mockResolvedValueOnce({
        paymentID: 'BKASH_PAY_USD',
        trxID: 'TRX_USD',
        transactionStatus: 'Completed',
        amount: '62250.00',
        currency: 'USD', // Invalid currency
        merchantInvoiceNumber: payment.paymentId,
      });

      await expect(
        bkashVerifier.verifyPayment(payment, { paymentID: 'BKASH_PAY_USD' }),
      ).rejects.toThrow('bKash currency mismatch: expected BDT');
    });

    it('1.6 Rejects merchant invoice mismatch from bKash response', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.BKASH, 6225000);

      jest.spyOn(bkashVerifier, 'queryBkashPaymentStatus').mockResolvedValueOnce({
        paymentID: 'BKASH_PAY_OTHER',
        trxID: 'TRX_OTHER',
        transactionStatus: 'Completed',
        amount: '62250.00',
        currency: 'BDT',
        merchantInvoiceNumber: 'DIFFERENT_PAYMENT_ID',
      });

      await expect(
        bkashVerifier.verifyPayment(payment, { paymentID: 'BKASH_PAY_OTHER' }),
      ).rejects.toThrow('bKash merchant invoice mismatch');
    });

    it('1.7 Successfully verifies genuine completed bKash payment', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.BKASH, 6225000);

      jest.spyOn(bkashVerifier, 'queryBkashPaymentStatus').mockResolvedValueOnce({
        paymentID: 'BKASH_PAY_SUCCESS',
        trxID: 'BKASH_TRX_999999',
        transactionStatus: 'Completed',
        amount: '62250.00',
        currency: 'BDT',
        merchantInvoiceNumber: payment.paymentId,
        customerMsisdn: '01700000000',
      });

      const result = await bkashVerifier.verifyPayment(payment, { paymentID: 'BKASH_PAY_SUCCESS' });
      expect(result.verified).toBe(true);
      expect(result.gatewayTransactionId).toBe('BKASH_TRX_999999');
      expect(result.amountBdt).toBe(62250);
      expect(result.currency).toBe('BDT');
    });

    it('1.8 Reports READY_FOR_STAGING when credentials configured, BLOCKED when missing', () => {
      expect(bkashVerifier.getReadinessStatus()).toBe('READY_FOR_STAGING');

      const mockConfig = { get: jest.fn().mockReturnValue(undefined) } as any;
      const unconfigured = new BkashVerifier(mockConfig);
      expect(unconfigured.getReadinessStatus()).toBe('BLOCKED');
      expect(unconfigured.getReadinessDetails().missingConfigs).toContain('BKASH_APP_KEY');
    });
  });

  // ==========================================
  // SECTION 2: Nagad Provider Verification Tests
  // ==========================================
  describe('2. Nagad Security Verification', () => {
    it('2.1 Validates authentic Nagad RSA-SHA256 signature and rejects forged signatures', () => {
      const dataToSign = 'test_nagad_merchant:PAY_123:REF_456';

      const signer = crypto.createSign('RSA-SHA256');
      signer.update(dataToSign);
      const signature = signer.sign(nagadKeypair.privateKey, 'base64');

      expect(nagadVerifier.verifyNagadSignature(dataToSign, signature, nagadKeypair.publicKey)).toBe(true);
      expect(nagadVerifier.verifyNagadSignature('tampered_data', signature, nagadKeypair.publicKey)).toBe(false);
    });

    it('2.2 Rejects Nagad payment with non-success status code', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.NAGAD, 6225000);

      jest.spyOn(nagadVerifier, 'queryNagadPaymentStatus').mockResolvedValueOnce({
        status: 'Failed',
        statusCode: '101',
        amount: '62250.00',
        orderId: payment.paymentId,
      });

      const result = await nagadVerifier.verifyPayment(payment, { payment_ref_id: 'NAGAD_REF_FAIL' });
      expect(result.verified).toBe(false);
      expect(result.isPending).toBe(false);
      expect(result.failureReason).toContain('non-success status');
    });

    it('2.3 Rejects Nagad payment with pending/processing status', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.NAGAD, 6225000);

      jest.spyOn(nagadVerifier, 'queryNagadPaymentStatus').mockResolvedValueOnce({
        status: 'Pending',
        statusCode: '001',
        amount: '62250.00',
        orderId: payment.paymentId,
      });

      const result = await nagadVerifier.verifyPayment(payment, { payment_ref_id: 'NAGAD_REF_PENDING' });
      expect(result.verified).toBe(false);
      expect(result.isPending).toBe(true);
    });

    it('2.4 Rejects Nagad payment with amount mismatch', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.NAGAD, 6225000);

      jest.spyOn(nagadVerifier, 'queryNagadPaymentStatus').mockResolvedValueOnce({
        status: 'Success',
        statusCode: '000',
        amount: '40000.00', // Mismatched amount
        orderId: payment.paymentId,
      });

      await expect(
        nagadVerifier.verifyPayment(payment, { payment_ref_id: 'NAGAD_REF_AMT' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('2.5 Successfully verifies genuine Nagad payment', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.NAGAD, 6225000);

      jest.spyOn(nagadVerifier, 'queryNagadPaymentStatus').mockResolvedValueOnce({
        status: 'Success',
        statusCode: '000',
        amount: '62250.00',
        orderId: payment.paymentId,
        issuerPaymentDateTime: '20261016200000',
      });

      const result = await nagadVerifier.verifyPayment(payment, { payment_ref_id: 'NAGAD_REF_VALID' });
      expect(result.verified).toBe(true);
      expect(result.gatewayTransactionId).toBe('NAGAD_REF_VALID');
      expect(result.amountBdt).toBe(62250);
    });

    it('2.6 Reports READY_FOR_STAGING when credentials configured, BLOCKED when missing', () => {
      expect(nagadVerifier.getReadinessStatus()).toBe('READY_FOR_STAGING');

      const mockConfig = { get: jest.fn().mockReturnValue(undefined) } as any;
      const unconfigured = new NagadVerifier(mockConfig);
      expect(unconfigured.getReadinessStatus()).toBe('BLOCKED');
      expect(unconfigured.getReadinessDetails().missingConfigs).toContain('NAGAD_MERCHANT_ID');
    });
  });

  // ==========================================
  // SECTION 3: SSLCommerz Provider Verification Tests
  // ==========================================
  describe('3. SSLCommerz Security Verification', () => {
    it('3.1 Rejects callbacks missing mandatory val_id', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.SSLCOMMERZ, 6225000);

      await expect(
        sslVerifier.verifyPayment(payment, { tran_id: payment.paymentId }),
      ).rejects.toThrow('Missing mandatory val_id parameter');
    });

    it('3.2 Rejects IPN callback with tampered verify_sign hash', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.SSLCOMMERZ, 6225000);

      await expect(
        sslVerifier.verifyPayment(payment, {
          val_id: 'VAL_001',
          verify_sign: 'invalid_md5_hash_tampered',
          verify_key: 'amount,currency',
          amount: '62250.00',
          currency: 'BDT',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('3.3 Rejects SSLCommerz validation with status != VALID', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.SSLCOMMERZ, 6225000);

      jest.spyOn(sslVerifier, 'queryValidationServer').mockResolvedValueOnce({
        status: 'FAILED',
        amount: '62250.00',
        currency: 'BDT',
        tran_id: payment.paymentId,
        val_id: 'VAL_FAILED',
      });

      const result = await sslVerifier.verifyPayment(payment, { val_id: 'VAL_FAILED' });
      expect(result.verified).toBe(false);
      expect(result.failureReason).toContain('non-valid status: FAILED');
    });

    it('3.4 Rejects SSLCommerz validation with amount or currency mismatch', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.SSLCOMMERZ, 6225000);

      // Amount mismatch
      jest.spyOn(sslVerifier, 'queryValidationServer').mockResolvedValueOnce({
        status: 'VALID',
        amount: '20000.00', // expected 62,250
        currency: 'BDT',
        tran_id: payment.paymentId,
      });

      await expect(
        sslVerifier.verifyPayment(payment, { val_id: 'VAL_AMT_MISMATCH' }),
      ).rejects.toThrow('SSLCommerz transaction amount mismatch');

      // Currency mismatch
      jest.spyOn(sslVerifier, 'queryValidationServer').mockResolvedValueOnce({
        status: 'VALID',
        amount: '62250.00',
        currency: 'EUR',
        tran_id: payment.paymentId,
      });

      await expect(
        sslVerifier.verifyPayment(payment, { val_id: 'VAL_CURR_MISMATCH' }),
      ).rejects.toThrow('SSLCommerz currency mismatch: expected BDT');
    });

    it('3.5 Successfully verifies genuine SSLCommerz validation response', async () => {
      const { payment } = await seedTestPayment(PaymentMethod.SSLCOMMERZ, 6225000);

      jest.spyOn(sslVerifier, 'queryValidationServer').mockResolvedValueOnce({
        status: 'VALID',
        amount: '62250.00',
        currency: 'BDT',
        tran_id: payment.paymentId,
        bank_tran_id: 'BANK_TXN_8888',
        card_type: 'VISA-CityBank',
        card_issuer: 'City Bank',
        tran_date: '2026-10-16 20:00:00',
      });

      const result = await sslVerifier.verifyPayment(payment, { val_id: 'VAL_AUTHENTIC' });
      expect(result.verified).toBe(true);
      expect(result.gatewayTransactionId).toBe('BANK_TXN_8888');
      expect(result.amountBdt).toBe(62250);
      expect(result.gatewayStatus).toBe('VALID');
    });

    it('3.6 Reports READY_FOR_STAGING when credentials configured, BLOCKED when missing', () => {
      expect(sslVerifier.getReadinessStatus()).toBe('READY_FOR_STAGING');

      const mockConfig = { get: jest.fn().mockReturnValue(undefined) } as any;
      const unconfigured = new SslCommerzVerifier(mockConfig);
      expect(unconfigured.getReadinessStatus()).toBe('BLOCKED');
      expect(unconfigured.getReadinessDetails().missingConfigs).toContain('SSLCOMMERZ_STORE_ID');
    });
  });

  // ==========================================
  // SECTION 4: End-to-End Webhook & Settlement Integration
  // ==========================================
  describe('4. End-to-End Verified Settlement Integration', () => {
    it('4.1 Verified bKash webhook executes multi-document atomic transaction and credits holdings', async () => {
      const { userId, order, payment } = await seedTestPayment(PaymentMethod.BKASH, 6225000);

      // Mock authoritative verification
      jest.spyOn(bkashVerifier, 'queryBkashPaymentStatus').mockResolvedValueOnce({
        paymentID: 'BKASH_E2E_01',
        trxID: 'BKASH_E2E_TRX_123',
        transactionStatus: 'Completed',
        amount: '62250.00',
        currency: 'BDT',
        merchantInvoiceNumber: payment.paymentId,
      });

      const res = await paymentService.processWebhook({
        paymentId: payment.paymentId,
        gatewayTransactionId: 'BKASH_E2E_TRX_123',
        gatewayStatusCode: '0000',
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe(PaymentStatus.SUCCESSFUL);

      // Verify DB records
      const savedPayment = await paymentModel.findOne({ paymentId: payment.paymentId });
      expect(savedPayment?.status).toBe(PaymentStatus.SUCCESSFUL);
      expect(savedPayment?.gatewayTransactionId).toBe('BKASH_E2E_TRX_123');
      expect(savedPayment?.gatewayResponseMetadata?.verifiedProvider).toBe(PaymentMethod.BKASH);

      const savedOrder = await orderModel.findOne({ orderId: order.orderId });
      expect(savedOrder?.status).toBe(OrderStatus.COMPLETED);

      const holding = await holdingModel.findOne({ userId: new Types.ObjectId(userId) });
      expect(holding?.weightMilligramsAvailable).toBe(5000);

      const ledger = await ledgerModel.findOne({ paymentId: payment.paymentId });
      expect(ledger?.type).toBe(LedgerEntryType.GOLD_PURCHASE);
      expect(ledger?.creditGoldMg).toBe(5000);

      const audit = await auditModel.findOne({ entityId: order.orderId });
      expect(audit?.action).toBe('ORDER_SETTLED');
    });

    it('4.2 Replay Attack & Duplicate Webhook Idempotency: exact same callback returns idempotency cleanly without duplicate gold', async () => {
      const { userId, payment } = await seedTestPayment(PaymentMethod.BKASH, 6225000);

      jest.spyOn(bkashVerifier, 'queryBkashPaymentStatus').mockResolvedValueOnce({
        paymentID: 'BKASH_REPLAY',
        trxID: 'BKASH_REPLAY_TRX',
        transactionStatus: 'Completed',
        amount: '62250.00',
        currency: 'BDT',
        merchantInvoiceNumber: payment.paymentId,
      });

      // First webhook
      const first = await paymentService.processWebhook({
        paymentId: payment.paymentId,
        gatewayTransactionId: 'BKASH_REPLAY_TRX',
      });
      expect(first.success).toBe(true);

      // Duplicate / Replay webhook
      const duplicate = await paymentService.processWebhook({
        paymentId: payment.paymentId,
        gatewayTransactionId: 'BKASH_REPLAY_TRX',
      });
      expect(duplicate.success).toBe(true);
      expect(duplicate.message).toBe('Payment already processed and settled');

      // Verify gold holdings credited ONLY ONCE
      const holding = await holdingModel.findOne({ userId: new Types.ObjectId(userId) });
      expect(holding?.weightMilligramsAvailable).toBe(5000);

      // Verify ledger entries recorded ONLY ONCE
      const ledgerCount = await ledgerModel.countDocuments({ paymentId: payment.paymentId });
      expect(ledgerCount).toBe(1);
    });

    it('4.3 Rejects duplicate gatewayTransactionId across different payments with 409 Conflict', async () => {
      const { payment: paymentA } = await seedTestPayment(PaymentMethod.BKASH, 6225000);
      const { payment: paymentB } = await seedTestPayment(PaymentMethod.BKASH, 6225000);

      // Settle paymentA with TRX_COLLISION
      jest.spyOn(bkashVerifier, 'queryBkashPaymentStatus').mockResolvedValueOnce({
        paymentID: 'PAY_A',
        trxID: 'TRX_COLLISION',
        transactionStatus: 'Completed',
        amount: '62250.00',
        currency: 'BDT',
        merchantInvoiceNumber: paymentA.paymentId,
      });

      await paymentService.processWebhook({
        paymentId: paymentA.paymentId,
        gatewayTransactionId: 'TRX_COLLISION',
      });

      // Now attempt to settle paymentB using the same TRX_COLLISION
      jest.spyOn(bkashVerifier, 'queryBkashPaymentStatus').mockResolvedValueOnce({
        paymentID: 'PAY_B',
        trxID: 'TRX_COLLISION',
        transactionStatus: 'Completed',
        amount: '62250.00',
        currency: 'BDT',
        merchantInvoiceNumber: paymentB.paymentId,
      });

      await expect(
        paymentService.processWebhook({
          paymentId: paymentB.paymentId,
          gatewayTransactionId: 'TRX_COLLISION',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('4.4 Rejects unknown / non-existent payment ID with 404 NotFound', async () => {
      await expect(
        paymentService.processWebhook({
          paymentId: 'NON_EXISTENT_PAYMENT_999',
          gatewayTransactionId: 'TRX_ANY',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('4.5 Payment provider reporting failure marks payment & order as FAILED without gold allocation', async () => {
      const { userId, order, payment } = await seedTestPayment(PaymentMethod.BKASH, 6225000);

      const res = await paymentService.processWebhook({
        paymentId: payment.paymentId,
        gatewayTransactionId: 'TRX_FAILED_001',
        gatewayStatusCode: '9999', // Non-success gateway code
      });

      expect(res.success).toBe(false);

      const updatedPayment = await paymentModel.findOne({ paymentId: payment.paymentId });
      expect(updatedPayment?.status).toBe(PaymentStatus.FAILED);

      const updatedOrder = await orderModel.findOne({ orderId: order.orderId });
      expect(updatedOrder?.status).toBe(OrderStatus.FAILED);

      // Verify NO gold was credited
      const holding = await holdingModel.findOne({ userId: new Types.ObjectId(userId) });
      expect(holding).toBeNull();

      // Verify NO ledger entry was created
      const ledger = await ledgerModel.findOne({ paymentId: payment.paymentId });
      expect(ledger).toBeNull();
    });

    it('4.6 Provider readiness diagnostics exposes status of all gateways', () => {
      const status = verificationService.getProvidersStatus();
      expect(status[PaymentMethod.BKASH]).toBeDefined();
      expect(status[PaymentMethod.NAGAD]).toBeDefined();
      expect(status[PaymentMethod.SSLCOMMERZ]).toBeDefined();

      expect(status[PaymentMethod.BKASH].status).toBe('READY_FOR_STAGING');
      expect(status[PaymentMethod.NAGAD].status).toBe('READY_FOR_STAGING');
      expect(status[PaymentMethod.SSLCOMMERZ].status).toBe('READY_FOR_STAGING');
    });
  });
});
