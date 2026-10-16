import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, getModelToken, getConnectionToken } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { ConfigModule } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  Role,
  OrderStatus,
  OrderType,
  PaymentStatus,
  PaymentMethod,
  PurityGrade,
  LedgerEntryType,
} from '@aurumsave/shared';
import { Payment, PaymentSchema, PaymentDocument } from '../database/schemas/payment.schema';
import { Order, OrderSchema, OrderDocument } from '../database/schemas/order.schema';
import { GoldHolding, GoldHoldingSchema, GoldHoldingDocument } from '../database/schemas/gold-holding.schema';
import { LedgerEntry, LedgerEntrySchema, LedgerEntryDocument } from '../database/schemas/ledger-entry.schema';
import { AuditLog, AuditLogSchema, AuditLogDocument } from '../database/schemas/audit-log.schema';
import { PaymentService } from '../modules/payments/payment.service';
import { LedgerService } from '../modules/ledger/ledger.service';
import { AuditService } from '../modules/audit/audit.service';

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/aurumsave_test_atomicity';
const WEBHOOK_SECRET = 'aurumsave_webhook_signing_secret_dev_2026';

describe('Financial Settlement Atomicity & Multi-Document Transaction Suite', () => {
  let module: TestingModule;
  let connection: Connection;
  let paymentService: PaymentService;
  let ledgerService: LedgerService;
  let auditService: AuditService;

  let paymentModel: Model<PaymentDocument>;
  let orderModel: Model<OrderDocument>;
  let holdingModel: Model<GoldHoldingDocument>;
  let ledgerModel: Model<LedgerEntryDocument>;
  let auditModel: Model<AuditLogDocument>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({
            NODE_ENV: 'development',
            PAYMENT_WEBHOOK_SECRET: WEBHOOK_SECRET,
            ALLOW_SANDBOX_PAYMENTS: 'true',
          })],
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
      providers: [PaymentService, LedgerService, AuditService],
    }).compile();

    connection = module.get<Connection>(getConnectionToken());
    paymentService = module.get<PaymentService>(PaymentService);
    ledgerService = module.get<LedgerService>(LedgerService);
    auditService = module.get<AuditService>(AuditService);

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
  }, 30000);

  beforeEach(async () => {
    await paymentModel.deleteMany({});
    await orderModel.deleteMany({});
    await holdingModel.deleteMany({});
    await ledgerModel.deleteMany({});
    await auditModel.deleteMany({});
  });

  afterAll(async () => {
    if (connection) {
      await connection.dropDatabase();
      await connection.close();
    }
    await module.close();
  });

  function generateSignature(paymentId: string, amountPoisha: number, txnId: string): string {
    const data = `${paymentId}:${amountPoisha}:${txnId}`;
    return crypto.createHmac('sha256', WEBHOOK_SECRET).update(data).digest('hex');
  }

  async function seedOrderAndPayment(overrides?: {
    userId?: string;
    weightMg?: number;
    amountPoisha?: number;
    purity?: PurityGrade;
  }) {
    const userId = overrides?.userId || new Types.ObjectId().toString();
    const weightMg = overrides?.weightMg || 5000;
    const amountPoisha = overrides?.amountPoisha || 6225000;
    const purity = overrides?.purity || PurityGrade.K24;

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const paymentId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const order = await orderModel.create({
      orderId,
      userId: new Types.ObjectId(userId),
      orderType: OrderType.BUY,
      quoteId: 'QTE-TEST-001',
      purity,
      weightMilligrams: weightMg,
      totalPoisha: amountPoisha,
      status: OrderStatus.AWAITING_PAYMENT,
      paymentMethod: PaymentMethod.BKASH,
      paymentId,
      statusHistory: [{ status: OrderStatus.AWAITING_PAYMENT, timestamp: new Date() }],
    });

    const payment = await paymentModel.create({
      paymentId,
      orderId,
      userId: new Types.ObjectId(userId),
      gateway: PaymentMethod.BKASH,
      amountPoisha,
      status: PaymentStatus.PENDING,
      gatewayResponseMetadata: { mode: 'LIVE_TEST' },
    });

    return { userId, order, payment };
  }

  it('1. Normal successful settlement commits all records transactionally', async () => {
    const { userId, order, payment } = await seedOrderAndPayment();
    const txnId = `BKASH-TXN-${Date.now()}`;
    const signature = generateSignature(payment.paymentId, payment.amountPoisha, txnId);

    const result = await paymentService.processWebhook({
      paymentId: payment.paymentId,
      gatewayTransactionId: txnId,
      signature,
      gatewayStatusCode: '0000',
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe(PaymentStatus.SUCCESSFUL);

    // Verify Payment updated
    const savedPayment = await paymentModel.findOne({ paymentId: payment.paymentId });
    expect(savedPayment?.status).toBe(PaymentStatus.SUCCESSFUL);
    expect(savedPayment?.gatewayTransactionId).toBe(txnId);

    // Verify Order completed
    const savedOrder = await orderModel.findOne({ orderId: order.orderId });
    expect(savedOrder?.status).toBe(OrderStatus.COMPLETED);

    // Verify Customer Holding incremented
    const holding = await holdingModel.findOne({ userId: new Types.ObjectId(userId), purity: PurityGrade.K24 });
    expect(holding?.weightMilligramsAvailable).toBe(order.weightMilligrams);
    expect(holding?.totalCostPoisha).toBe(order.totalPoisha);

    // Verify Ledger Entry recorded with running balance
    const ledger = await ledgerModel.findOne({ paymentId: payment.paymentId });
    expect(ledger?.type).toBe(LedgerEntryType.GOLD_PURCHASE);
    expect(ledger?.creditGoldMg).toBe(order.weightMilligrams);
    expect(ledger?.runningGoldBalanceMg).toBe(order.weightMilligrams);

    // Verify Audit Log recorded
    const audit = await auditModel.findOne({ entityId: order.orderId });
    expect(audit).toBeDefined();
    expect(audit?.action).toBe('ORDER_SETTLED');
  });

  it('2. Duplicate webhook delivery returns clean idempotency without crediting gold twice', async () => {
    const { userId, payment } = await seedOrderAndPayment();
    const txnId = `BKASH-TXN-DUP-${Date.now()}`;
    const signature = generateSignature(payment.paymentId, payment.amountPoisha, txnId);

    const first = await paymentService.processWebhook({
      paymentId: payment.paymentId,
      gatewayTransactionId: txnId,
      signature,
    });
    expect(first.success).toBe(true);

    // Second webhook callback
    const second = await paymentService.processWebhook({
      paymentId: payment.paymentId,
      gatewayTransactionId: txnId,
      signature,
    });
    expect(second.success).toBe(true);
    expect(second.message).toBe('Payment already processed and settled');

    // Verify gold was NOT credited twice
    const holding = await holdingModel.findOne({ userId: new Types.ObjectId(userId), purity: PurityGrade.K24 });
    expect(holding?.weightMilligramsAvailable).toBe(5000);

    const ledgerEntries = await ledgerModel.find({ paymentId: payment.paymentId });
    expect(ledgerEntries.length).toBe(1);
  });

  it('3. Concurrent duplicate settlement attempts settle exactly once without double balance credit', async () => {
    const { userId, payment } = await seedOrderAndPayment();
    const txnId = `BKASH-TXN-CONCURRENT-${Date.now()}`;
    const signature = generateSignature(payment.paymentId, payment.amountPoisha, txnId);

    const [res1, res2] = await Promise.allSettled([
      paymentService.processWebhook({
        paymentId: payment.paymentId,
        gatewayTransactionId: txnId,
        signature,
      }),
      paymentService.processWebhook({
        paymentId: payment.paymentId,
        gatewayTransactionId: txnId,
        signature,
      }),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    expect(successes.length).toBeGreaterThanOrEqual(1);

    // Vault holding must strictly reflect exactly one purchase (5000 mg)
    const holding = await holdingModel.findOne({ userId: new Types.ObjectId(userId), purity: PurityGrade.K24 });
    expect(holding?.weightMilligramsAvailable).toBe(5000);

    const ledgerCount = await ledgerModel.countDocuments({ paymentId: payment.paymentId });
    expect(ledgerCount).toBe(1);
  });

  it('4. Process interruption recovery: heals state when payment is marked successful but order was uncompleted', async () => {
    const { userId, order, payment } = await seedOrderAndPayment();
    const txnId = `BKASH-TXN-CRASH-${Date.now()}`;
    const signature = generateSignature(payment.paymentId, payment.amountPoisha, txnId);

    // Simulate process killed after payment update in previous legacy run
    payment.status = PaymentStatus.SUCCESSFUL;
    payment.gatewayTransactionId = txnId;
    await payment.save();
    // Order is still AWAITING_PAYMENT, zero gold credited, zero ledger entries

    // Webhook retry arrives
    const recoveryRes = await paymentService.processWebhook({
      paymentId: payment.paymentId,
      gatewayTransactionId: txnId,
      signature,
    });

    expect(recoveryRes.success).toBe(true);
    expect(recoveryRes.isRecovered).toBe(true);

    // Verify order is now completed
    const healedOrder = await orderModel.findOne({ orderId: order.orderId });
    expect(healedOrder?.status).toBe(OrderStatus.COMPLETED);

    // Verify gold was credited
    const holding = await holdingModel.findOne({ userId: new Types.ObjectId(userId), purity: PurityGrade.K24 });
    expect(holding?.weightMilligramsAvailable).toBe(5000);

    // Verify ledger entry was created
    const ledger = await ledgerModel.findOne({ paymentId: payment.paymentId });
    expect(ledger).toBeDefined();
    expect(ledger?.creditGoldMg).toBe(5000);
  });

  it('5. Missing ledger entry recovery: heals state when payment & order are marked successful but ledger entry is missing', async () => {
    const { userId, order, payment } = await seedOrderAndPayment();
    const txnId = `BKASH-TXN-NO-LEDGER-${Date.now()}`;
    const signature = generateSignature(payment.paymentId, payment.amountPoisha, txnId);

    // Simulate state where payment and order were updated, but process crashed before ledger write
    payment.status = PaymentStatus.SUCCESSFUL;
    payment.gatewayTransactionId = txnId;
    await payment.save();

    order.status = OrderStatus.COMPLETED;
    await order.save();

    // Zero ledger entries exist
    expect(await ledgerModel.countDocuments({ paymentId: payment.paymentId })).toBe(0);

    // Webhook retry arrives
    const res = await paymentService.processWebhook({
      paymentId: payment.paymentId,
      gatewayTransactionId: txnId,
      signature,
    });

    expect(res.success).toBe(true);
    expect(res.isRecovered).toBe(true);

    // Verify ledger entry is now safely created
    const ledger = await ledgerModel.findOne({ paymentId: payment.paymentId });
    expect(ledger).toBeDefined();
    expect(ledger?.creditGoldMg).toBe(5000);

    // Verify customer holding was credited
    const holding = await holdingModel.findOne({ userId: new Types.ObjectId(userId), purity: PurityGrade.K24 });
    expect(holding?.weightMilligramsAvailable).toBe(5000);
  });

  it('6. Transaction abort leaves all financial records unchanged upon mid-flight error', async () => {
    const { userId, order, payment } = await seedOrderAndPayment();
    const txnId = `BKASH-TXN-ABORT-${Date.now()}`;
    const signature = generateSignature(payment.paymentId, payment.amountPoisha, txnId);

    // Force an error inside the ledger service during creditGoldPurchase
    jest.spyOn(ledgerService, 'creditGoldPurchase').mockImplementationOnce(() => {
      throw new Error('Database disk error during ledger insertion');
    });

    await expect(
      paymentService.processWebhook({
        paymentId: payment.paymentId,
        gatewayTransactionId: txnId,
        signature,
      }),
    ).rejects.toThrow('Database disk error during ledger insertion');

    // Verify multi-document transaction rolled back completely
    const savedPayment = await paymentModel.findOne({ paymentId: payment.paymentId });
    expect(savedPayment?.status).toBe(PaymentStatus.PENDING); // Not SUCCESSFUL!

    const savedOrder = await orderModel.findOne({ orderId: order.orderId });
    expect(savedOrder?.status).toBe(OrderStatus.AWAITING_PAYMENT); // Not COMPLETED!

    const holding = await holdingModel.findOne({ userId: new Types.ObjectId(userId), purity: PurityGrade.K24 });
    expect(holding).toBeNull(); // No gold credited!

    const ledgerCount = await ledgerModel.countDocuments({ paymentId: payment.paymentId });
    expect(ledgerCount).toBe(0); // No phantom ledger entries!
  });

  it('7. Unique-index collision: duplicate gatewayTransactionId across different payments is rejected', async () => {
    const { payment: payment1 } = await seedOrderAndPayment();
    const { payment: payment2 } = await seedOrderAndPayment();

    const sharedTxnId = `BKASH-COLLISION-${Date.now()}`;

    // Settle first payment
    const sig1 = generateSignature(payment1.paymentId, payment1.amountPoisha, sharedTxnId);
    await paymentService.processWebhook({
      paymentId: payment1.paymentId,
      gatewayTransactionId: sharedTxnId,
      signature: sig1,
    });

    // Attempt to settle second payment with same provider transaction ID
    const sig2 = generateSignature(payment2.paymentId, payment2.amountPoisha, sharedTxnId);
    await expect(
      paymentService.processWebhook({
        paymentId: payment2.paymentId,
        gatewayTransactionId: sharedTxnId,
        signature: sig2,
      }),
    ).rejects.toThrow('already been settled');
  });

  it('8. Refund cannot reverse the same settlement twice and restores vault balance', async () => {
    const { userId, payment } = await seedOrderAndPayment();
    const txnId = `BKASH-TXN-REFUND-${Date.now()}`;
    const signature = generateSignature(payment.paymentId, payment.amountPoisha, txnId);

    await paymentService.processWebhook({
      paymentId: payment.paymentId,
      gatewayTransactionId: txnId,
      signature,
    });

    // Verify gold was in vault
    const preRefundHolding = await holdingModel.findOne({ userId: new Types.ObjectId(userId), purity: PurityGrade.K24 });
    expect(preRefundHolding?.weightMilligramsAvailable).toBe(5000);

    // Officer initiates refund
    const refundRes = await paymentService.refundPayment(
      payment.paymentId,
      'officer-001',
      Role.FINANCE_OFFICER,
      'Customer cancellation within grace period',
    );
    expect(refundRes.success).toBe(true);
    expect(refundRes.status).toBe(PaymentStatus.REFUNDED);

    // Verify gold was reversed from vault
    const postRefundHolding = await holdingModel.findOne({ userId: new Types.ObjectId(userId), purity: PurityGrade.K24 });
    expect(postRefundHolding?.weightMilligramsAvailable).toBe(0);

    // Attempt second duplicate refund
    await expect(
      paymentService.refundPayment(
        payment.paymentId,
        'officer-001',
        Role.FINANCE_OFFICER,
        'Second refund attempt',
      ),
    ).rejects.toThrow('already been refunded');

    // Balance must remain 0, never negative
    const finalHolding = await holdingModel.findOne({ userId: new Types.ObjectId(userId), purity: PurityGrade.K24 });
    expect(finalHolding?.weightMilligramsAvailable).toBe(0);
  });

  it('9. Sandbox simulation settlement completes transactionally and heals gracefully', async () => {
    const { userId, order, payment } = await seedOrderAndPayment();

    const simRes = await paymentService.simulateSandboxPayment({
      paymentId: payment.paymentId,
      success: true,
    });

    expect(simRes.success).toBe(true);
    expect(simRes.status).toBe(PaymentStatus.SUCCESSFUL);

    const savedPayment = await paymentModel.findOne({ paymentId: payment.paymentId });
    expect(savedPayment?.status).toBe(PaymentStatus.SUCCESSFUL);

    const savedOrder = await orderModel.findOne({ orderId: order.orderId });
    expect(savedOrder?.status).toBe(OrderStatus.COMPLETED);

    const holding = await holdingModel.findOne({ userId: new Types.ObjectId(userId), purity: PurityGrade.K24 });
    expect(holding?.weightMilligramsAvailable).toBe(order.weightMilligrams);
  });

  it('10. Standalone topology safeguard: fails safely when multi-document transactions are unsupported', async () => {
    const { payment } = await seedOrderAndPayment();
    const txnId = `BKASH-TXN-TOPOLOGY-${Date.now()}`;
    const signature = generateSignature(payment.paymentId, payment.amountPoisha, txnId);

    // Mock topology check returning false
    jest.spyOn(paymentService, 'isTransactionSupported').mockReturnValueOnce(false);

    await expect(
      paymentService.processWebhook({
        paymentId: payment.paymentId,
        gatewayTransactionId: txnId,
        signature,
      }),
    ).rejects.toThrow('Financial settlement requires a MongoDB Replica Set or Sharded cluster');

    // Confirm nothing was written
    const savedPayment = await paymentModel.findOne({ paymentId: payment.paymentId });
    expect(savedPayment?.status).toBe(PaymentStatus.PENDING);
  });
});
