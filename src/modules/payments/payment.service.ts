import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PaymentStatus, OrderStatus, OrderType, Role, AuditAction, CONVERSIONS } from '@aurumsave/shared';
import { Payment, PaymentDocument } from '../../database/schemas/payment.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import { InitiatePaymentDto, ProcessWebhookDto, SimulateSandboxPaymentDto } from './payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const order = await this.orderModel.findOne({ orderId: dto.orderId });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId.toString() !== userId) {
      throw new BadRequestException('You do not own this order');
    }

    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(`Order cannot be paid in status: ${order.status}`);
    }

    const paymentId = `PAY-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;

    const payment = await this.paymentModel.create({
      paymentId,
      orderId: order.orderId,
      userId: new Types.ObjectId(userId),
      gateway: dto.gateway,
      amountPoisha: order.totalPoisha,
      status: PaymentStatus.PENDING,
      gatewayResponseMetadata: {
        mode: 'SANDBOX_BANGLADESH_FINTECH_MOCK',
        note: 'Simulated MFS Gateway. In production, this redirects to bKash / Nagad / SSLCommerz payment page.',
      },
    });

    order.paymentId = payment.paymentId;
    order.paymentMethod = dto.gateway;
    await order.save();

    return {
      paymentId: payment.paymentId,
      orderId: order.orderId,
      amountBdt: Number((order.totalPoisha / CONVERSIONS.POISHA_PER_BDT).toFixed(2)),
      gateway: dto.gateway,
      status: payment.status,
      isSandbox: true,
      simulationCheckoutUrl: `/payment/checkout?paymentId=${payment.paymentId}`,
    };
  }

  verifyWebhookSignature(payment: PaymentDocument, dto: ProcessWebhookDto): boolean {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const secret =
      this.configService.get<string>(`${payment.gateway}_WEBHOOK_SECRET`) ||
      this.configService.get<string>('PAYMENT_WEBHOOK_SECRET') ||
      (isProd ? '' : 'aurumsave_webhook_signing_secret_dev_2026');

    if (!secret || secret.trim() === '') {
      if (isProd) {
        throw new UnauthorizedException(
          `Webhook secret for gateway ${payment.gateway} is not configured on server. Rejecting callback.`,
        );
      }
      return true;
    }

    if (!dto.signature) {
      throw new UnauthorizedException('Missing required cryptographic signature (signature field or X-Gateway-Signature header)');
    }

    const expectedData = `${dto.paymentId}:${payment.amountPoisha}:${dto.gatewayTransactionId}`;
    const hmac = crypto.createHmac('sha256', secret);
    const expectedSignature = hmac.update(expectedData).digest('hex');

    const isValid =
      dto.signature === expectedSignature ||
      (dto.signature.length === expectedSignature.length &&
        crypto.timingSafeEqual(Buffer.from(dto.signature), Buffer.from(expectedSignature)));

    if (!isValid) {
      throw new UnauthorizedException('Invalid payment webhook signature: signature mismatch');
    }

    return true;
  }

  async processWebhook(dto: ProcessWebhookDto) {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const payment = await this.paymentModel.findOne({ paymentId: dto.paymentId });
    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (payment.status === PaymentStatus.SUCCESSFUL) {
      // Idempotent early return
      return {
        success: true,
        message: 'Payment already processed and settled',
        paymentId: payment.paymentId,
      };
    }

    // Verify cryptographic signature from external gateway
    this.verifyWebhookSignature(payment, dto);

    // Priority 0: Prevent sandbox sessions from settling real gold in production
    if (isProd && payment.gatewayResponseMetadata?.mode === 'SANDBOX_BANGLADESH_FINTECH_MOCK') {
      throw new BadRequestException('Sandbox payment session cannot create verified gold holdings in production mode');
    }

    // Enforce unique provider transaction reference check across all payments
    if (dto.gatewayTransactionId) {
      const existingTxn = await this.paymentModel.findOne({
        gatewayTransactionId: dto.gatewayTransactionId,
        paymentId: { $ne: dto.paymentId },
      });
      if (existingTxn) {
        throw new ConflictException(
          `Gateway transaction reference ${dto.gatewayTransactionId} has already been settled for payment ${existingTxn.paymentId}`,
        );
      }
    }

    const order = await this.orderModel.findOne({ orderId: payment.orderId });
    if (!order) {
      throw new NotFoundException('Associated order not found');
    }

    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(
        `Cannot process payment for order ${order.orderId} in status: ${order.status}`,
      );
    }

    if (dto.gatewayStatusCode && dto.gatewayStatusCode !== '0000' && dto.gatewayStatusCode !== 'SUCCESS') {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = `Payment rejected by gateway code: ${dto.gatewayStatusCode}`;
      await payment.save();

      order.status = OrderStatus.FAILED;
      order.failureReason = payment.failureReason;
      order.statusHistory.push({
        status: OrderStatus.FAILED,
        note: `Payment failed on ${payment.gateway}: ${payment.failureReason}`,
        timestamp: new Date(),
      });
      await order.save();

      return { success: false, message: 'Payment recorded as failed' };
    }

    // Atomic conditional update on payment to prevent concurrent race conditions
    const updatedPayment = await this.paymentModel.findOneAndUpdate(
      {
        paymentId: dto.paymentId,
        status: { $ne: PaymentStatus.SUCCESSFUL },
      },
      {
        $set: {
          status: PaymentStatus.SUCCESSFUL,
          gatewayTransactionId: dto.gatewayTransactionId,
          verifiedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!updatedPayment) {
      const current = await this.paymentModel.findOne({ paymentId: dto.paymentId });
      if (current?.status === PaymentStatus.SUCCESSFUL) {
        return {
          success: true,
          message: 'Payment already processed and settled',
          paymentId: current.paymentId,
        };
      }
      throw new ConflictException('Payment status conflict: payment already resolved');
    }

    // Atomic conditional update on order
    const updatedOrder = await this.orderModel.findOneAndUpdate(
      {
        orderId: payment.orderId,
        status: OrderStatus.AWAITING_PAYMENT,
      },
      {
        $set: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
        },
        $push: {
          statusHistory: {
            $each: [
              {
                status: OrderStatus.PAYMENT_CONFIRMED,
                note: `Payment verified via ${payment.gateway} (Ref: ${dto.gatewayTransactionId})`,
                timestamp: new Date(),
              },
              {
                status: OrderStatus.COMPLETED,
                note: `Allocated ${order.weightMilligrams / 1000}g ${order.purity} gold to customer vault`,
                timestamp: new Date(),
              },
            ],
          },
        },
      },
      { new: true },
    );

    if (!updatedOrder) {
      this.logger.warn(`Order ${payment.orderId} was already resolved during settlement`);
      return {
        success: true,
        message: 'Payment verified and order already completed',
        paymentId: updatedPayment.paymentId,
      };
    }

    // Safe Double-Entry Ledger Commitment (guaranteed idempotent)
    await this.ledgerService.creditGoldPurchase({
      userId: order.userId.toString(),
      orderId: order.orderId,
      paymentId: payment.paymentId,
      purity: order.purity,
      weightMilligrams: order.weightMilligrams,
      costPoisha: order.totalPoisha,
      description: `Gold allocation for Order #${order.orderId} via ${payment.gateway}`,
    });

    await this.auditService.log({
      actorId: order.userId.toString(),
      actorRole: Role.CUSTOMER,
      action: AuditAction.ORDER_SETTLED,
      entityType: 'Order',
      entityId: order.orderId,
      details: {
        paymentId: payment.paymentId,
        gateway: payment.gateway,
        txnId: dto.gatewayTransactionId,
        goldMg: order.weightMilligrams,
      },
    });

    return {
      success: true,
      message: 'Payment verified and gold credited to customer vault successfully',
      paymentId: payment.paymentId,
      orderId: order.orderId,
      status: PaymentStatus.SUCCESSFUL,
    };
  }

  async simulateSandboxPayment(dto: SimulateSandboxPaymentDto) {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const allowSandbox = this.configService.get<string>('ALLOW_SANDBOX_PAYMENTS') === 'true';

    // Priority 0: Production Sandbox Isolation
    // Sandbox payment simulation must always be denied when NODE_ENV=production, regardless of ALLOW_SANDBOX_PAYMENTS.
    if (isProd) {
      throw new ForbiddenException(
        'Sandbox payment simulation is strictly prohibited in production mode under all circumstances.',
      );
    }

    if (!allowSandbox) {
      throw new ForbiddenException(
        'Sandbox payment simulation is disabled. ALLOW_SANDBOX_PAYMENTS must be set to true.',
      );
    }

    const payment = await this.paymentModel.findOne({ paymentId: dto.paymentId });
    if (!payment) {
      throw new NotFoundException('Payment record not found');
    }

    if (payment.status === PaymentStatus.SUCCESSFUL) {
      return {
        success: true,
        message: 'Payment already processed and settled',
        paymentId: payment.paymentId,
      };
    }

    const order = await this.orderModel.findOne({ orderId: payment.orderId });
    if (!order) {
      throw new NotFoundException('Associated order not found');
    }

    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(
        `Cannot complete payment for order ${order.orderId} in status: ${order.status}`,
      );
    }

    if (dto.success === false) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = 'Payment rejected in sandbox simulator';
      await payment.save();

      order.status = OrderStatus.FAILED;
      order.failureReason = payment.failureReason;
      order.statusHistory.push({
        status: OrderStatus.FAILED,
        note: `Simulated payment cancelled on ${payment.gateway}`,
        timestamp: new Date(),
      });
      await order.save();

      return { success: false, message: 'Sandbox payment recorded as failed' };
    }

    const simTxnId = `SIM-TXN-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;

    // Atomic conditional update on payment
    const updatedPayment = await this.paymentModel.findOneAndUpdate(
      {
        paymentId: dto.paymentId,
        status: { $ne: PaymentStatus.SUCCESSFUL },
      },
      {
        $set: {
          status: PaymentStatus.SUCCESSFUL,
          gatewayTransactionId: simTxnId,
          verifiedAt: new Date(),
          gatewayResponseMetadata: {
            ...payment.gatewayResponseMetadata,
            isSandboxSimulation: true,
            simulatedAt: new Date().toISOString(),
          },
        },
      },
      { new: true },
    );

    if (!updatedPayment) {
      return {
        success: true,
        message: 'Payment already processed and settled',
        paymentId: payment.paymentId,
      };
    }

    // Atomic conditional update on order
    const updatedOrder = await this.orderModel.findOneAndUpdate(
      {
        orderId: payment.orderId,
        status: OrderStatus.AWAITING_PAYMENT,
      },
      {
        $set: {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
        },
        $push: {
          statusHistory: {
            $each: [
              {
                status: OrderStatus.PAYMENT_CONFIRMED,
                note: `Simulated payment verified via ${payment.gateway} (Sandbox Ref: ${simTxnId})`,
                timestamp: new Date(),
              },
              {
                status: OrderStatus.COMPLETED,
                note: `Allocated ${order.weightMilligrams / 1000}g ${order.purity} gold to customer vault (Sandbox)`,
                timestamp: new Date(),
              },
            ],
          },
        },
      },
      { new: true },
    );

    // Safe Double-Entry Ledger Commitment
    await this.ledgerService.creditGoldPurchase({
      userId: order.userId.toString(),
      orderId: order.orderId,
      paymentId: payment.paymentId,
      purity: order.purity,
      weightMilligrams: order.weightMilligrams,
      costPoisha: order.totalPoisha,
      description: `[SANDBOX] Gold allocation for Order #${order.orderId} via ${payment.gateway}`,
    });

    await this.auditService.log({
      actorId: order.userId.toString(),
      actorRole: Role.CUSTOMER,
      action: AuditAction.ORDER_SETTLED,
      entityType: 'Order',
      entityId: order.orderId,
      details: {
        paymentId: payment.paymentId,
        gateway: payment.gateway,
        txnId: payment.gatewayTransactionId,
        goldMg: order.weightMilligrams,
        mode: 'SANDBOX',
      },
    });

    return {
      success: true,
      message: 'Sandbox payment verified and test gold credited to customer vault successfully',
      paymentId: payment.paymentId,
      orderId: order.orderId,
      status: PaymentStatus.SUCCESSFUL,
      isSandbox: true,
    };
  }

  async getPaymentDetails(paymentId: string, user?: { id: string; role: Role }) {
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (user) {
      const isOwner = payment.userId.toString() === user.id;
      const isStaff = [
        Role.ADMIN,
        Role.SUPER_ADMIN,
        Role.FINANCE_OFFICER,
        Role.AUDITOR,
      ].includes(user.role);

      if (!isOwner && !isStaff) {
        throw new ForbiddenException('You do not have permission to inspect this payment session');
      }
    }

    const order = await this.orderModel.findOne({ orderId: payment.orderId });
    return {
      payment,
      order,
    };
  }

  async refundPayment(
    paymentId: string,
    officerId: string,
    officerRole: Role,
    reason?: string,
  ) {
    const updatedPayment = await this.paymentModel.findOneAndUpdate(
      {
        paymentId,
        status: { $ne: PaymentStatus.REFUNDED },
      },
      {
        $set: {
          status: PaymentStatus.REFUNDED,
          failureReason: reason || 'Refunded by operations officer',
        },
      },
      { new: true },
    );

    if (!updatedPayment) {
      throw new BadRequestException('This payment has already been refunded or does not exist');
    }

    const order = await this.orderModel.findOne({ orderId: updatedPayment.orderId });
    if (!order) {
      throw new NotFoundException('Associated order not found');
    }

    // If gold was already credited to vault, reverse holding and log ledger reversal
    if (order.status === OrderStatus.COMPLETED && order.orderType === OrderType.BUY) {
      await this.ledgerService.reverseGoldPurchase({
        userId: order.userId.toString(),
        orderId: order.orderId,
        paymentId: updatedPayment.paymentId,
        purity: order.purity,
        weightMilligrams: order.weightMilligrams,
        refundPoisha: updatedPayment.amountPoisha,
        description: `Refund & gold reversal for Order #${order.orderId}: ${reason || 'Customer requested / authorized refund'}`,
      });
    }

    await this.orderModel.findOneAndUpdate(
      { orderId: updatedPayment.orderId },
      {
        $set: { status: OrderStatus.REFUNDED },
        $push: {
          statusHistory: {
            status: OrderStatus.REFUNDED,
            note: `Refund processed by ${officerRole} (Ref: ${officerId}). Reason: ${reason || 'N/A'}`,
            timestamp: new Date(),
          },
        },
      },
    );

    await this.auditService.log({
      actorId: officerId,
      actorRole: officerRole,
      action: AuditAction.DISPUTE_RESOLVED,
      entityType: 'Payment',
      entityId: updatedPayment.paymentId,
      details: {
        orderId: order.orderId,
        amountPoisha: updatedPayment.amountPoisha,
        reversedGoldMg: order.weightMilligrams,
        reason,
      },
    });

    return {
      success: true,
      message: 'Payment refunded and gold holdings reversed cleanly',
      paymentId: updatedPayment.paymentId,
      orderId: order.orderId,
      status: PaymentStatus.REFUNDED,
    };
  }
}
