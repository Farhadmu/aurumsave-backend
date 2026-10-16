import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus, OrderType, Role, AuditAction, KycStatus } from '@aurumsave/shared';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { QuoteService } from '../quotes/quote.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { PriceService } from '../prices/price.service';
import { CreateOrderDto, FilterOrdersDto } from './order.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly quoteService: QuoteService,
    private readonly auditService: AuditService,
    private readonly ledgerService: LedgerService,
    private readonly priceService: PriceService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto): Promise<OrderDocument> {
    // Check user account status
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is suspended or inactive');
    }

    // Check idempotency if key provided
    if (dto.idempotencyKey) {
      const existing = await this.orderModel.findOne({ idempotencyKey: dto.idempotencyKey });
      if (existing) {
        return existing;
      }
    }

    // Validate and atomically consume quote to prevent concurrent replay race conditions
    const quote = await this.quoteService.lockAndConsumeQuote(dto.quoteId, userId);

    // Defense-in-depth: Re-verify current live market rate has not expired or become stale
    const currentRate = await this.priceService.getRateForPurity(quote.purity);
    if (currentRate.isStale || new Date() > new Date(currentRate.expiresAt)) {
      throw new BadRequestException(
        `Gold benchmark price for ${quote.purity} has expired since quote was generated. Order creation halted to prevent stale financial executions.`,
      );
    }

    // Strict KYC verification check for sell orders
    if (quote.orderType === OrderType.SELL && user.kycStatus !== KycStatus.APPROVED) {
      throw new BadRequestException(
        'Government KYC identity verification must be approved before selling gold or requesting payouts',
      );
    }

    const orderId = `ORD-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;

    const order = await this.orderModel.create({
      orderId,
      userId: new Types.ObjectId(userId),
      orderType: quote.orderType,
      quoteId: quote.quoteId,
      purity: quote.purity,
      weightMilligrams: quote.weightMilligrams,
      totalPoisha: quote.totalPoisha,
      status:
        quote.orderType === OrderType.SELL
          ? OrderStatus.PROCESSING
          : OrderStatus.AWAITING_PAYMENT,
      paymentMethod: dto.paymentMethod,
      payoutDetails: dto.payoutDetails,
      idempotencyKey: dto.idempotencyKey,
      statusHistory: [
        {
          status:
            quote.orderType === OrderType.SELL
              ? OrderStatus.PROCESSING
              : OrderStatus.AWAITING_PAYMENT,
          note: `Order initiated via ${dto.paymentMethod}`,
          timestamp: new Date(),
        },
      ],
    });

    // If it's a SELL order, reserve gold into pending escrow atomically to prevent concurrent overselling
    if (quote.orderType === OrderType.SELL) {
      await this.ledgerService.reserveGoldForSale({
        userId,
        purity: quote.purity,
        weightMilligrams: quote.weightMilligrams,
      });

      order.status = OrderStatus.PROCESSING;
      order.statusHistory.push({
        status: OrderStatus.PROCESSING,
        note: 'Gold reserved in vault escrow; awaiting payout disbursement verification',
        timestamp: new Date(),
      });
      await order.save();
    }

    await this.auditService.log({
      actorId: userId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.ORDER_CREATED,
      entityType: 'Order',
      entityId: order.orderId,
      details: {
        orderType: order.orderType,
        purity: order.purity,
        weightMg: order.weightMilligrams,
        totalPoisha: order.totalPoisha,
        status: order.status,
      },
    });

    return order;
  }

  async getOrderById(orderId: string, user: { id: string; role: Role }): Promise<OrderDocument> {
    const order = await this.orderModel.findOne({ orderId }).populate('userId', 'fullName email phone');
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    // Role-based ownership check
    const isOwner = order.userId._id
      ? order.userId._id.toString() === user.id
      : (order.userId as any).toString() === user.id;

    const isStaff = [
      Role.ADMIN,
      Role.SUPER_ADMIN,
      Role.FINANCE_OFFICER,
      Role.AUDITOR,
    ].includes(user.role);

    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You do not have permission to view this order');
    }

    return order;
  }

  async getCustomerOrders(userId: string, filter: FilterOrdersDto) {
    const query: any = { userId: new Types.ObjectId(userId) };
    if (filter.status) query.status = filter.status;

    const limit = Math.min(filter.limit || 20, 100);
    const skip = filter.skip || 0;

    const [orders, total] = await Promise.all([
      this.orderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.orderModel.countDocuments(query),
    ]);

    const formattedOrders = orders.map((o: any) => ({
      ...o,
      weightGrams: o.weightMilligrams ? o.weightMilligrams / 1000 : 0,
      totalBdt: o.totalPoisha ? o.totalPoisha / 100 : 0,
    }));

    return { orders: formattedOrders, total, limit, skip };
  }

  async getAllOrders(filter: FilterOrdersDto) {
    const query: any = {};
    if (filter.status) query.status = filter.status;

    const limit = Math.min(filter.limit || 20, 100);
    const skip = filter.skip || 0;

    const [orders, total] = await Promise.all([
      this.orderModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email phone')
        .lean(),
      this.orderModel.countDocuments(query),
    ]);

    const formattedOrders = orders.map((o: any) => ({
      ...o,
      weightGrams: o.weightMilligrams ? o.weightMilligrams / 1000 : 0,
      totalBdt: o.totalPoisha ? o.totalPoisha / 100 : 0,
    }));

    return { orders: formattedOrders, total, limit, skip };
  }

  async settleSellOrderPayout(
    orderId: string,
    officerId: string,
    officerRole: Role,
    payoutReference?: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findOne({ orderId });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.orderType !== OrderType.SELL) {
      throw new BadRequestException('Only SELL orders can be settled for fiat payout');
    }

    if (order.status !== OrderStatus.PROCESSING) {
      throw new BadRequestException(`Cannot settle sell order in status: ${order.status}`);
    }

    // Settle gold liquidation from escrowed pending balance into ledger credit
    await this.ledgerService.settleGoldSale({
      userId: order.userId.toString(),
      orderId: order.orderId,
      purity: order.purity,
      weightMilligrams: order.weightMilligrams,
      payoutPoisha: order.totalPoisha,
      description: `Disbursed liquidation payout for Order #${order.orderId} (Ref: ${payoutReference || 'MFS_BANK_SETTLEMENT'})`,
    });

    order.status = OrderStatus.COMPLETED;
    order.completedAt = new Date();
    order.statusHistory.push({
      status: OrderStatus.COMPLETED,
      note: `Liquidation payout disbursed & verified by ${officerRole} (Ref: ${payoutReference || officerId})`,
      timestamp: new Date(),
    });
    await order.save();

    await this.auditService.log({
      actorId: officerId,
      actorRole: officerRole,
      action: AuditAction.ORDER_SETTLED,
      entityType: 'Order',
      entityId: order.orderId,
      details: {
        orderType: OrderType.SELL,
        totalPoisha: order.totalPoisha,
        payoutRef: payoutReference,
      },
    });

    return order;
  }

  async cancelOrder(orderId: string, userId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findOne({ orderId });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId.toString() !== userId) {
      throw new ForbiddenException('You can only cancel your own orders');
    }

    if (order.orderType === OrderType.SELL) {
      if (order.status !== OrderStatus.PROCESSING) {
        throw new BadRequestException(`Cannot cancel sell order in status ${order.status}`);
      }
      // Release reserved pending gold back to customer vault
      await this.ledgerService.releaseReservedGold({
        userId,
        purity: order.purity,
        weightMilligrams: order.weightMilligrams,
      });
    } else {
      if (order.status !== OrderStatus.AWAITING_PAYMENT) {
        throw new BadRequestException(`Cannot cancel order in status ${order.status}`);
      }
    }

    order.status = OrderStatus.CANCELLED;
    order.statusHistory.push({
      status: OrderStatus.CANCELLED,
      note: 'Cancelled by customer',
      timestamp: new Date(),
    });
    await order.save();

    await this.auditService.log({
      actorId: userId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.ORDER_CANCELLED,
      entityType: 'Order',
      entityId: order.orderId,
    });

    return order;
  }
}
