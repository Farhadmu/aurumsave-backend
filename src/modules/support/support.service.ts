import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { TicketStatus, Role } from '@aurumsave/shared';
import { SupportTicket, SupportTicketDocument } from '../../database/schemas/support-ticket.schema';
import { SupportMessage, SupportMessageDocument } from '../../database/schemas/support-message.schema';
import { CreateTicketDto, AddMessageDto } from './support.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name) private readonly ticketModel: Model<SupportTicketDocument>,
    @InjectModel(SupportMessage.name) private readonly messageModel: Model<SupportMessageDocument>,
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
}
