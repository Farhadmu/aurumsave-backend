import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { TicketStatus, Role, AuditAction } from '@aurumsave/shared';
import { SupportTicket, SupportTicketDocument } from '../../database/schemas/support-ticket.schema';
import { SupportMessage, SupportMessageDocument } from '../../database/schemas/support-message.schema';
import { CreateTicketDto, AddMessageDto, EscalateDisputeDto, ResolveDisputeDto } from './support.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name) private readonly ticketModel: Model<SupportTicketDocument>,
    @InjectModel(SupportMessage.name) private readonly messageModel: Model<SupportMessageDocument>,
    private readonly auditService: AuditService,
  ) {}

  async createTicket(userId: string, dto: CreateTicketDto): Promise<SupportTicketDocument> {
    const ticketId = `TCK-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;

    const ticket = await this.ticketModel.create({
      ticketId,
      userId: new Types.ObjectId(userId),
      subject: dto.subject,
      category: dto.category,
      priority: dto.priority,
      status: TicketStatus.OPEN,
      relatedOrderId: dto.relatedOrderId,
    });

    // Create the initial message
    await this.messageModel.create({
      ticketId: ticket.ticketId,
      senderId: new Types.ObjectId(userId),
      senderRole: Role.CUSTOMER,
      message: dto.message,
      isInternalNote: false,
    });

    return ticket;
  }

  async getCustomerTickets(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.ticketModel.find({ userId: userObjectId }).sort({ createdAt: -1 }).lean();
  }

  async getStaffQueue(status?: TicketStatus, limit: number = 50, skip: number = 0) {
    const query: any = {};
    if (status) query.status = status;

    const [tickets, total] = await Promise.all([
      this.ticketModel
        .find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName email phone')
        .lean(),
      this.ticketModel.countDocuments(query),
    ]);

    return { tickets, total, limit, skip };
  }

  async getTicketDetails(ticketId: string, user: { id: string; role: Role }) {
    const ticket = await this.ticketModel
      .findOne({ ticketId })
      .populate('userId', 'fullName email phone');

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const isCustomer = user.role === Role.CUSTOMER;
    const isOwner = ticket.userId._id
      ? ticket.userId._id.toString() === user.id
      : (ticket.userId as any).toString() === user.id;

    if (isCustomer && !isOwner) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    // Filter messages: Only Support Agents and Admins can view internal staff notes.
    // Customers, Auditors, Finance Officers, and Compliance Officers are restricted from viewing internal notes.
    const canViewInternalNotes = [
      Role.SUPPORT_AGENT,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ].includes(user.role);

    const messageQuery: any = { ticketId };
    if (!canViewInternalNotes) {
      messageQuery.isInternalNote = false;
    }

    const messages = await this.messageModel
      .find(messageQuery)
      .sort({ createdAt: 1 })
      .populate('senderId', 'fullName role')
      .lean();

    return {
      ticket,
      messages,
    };
  }

  async addMessage(
    ticketId: string,
    user: { id: string; role: Role },
    dto: AddMessageDto,
  ) {
    const ticket = await this.ticketModel.findOne({ ticketId });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const isCustomer = user.role === Role.CUSTOMER;
    const isAuthorizedStaff = [
      Role.SUPPORT_AGENT,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ].includes(user.role);
    const isOwner = ticket.userId.toString() === user.id;

    if (!isCustomer && !isAuthorizedStaff) {
      throw new ForbiddenException(
        `Users with role ${user.role} (such as Auditor or Finance) are not permitted to reply to support tickets without support agent credentials`,
      );
    }

    if (isCustomer && !isOwner) {
      throw new ForbiddenException('You cannot reply to another user ticket');
    }

    // Only authorized support staff can create internal notes
    const isInternalNote = isAuthorizedStaff ? Boolean(dto.isInternalNote) : false;

    const message = await this.messageModel.create({
      ticketId,
      senderId: new Types.ObjectId(user.id),
      senderRole: user.role,
      message: dto.message,
      isInternalNote,
    });

    if (dto.updateStatus && !isCustomer) {
      ticket.status = dto.updateStatus;
      if (dto.updateStatus === TicketStatus.RESOLVED) {
        ticket.resolvedAt = new Date();
      } else if (dto.updateStatus === TicketStatus.CLOSED) {
        ticket.closedAt = new Date();
      }
    } else if (isCustomer && ticket.status === TicketStatus.WAITING_ON_CUSTOMER) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }

    await ticket.save();

    return message;
  }

  async escalateToFinance(
    ticketId: string,
    staffUser: { id: string; role: Role },
    dto: EscalateDisputeDto,
  ) {
    const isAuthorizedStaff = [
      Role.SUPPORT_AGENT,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ].includes(staffUser.role);

    if (!isAuthorizedStaff) {
      throw new ForbiddenException('Only Support Agents and Admins can escalate tickets to Finance');
    }

    const ticket = await this.ticketModel.findOne({ ticketId });
    if (!ticket) throw new NotFoundException('Ticket not found');

    ticket.escalatedToFinance = true;
    ticket.status = TicketStatus.ESCALATED_TO_FINANCE;
    ticket.escalatedAt = new Date();
    if (Types.ObjectId.isValid(staffUser.id)) {
      ticket.escalatedBy = new Types.ObjectId(staffUser.id);
    }
    if (dto.relatedOrderId) {
      ticket.relatedOrderId = dto.relatedOrderId;
    }

    await ticket.save();

    // Create system internal note
    await this.messageModel.create({
      ticketId,
      senderId: Types.ObjectId.isValid(staffUser.id) ? new Types.ObjectId(staffUser.id) : new Types.ObjectId(),
      senderRole: staffUser.role,
      message: `[DISPUTE ESCALATED TO FINANCE DEPT] Reason: ${dto.reason}${dto.relatedOrderId ? ` (Order: ${dto.relatedOrderId})` : ''}`,
      isInternalNote: true,
    });

    await this.auditService.log({
      actorId: staffUser.id,
      actorRole: staffUser.role,
      action: AuditAction.DISPUTE_RAISED,
      entityType: 'SupportTicket',
      entityId: ticketId,
      details: { reason: dto.reason, relatedOrderId: ticket.relatedOrderId },
    });

    return {
      success: true,
      message: 'Ticket successfully escalated to Finance Operations Queue',
      ticket,
    };
  }

  async getFinanceDisputes(user: { id: string; role: Role }) {
    const isFinanceAuthorized = [
      Role.FINANCE_OFFICER,
      Role.ADMIN,
      Role.SUPER_ADMIN,
      Role.AUDITOR,
    ].includes(user.role);

    if (!isFinanceAuthorized) {
      throw new ForbiddenException('Access to Finance dispute queue is restricted to Finance Officers and Admins');
    }

    return this.ticketModel
      .find({ escalatedToFinance: true })
      .populate('userId', 'fullName email phone')
      .populate('escalatedBy', 'fullName role')
      .populate('financeOfficerId', 'fullName role')
      .sort({ updatedAt: -1 })
      .lean();
  }

  async resolveFinanceDispute(
    ticketId: string,
    financeUser: { id: string; role: Role },
    dto: ResolveDisputeDto,
  ) {
    const isFinanceAuthorized = [
      Role.FINANCE_OFFICER,
      Role.ADMIN,
      Role.SUPER_ADMIN,
    ].includes(financeUser.role);

    if (!isFinanceAuthorized) {
      throw new ForbiddenException('Four-eyes financial dispute resolution requires Finance Officer or Admin authorization');
    }

    const ticket = await this.ticketModel.findOne({ ticketId });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (!ticket.escalatedToFinance) {
      throw new BadRequestException('This ticket has not been escalated to Finance');
    }

    ticket.financeResolutionNote = dto.note;
    ticket.financeAction = dto.action;
    if (Types.ObjectId.isValid(financeUser.id)) {
      ticket.financeOfficerId = new Types.ObjectId(financeUser.id);
    }
    ticket.resolvedByFinanceAt = new Date();
    ticket.status = TicketStatus.RESOLVED;
    ticket.resolvedAt = new Date();

    await ticket.save();

    await this.messageModel.create({
      ticketId,
      senderId: Types.ObjectId.isValid(financeUser.id) ? new Types.ObjectId(financeUser.id) : new Types.ObjectId(),
      senderRole: financeUser.role,
      message: `[FINANCE DISPUTE RESOLUTION: ${dto.action}] Decision Note: ${dto.note}`,
      isInternalNote: true,
    });

    const customerMsg =
      dto.action === 'REFUND_APPROVED'
        ? 'Your dispute has been reviewed and approved by our Finance Department. Refund settlement has been authorized.'
        : dto.action === 'MANUAL_SETTLED'
        ? 'Your transaction has been verified with the payment gateway and your balance has been settled.'
        : 'Your dispute has been reviewed by our Finance Department. Following verification, the transaction was verified according to platform terms.';

    await this.messageModel.create({
      ticketId,
      senderId: Types.ObjectId.isValid(financeUser.id) ? new Types.ObjectId(financeUser.id) : new Types.ObjectId(),
      senderRole: financeUser.role,
      message: customerMsg,
      isInternalNote: false,
    });

    await this.auditService.log({
      actorId: financeUser.id,
      actorRole: financeUser.role,
      action: AuditAction.DISPUTE_RESOLVED,
      entityType: 'SupportTicket',
      entityId: ticketId,
      details: { action: dto.action, note: dto.note, relatedOrderId: ticket.relatedOrderId },
    });

    return {
      success: true,
      message: `Dispute resolved successfully with action: ${dto.action}`,
      ticket,
    };
  }
}
