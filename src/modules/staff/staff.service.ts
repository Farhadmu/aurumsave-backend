import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, OrderStatus, PaymentStatus, CONVERSIONS, AuditAction } from '@aurumsave/shared';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { Payment, PaymentDocument } from '../../database/schemas/payment.schema';
import { LedgerEntry, LedgerEntryDocument } from '../../database/schemas/ledger-entry.schema';
import { GoldHolding, GoldHoldingDocument } from '../../database/schemas/gold-holding.schema';
import { SupportTicket, SupportTicketDocument } from '../../database/schemas/support-ticket.schema';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class StaffService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(LedgerEntry.name) private readonly ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(GoldHolding.name) private readonly holdingModel: Model<GoldHoldingDocument>,
    @InjectModel(SupportTicket.name) private readonly ticketModel: Model<SupportTicketDocument>,
    private readonly auditService: AuditService,
  ) {}

  async getAdminOverview() {
    const [
      totalUsers,
      totalOrders,
      completedOrders,
      openTickets,
      holdings,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.orderModel.countDocuments(),
      this.orderModel.find({ status: OrderStatus.COMPLETED }).lean(),
      this.ticketModel.countDocuments({ status: { $ne: 'CLOSED' } }),
      this.holdingModel.find().lean(),
    ]);

    let totalVaultGoldMg = 0;
    for (const h of holdings) {
      totalVaultGoldMg += h.weightMilligramsAvailable + h.weightMilligramsPending;
    }

    let totalVolumeBdt = 0;
    for (const o of completedOrders) {
      totalVolumeBdt += o.totalPoisha / CONVERSIONS.POISHA_PER_BDT;
    }

    return {
      totalCustomers: totalUsers,
      totalOrdersCount: totalOrders,
      totalVolumeBdt: Math.round(totalVolumeBdt),
      totalVaultGoldGrams: Number((totalVaultGoldMg / CONVERSIONS.MILLIGRAMS_PER_GRAM).toFixed(3)),
      openTicketsCount: openTickets,
      systemStatus: 'HEALTHY',
    };
  }

  async listUsers(role?: Role, limit: number = 50, skip: number = 0) {
    const query: any = {};
    if (role) query.role = role;

    const [users, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments(query),
    ]);

    return { users, total, limit, skip };
  }

  async setUserActiveStatus(
    userId: string,
    isActive: boolean,
    adminId: string,
    adminRole: Role,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === Role.SUPER_ADMIN && adminRole !== Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot modify status of a Super Admin');
    }

    user.isActive = isActive;
    await user.save();

    await this.auditService.log({
      actorId: adminId,
      actorRole: adminRole,
      action: AuditAction.ADMIN_SETTING_UPDATED,
      entityType: 'User',
      entityId: user._id.toString(),
      details: { newStatus: isActive ? 'ACTIVE' : 'SUSPENDED' },
    });

    return { success: true, message: `User status set to ${isActive ? 'Active' : 'Suspended'}` };
  }

  async getReconciliationReport() {
    const [successfulPayments, completedOrders, ledgerEntries] = await Promise.all([
      this.paymentModel.find({ status: PaymentStatus.SUCCESSFUL }).lean(),
      this.orderModel.find({ status: OrderStatus.COMPLETED }).lean(),
      this.ledgerModel.find().lean(),
    ]);

    let totalPaymentReceivedPoisha = 0;
    for (const p of successfulPayments) {
      totalPaymentReceivedPoisha += p.amountPoisha;
    }

    let totalOrderValuePoisha = 0;
    for (const o of completedOrders) {
      totalOrderValuePoisha += o.totalPoisha;
    }

    let totalGoldCreditedMg = 0;
    for (const l of ledgerEntries) {
      totalGoldCreditedMg += l.creditGoldMg;
    }

    const discrepancyPoisha = Math.abs(totalPaymentReceivedPoisha - totalOrderValuePoisha);
    const isBalanced = discrepancyPoisha === 0;

    return {
      runTimestamp: new Date().toISOString(),
      isBalanced,
      totalSuccessfulPaymentsCount: successfulPayments.length,
      totalCompletedOrdersCount: completedOrders.length,
      totalPaymentReceivedBdt: totalPaymentReceivedPoisha / CONVERSIONS.POISHA_PER_BDT,
      totalOrderValueBdt: totalOrderValuePoisha / CONVERSIONS.POISHA_PER_BDT,
      discrepancyBdt: discrepancyPoisha / CONVERSIONS.POISHA_PER_BDT,
      totalGoldCreditedGrams: totalGoldCreditedMg / CONVERSIONS.MILLIGRAMS_PER_GRAM,
      status: isBalanced ? 'RECONCILED' : 'DISCREPANCY_DETECTED',
    };
  }
}
