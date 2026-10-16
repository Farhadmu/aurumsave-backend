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
import { OrderStatus, OrderType, Role, AuditAction } from '@aurumsave/shared';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { QuoteService } from '../quotes/quote.service';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { CreateOrderDto, FilterOrdersDto } from './order.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly quoteService: QuoteService,
    private readonly auditService: AuditService,
    private readonly ledgerService: LedgerService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto): Promise<OrderDocument> {
    // Check idempotency if key provided
    if (dto.idempotencyKey) {
      const existing = await this.orderModel.findOne({ idempotencyKey: dto.idempotencyKey });
      if (existing) {
        return existing;
      }
    }

    // Validate quote validity and ownership
    const quote = await this.quoteService.getValidQuote(dto.quoteId, userId);

    const orderId = `ORD-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;

    // Mark quote as used to prevent replay
    quote.isUsed = true;
    await quote.save();

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

    // If it's a SELL order, debit gold immediately and mark as processing
    if (quote.orderType === OrderType.SELL) {
      await this.ledgerService.debitGoldSale({
        userId,
        orderId: order.orderId,
        purity: quote.purity,
        weightMilligrams: quote.weightMilligrams,
        payoutPoisha: quote.totalPoisha,
        description: `Gold liquidation payout for Order #${order.orderId}`,
      });

      order.status = OrderStatus.COMPLETED;
      order.completedAt = new Date();
      order.statusHistory.push({
        status: OrderStatus.COMPLETED,
        note: 'Gold liquidated from vault; funds credited to Aurum wallet balance',
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

    return { orders, total, limit, skip };
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

    return { orders, total, limit, skip };
  }

  async cancelOrder(orderId: string, userId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findOne({ orderId });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId.toString() !== userId) {
      throw new ForbiddenException('You can only cancel your own orders');
    }

    if (order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(`Cannot cancel order in status ${order.status}`);
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
