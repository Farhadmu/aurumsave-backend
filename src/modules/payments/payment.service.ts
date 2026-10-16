import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { PaymentStatus, OrderStatus, OrderType, Role, AuditAction, CONVERSIONS } from '@aurumsave/shared';
import { Payment, PaymentDocument } from '../../database/schemas/payment.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import { InitiatePaymentDto, ProcessWebhookDto } from './payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly ledgerService: LedgerService,
    private readonly auditService: AuditService,
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

  async processWebhook(dto: ProcessWebhookDto) {
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

    const order = await this.orderModel.findOne({ orderId: payment.orderId });
    if (!order) {
      throw new NotFoundException('Associated order not found');
    }

    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(
        `Cannot process payment for order ${order.orderId} in status: ${order.status}`,
      );
    }

    if (dto.success === false) {
      payment.status = PaymentStatus.FAILED;
      payment.failureReason = 'Payment rejected by gateway or user cancelled';
      await payment.save();

      order.status = OrderStatus.FAILED;
      order.failureReason = payment.failureReason;
      order.statusHistory.push({
        status: OrderStatus.FAILED,
        note: `Payment failed on ${payment.gateway}`,
        timestamp: new Date(),
      });
      await order.save();

      return { success: false, message: 'Payment recorded as failed' };
    }

    // Mark payment as successful
    payment.status = PaymentStatus.SUCCESSFUL;
    payment.gatewayTransactionId =
      dto.gatewayTransactionId || `TXN-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
    payment.verifiedAt = new Date();
    await payment.save();

    // Transition Order status
    order.status = OrderStatus.COMPLETED;
    order.completedAt = new Date();
    order.statusHistory.push(
      {
        status: OrderStatus.PAYMENT_CONFIRMED,
        note: `Payment verified via ${payment.gateway} (Ref: ${payment.gatewayTransactionId})`,
        timestamp: new Date(),
      },
      {
        status: OrderStatus.COMPLETED,
        note: `Allocated ${order.weightMilligrams / 1000}g ${order.purity} gold to customer vault`,
        timestamp: new Date(),
      },
    );
    await order.save();

    // Safe Double-Entry Ledger Commitment
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
        txnId: payment.gatewayTransactionId,
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
    const payment = await this.paymentModel.findOne({ paymentId });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === PaymentStatus.REFUNDED) {
      throw new BadRequestException('This payment has already been refunded');
    }

    const order = await this.orderModel.findOne({ orderId: payment.orderId });
    if (!order) {
      throw new NotFoundException('Associated order not found');
    }

    // If gold was already credited to vault, reverse holding and log ledger reversal
    if (order.status === OrderStatus.COMPLETED && order.orderType === OrderType.BUY) {
      await this.ledgerService.reverseGoldPurchase({
        userId: order.userId.toString(),
        orderId: order.orderId,
        paymentId: payment.paymentId,
        purity: order.purity,
        weightMilligrams: order.weightMilligrams,
        refundPoisha: payment.amountPoisha,
        description: `Refund & gold reversal for Order #${order.orderId}: ${reason || 'Customer requested / authorized refund'}`,
      });
    }

    payment.status = PaymentStatus.REFUNDED;
    payment.failureReason = reason || 'Refunded by operations officer';
    await payment.save();

    order.status = OrderStatus.REFUNDED;
    order.statusHistory.push({
      status: OrderStatus.REFUNDED,
      note: `Refund processed by ${officerRole} (Ref: ${officerId}). Reason: ${reason || 'N/A'}`,
      timestamp: new Date(),
    });
    await order.save();

    await this.auditService.log({
      actorId: officerId,
      actorRole: officerRole,
      action: AuditAction.DISPUTE_RESOLVED,
      entityType: 'Payment',
      entityId: payment.paymentId,
      details: {
        orderId: order.orderId,
        amountPoisha: payment.amountPoisha,
        reversedGoldMg: order.weightMilligrams,
        reason,
      },
    });

    return {
      success: true,
      message: 'Payment refunded and gold holdings reversed cleanly',
      paymentId: payment.paymentId,
      orderId: order.orderId,
      status: PaymentStatus.REFUNDED,
    };
  }
}
