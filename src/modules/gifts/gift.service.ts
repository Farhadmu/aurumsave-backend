import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  PurityGrade,
  Role,
  AuditAction,
  LedgerEntryType,
  CONVERSIONS,
} from '@aurumsave/shared';
import { GoldGift, GoldGiftDocument, GiftStatus } from '../../database/schemas/gold-gift.schema';
import { GoldHolding, GoldHoldingDocument } from '../../database/schemas/gold-holding.schema';
import { LedgerEntry, LedgerEntryDocument } from '../../database/schemas/ledger-entry.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { AuditService } from '../audit/audit.service';
import { PriceService } from '../prices/price.service';
import { SendGiftDto, LookupRecipientDto, ClaimGiftDto } from './gift.dto';

@Injectable()
export class GiftService {
  private readonly logger = new Logger(GiftService.name);

  constructor(
    @InjectModel(GoldGift.name) private readonly giftModel: Model<GoldGiftDocument>,
    @InjectModel(GoldHolding.name) private readonly holdingModel: Model<GoldHoldingDocument>,
    @InjectModel(LedgerEntry.name) private readonly ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly auditService: AuditService,
    private readonly priceService: PriceService,
  ) {}

  private isTransactionSupported(): boolean {
    const rawConn = this.connection as any;
    if (!rawConn || typeof rawConn.startSession !== 'function') return false;
    const client = typeof rawConn.getClient === 'function' ? rawConn.getClient() : rawConn.client;
    const topology = client?.topology?.description;
    if (!topology) {
      return false;
    }
    const type = topology.type;
    const setName = topology.setName;
    return (
      type === 'ReplicaSetWithPrimary' ||
      type === 'ReplicaSetNoPrimary' ||
      type === 'Sharded' ||
      Boolean(setName)
    );
  }

  private maskName(name: string): string {
    if (!name) return 'Valued Client';
    const parts = name.trim().split(/\s+/);
    return parts
      .map((p) => (p.length > 2 ? `${p[0]}${'*'.repeat(Math.min(p.length - 2, 4))}${p[p.length - 1]}` : p))
      .join(' ');
  }

  private maskPhone(phone?: string): string {
    if (!phone || phone.length < 7) return '017***';
    return `${phone.substring(0, 3)}****${phone.substring(phone.length - 3)}`;
  }

  private maskEmail(email: string): string {
    const [user, domain] = email.split('@');
    if (!user || !domain) return '***@***';
    const maskedUser = user.length > 2 ? `${user[0]}***${user[user.length - 1]}` : `${user[0]}***`;
    return `${maskedUser}@${domain}`;
  }

  async lookupRecipient(senderUserId: string, dto: LookupRecipientDto): Promise<any> {
    const query = dto.recipientIdentifier.trim();
    const isEmail = query.includes('@');

    const recipient = await this.userModel.findOne(
      isEmail ? { email: query.toLowerCase() } : { phone: query },
    );

    if (recipient && recipient._id.toString() === senderUserId) {
      throw new BadRequestException('You cannot send a gold gift to yourself');
    }

    if (recipient) {
      return {
        found: true,
        maskedName: this.maskName(recipient.fullName),
        maskedPhone: recipient.phone ? this.maskPhone(recipient.phone) : undefined,
        maskedEmail: this.maskEmail(recipient.email),
        kycVerified: recipient.kycStatus === 'APPROVED',
      };
    }

    return {
      found: false,
      message: 'Recipient is not yet registered. An invitation will be dispatched upon sending.',
    };
  }

  async sendGift(senderUserId: string, dto: SendGiftDto): Promise<GoldGiftDocument> {
    const sender = await this.userModel.findById(senderUserId);
    if (!sender) throw new NotFoundException('Sender not found');
    if (!sender.isActive) throw new ForbiddenException('Sender account is deactivated');
    if (sender.isAccountFrozen) {
      throw new ForbiddenException('Your account is under emergency security lockdown. Gold transfers are disabled.');
    }

    const recipientQuery = dto.recipientIdentifier.trim();
    const isEmail = recipientQuery.includes('@');
    const recipient = await this.userModel.findOne(
      isEmail ? { email: recipientQuery.toLowerCase() } : { phone: recipientQuery },
    );

    if (recipient && recipient._id.toString() === senderUserId) {
      throw new BadRequestException('You cannot send a gold gift to yourself');
    }

    const purity = dto.purity ? (dto.purity as PurityGrade) : PurityGrade.K24;
    const weightMilligrams = Math.round(dto.weightGrams * 1000);

    if (weightMilligrams < 100) {
      throw new BadRequestException('Minimum gift weight is 0.1 grams (100 milligrams)');
    }

    const senderHolding = await this.holdingModel.findOne({
      userId: new Types.ObjectId(senderUserId),
      purity,
    });

    if (!senderHolding || senderHolding.weightMilligramsAvailable < weightMilligrams) {
      throw new BadRequestException(
        `Insufficient 24K gold balance. Available: ${
          senderHolding ? (senderHolding.weightMilligramsAvailable / 1000).toFixed(3) : '0'
        }g, Required: ${dto.weightGrams}g`,
      );
    }

    const liveRate = await this.priceService.getRateForPurity(purity);
    const valuationAtGiftPoisha = Math.round(
      (weightMilligrams / 1000) * liveRate.sellPricePerGramPoisha,
    );

    const giftId = `GFT-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours window

    const executeOperation = async (session?: any) => {
      // 1. Escrow gold from sender available balance
      const updatedSenderHolding = await this.holdingModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(senderUserId),
          purity,
          weightMilligramsAvailable: { $gte: weightMilligrams },
        },
        {
          $inc: {
            weightMilligramsAvailable: -weightMilligrams,
            weightMilligramsPending: weightMilligrams,
          },
        },
        { new: true, session },
      );

      if (!updatedSenderHolding) {
        throw new BadRequestException('Concurrent balance conflict during escrow allocation');
      }

      // 2. Create the GoldGift record
      const gift = await this.giftModel.create(
        [
          {
            giftId,
            senderId: new Types.ObjectId(senderUserId),
            recipientEmail: recipient ? recipient.email : isEmail ? recipientQuery.toLowerCase() : `${recipientQuery}@placeholder.phone`,
            recipientPhone: recipient?.phone || (!isEmail ? recipientQuery : undefined),
            recipientId: recipient?._id,
            purity,
            weightMilligrams,
            valuationAtGiftPoisha,
            message: dto.message?.trim(),
            status: GiftStatus.PENDING_ACCEPTANCE,
            expiresAt,
          },
        ],
        { session },
      );

      // 3. Ledger entry for sender (escrow reserve)
      await this.ledgerModel.create(
        [
          {
            entryId: `LED-GFT-ESC-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`,
            userId: new Types.ObjectId(senderUserId),
            type: LedgerEntryType.GOLD_GIFT_ESCROW,
            purity,
            weightMilligramsDebit: weightMilligrams,
            weightMilligramsCredit: 0,
            amountPoisha: valuationAtGiftPoisha,
            description: `Gold gift sent to ${dto.recipientIdentifier} (${dto.weightGrams}g reserved in escrow)`,
            runningBalanceMilligrams: updatedSenderHolding.weightMilligramsAvailable,
            referenceId: giftId,
          },
        ],
        { session },
      );

      return gift[0];
    };

    let resultGift: GoldGiftDocument;
    if (this.isTransactionSupported()) {
      const session = await this.connection.startSession();
      try {
        await session.withTransaction(async () => {
          resultGift = await executeOperation(session);
        });
      } finally {
        if (session && typeof session.endSession === 'function') {
          await session.endSession();
        }
      }
    } else {
      resultGift = await executeOperation();
    }

    await this.auditService.log({
      actorId: senderUserId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.GOLD_GIFT_SENT,
      entityType: 'GoldGift',
      entityId: giftId,
      details: {
        recipientIdentifier: dto.recipientIdentifier,
        weightGrams: dto.weightGrams,
        valuationBdt: valuationAtGiftPoisha / CONVERSIONS.POISHA_PER_BDT,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return resultGift!;
  }

  async getSentGifts(userId: string): Promise<any[]> {
    return this.giftModel
      .find({ senderId: new Types.ObjectId(userId) })
      .populate('recipientId', 'fullName email phone')
      .sort({ createdAt: -1 })
      .lean();
  }

  async getReceivedGifts(user: { id: string; email: string; phone?: string }): Promise<any[]> {
    const filters: any[] = [
      { recipientId: new Types.ObjectId(user.id) },
      { recipientEmail: user.email.toLowerCase() },
    ];
    if (user.phone) {
      filters.push({ recipientPhone: user.phone });
    }

    return this.giftModel
      .find({ $or: filters })
      .populate('senderId', 'fullName email phone')
      .sort({ createdAt: -1 })
      .lean();
  }

  async acceptGift(recipientUserId: string, giftId: string, dto?: ClaimGiftDto): Promise<any> {
    const recipient = await this.userModel.findById(recipientUserId);
    if (!recipient) throw new NotFoundException('Recipient account not found');
    if (!recipient.isActive) throw new ForbiddenException('Recipient account is suspended');
    if (recipient.isAccountFrozen) {
      throw new ForbiddenException('Your account is frozen. Gifts cannot be accepted while under security lock.');
    }

    const gift = await this.giftModel.findOne({ giftId });
    if (!gift) throw new NotFoundException(`Gift ${giftId} not found`);

    if (gift.status !== GiftStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException(`Gift is in status ${gift.status} and cannot be claimed`);
    }

    // Auto-expiry check
    if (new Date() > new Date(gift.expiresAt)) {
      gift.status = GiftStatus.EXPIRED;
      await gift.save();
      // Reverse escrow back to sender
      await this.holdingModel.updateOne(
        { userId: gift.senderId, purity: gift.purity },
        {
          $inc: {
            weightMilligramsPending: -gift.weightMilligrams,
            weightMilligramsAvailable: gift.weightMilligrams,
          },
        },
      );
      throw new BadRequestException('This gift has expired and has been returned to the sender');
    }

    // Verify recipient matches
    const matchesEmail = gift.recipientEmail.toLowerCase() === recipient.email.toLowerCase();
    const matchesPhone = recipient.phone && gift.recipientPhone && gift.recipientPhone === recipient.phone;
    const matchesId = gift.recipientId && gift.recipientId.toString() === recipientUserId;

    if (!matchesEmail && !matchesPhone && !matchesId) {
      throw new ForbiddenException('You are not the designated recipient of this gift');
    }

    const executeOperation = async (session?: any) => {
      // 1. Clear sender pending balance
      const senderHolding = await this.holdingModel.findOneAndUpdate(
        {
          userId: gift.senderId,
          purity: gift.purity,
          weightMilligramsPending: { $gte: gift.weightMilligrams },
        },
        {
          $inc: { weightMilligramsPending: -gift.weightMilligrams },
        },
        { new: true, session },
      );

      if (!senderHolding) {
        throw new BadRequestException('Sender pending escrow balance is no longer available');
      }

      // 2. Credit recipient available balance
      let holdingQuery = this.holdingModel.findOne({
        userId: new Types.ObjectId(recipientUserId),
        purity: gift.purity,
      });
      if (session && typeof (holdingQuery as any).session === 'function') {
        holdingQuery = (holdingQuery as any).session(session);
      }
      let recipientHolding = await holdingQuery;

      if (!recipientHolding) {
        const created = await this.holdingModel.create(
          [
            {
              userId: new Types.ObjectId(recipientUserId),
              purity: gift.purity,
              weightMilligramsAvailable: gift.weightMilligrams,
              weightMilligramsPending: 0,
              totalCostPoisha: gift.valuationAtGiftPoisha,
              averageCostPerMilligramPoisha: Math.round(
                gift.valuationAtGiftPoisha / gift.weightMilligrams,
              ),
            },
          ],
          { session },
        );
        recipientHolding = created[0];
      } else {
        recipientHolding.weightMilligramsAvailable += gift.weightMilligrams;
        recipientHolding.totalCostPoisha += gift.valuationAtGiftPoisha;
        recipientHolding.averageCostPerMilligramPoisha = Math.round(
          recipientHolding.totalCostPoisha / recipientHolding.weightMilligramsAvailable,
        );
        await recipientHolding.save({ session });
      }

      // 3. Update gift status
      gift.status = GiftStatus.ACCEPTED;
      gift.recipientId = new Types.ObjectId(recipientUserId);
      gift.acceptedAt = new Date();
      await gift.save({ session });

      // 4. Ledger entry for recipient (Credit)
      await this.ledgerModel.create(
        [
          {
            entryId: `LED-GFT-REC-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`,
            userId: new Types.ObjectId(recipientUserId),
            type: LedgerEntryType.GOLD_GIFT_TRANSFER,
            purity: gift.purity,
            weightMilligramsDebit: 0,
            weightMilligramsCredit: gift.weightMilligrams,
            amountPoisha: gift.valuationAtGiftPoisha,
            description: `Gold gift accepted from AurumSave user (${gift.weightMilligrams / 1000}g)`,
            runningBalanceMilligrams: recipientHolding.weightMilligramsAvailable,
            referenceId: gift.giftId,
          },
        ],
        { session },
      );

      // 5. Ledger entry for sender (Debit finalized)
      await this.ledgerModel.create(
        [
          {
            entryId: `LED-GFT-SND-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`,
            userId: gift.senderId,
            type: LedgerEntryType.GOLD_GIFT_TRANSFER,
            purity: gift.purity,
            weightMilligramsDebit: gift.weightMilligrams,
            weightMilligramsCredit: 0,
            amountPoisha: gift.valuationAtGiftPoisha,
            description: `Gold gift claimed by recipient (${gift.weightMilligrams / 1000}g)`,
            runningBalanceMilligrams: senderHolding.weightMilligramsAvailable,
            referenceId: gift.giftId,
          },
        ],
        { session },
      );

      return gift;
    };

    let settledGift: GoldGiftDocument;
    if (this.isTransactionSupported()) {
      const session = await this.connection.startSession();
      try {
        await session.withTransaction(async () => {
          settledGift = await executeOperation(session);
        });
      } finally {
        if (session && typeof session.endSession === 'function') {
          await session.endSession();
        }
      }
    } else {
      settledGift = await executeOperation();
    }

    await this.auditService.log({
      actorId: recipientUserId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.GOLD_GIFT_CLAIMED,
      entityType: 'GoldGift',
      entityId: gift.giftId,
      details: {
        senderId: gift.senderId.toString(),
        weightGrams: gift.weightMilligrams / 1000,
        acceptedAt: gift.acceptedAt?.toISOString(),
      },
    });

    return {
      success: true,
      message: `Successfully accepted ${(gift.weightMilligrams / 1000).toFixed(3)}g gold into your vault!`,
      gift: settledGift!,
    };
  }

  async rejectGift(recipientUserId: string, giftId: string): Promise<any> {
    const gift = await this.giftModel.findOne({ giftId });
    if (!gift) throw new NotFoundException(`Gift ${giftId} not found`);

    if (gift.status !== GiftStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException(`Cannot reject gift in status ${gift.status}`);
    }

    const executeOperation = async (session?: any) => {
      // 1. Release sender pending escrow back to available balance
      const senderHolding = await this.holdingModel.findOneAndUpdate(
        {
          userId: gift.senderId,
          purity: gift.purity,
          weightMilligramsPending: { $gte: gift.weightMilligrams },
        },
        {
          $inc: {
            weightMilligramsPending: -gift.weightMilligrams,
            weightMilligramsAvailable: gift.weightMilligrams,
          },
        },
        { new: true, session },
      );

      if (!senderHolding) {
        throw new BadRequestException('Pending escrow reconciliation failed');
      }

      // 2. Mark gift rejected
      gift.status = GiftStatus.REJECTED;
      await gift.save({ session });

      // 3. Ledger reversal entry for sender
      await this.ledgerModel.create(
        [
          {
            entryId: `LED-GFT-REV-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`,
            userId: gift.senderId,
            type: LedgerEntryType.GOLD_GIFT_REVERSAL,
            purity: gift.purity,
            weightMilligramsDebit: 0,
            weightMilligramsCredit: gift.weightMilligrams,
            amountPoisha: gift.valuationAtGiftPoisha,
            description: `Gold gift declined by recipient (${gift.weightMilligrams / 1000}g returned to vault)`,
            runningBalanceMilligrams: senderHolding.weightMilligramsAvailable,
            referenceId: gift.giftId,
          },
        ],
        { session },
      );

      return gift;
    };

    let resultGift: GoldGiftDocument;
    if (this.isTransactionSupported()) {
      const session = await this.connection.startSession();
      try {
        await session.withTransaction(async () => {
          resultGift = await executeOperation(session);
        });
      } finally {
        if (session && typeof session.endSession === 'function') {
          await session.endSession();
        }
      }
    } else {
      resultGift = await executeOperation();
    }

    await this.auditService.log({
      actorId: recipientUserId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.GOLD_GIFT_REJECTED,
      entityType: 'GoldGift',
      entityId: gift.giftId,
      details: { senderId: gift.senderId.toString(), weightGrams: gift.weightMilligrams / 1000 },
    });

    return {
      success: true,
      message: 'Gift declined. Gold has been safely returned to sender vault.',
      gift: resultGift!,
    };
  }

  async cancelGift(senderUserId: string, giftId: string): Promise<any> {
    const gift = await this.giftModel.findOne({
      giftId,
      senderId: new Types.ObjectId(senderUserId),
    });
    if (!gift) throw new NotFoundException(`Gift ${giftId} not found or you are not the sender`);

    if (gift.status !== GiftStatus.PENDING_ACCEPTANCE) {
      throw new BadRequestException(`Cannot cancel gift in status ${gift.status}`);
    }

    const executeOperation = async (session?: any) => {
      const senderHolding = await this.holdingModel.findOneAndUpdate(
        {
          userId: gift.senderId,
          purity: gift.purity,
          weightMilligramsPending: { $gte: gift.weightMilligrams },
        },
        {
          $inc: {
            weightMilligramsPending: -gift.weightMilligrams,
            weightMilligramsAvailable: gift.weightMilligrams,
          },
        },
        { new: true, session },
      );

      if (!senderHolding) {
        throw new BadRequestException('Pending escrow reconciliation failed');
      }

      gift.status = GiftStatus.EXPIRED;
      await gift.save({ session });

      await this.ledgerModel.create(
        [
          {
            entryId: `LED-GFT-CNC-${Date.now()}-${uuidv4().substring(0, 4).toUpperCase()}`,
            userId: gift.senderId,
            type: LedgerEntryType.GOLD_GIFT_REVERSAL,
            purity: gift.purity,
            weightMilligramsDebit: 0,
            weightMilligramsCredit: gift.weightMilligrams,
            amountPoisha: gift.valuationAtGiftPoisha,
            description: `Gold gift cancelled by sender (${gift.weightMilligrams / 1000}g returned to available vault balance)`,
            runningBalanceMilligrams: senderHolding.weightMilligramsAvailable,
            referenceId: gift.giftId,
          },
        ],
        { session },
      );

      return gift;
    };

    let resultGift: GoldGiftDocument;
    if (this.isTransactionSupported()) {
      const session = await this.connection.startSession();
      try {
        await session.withTransaction(async () => {
          resultGift = await executeOperation(session);
        });
      } finally {
        if (session && typeof session.endSession === 'function') {
          await session.endSession();
        }
      }
    } else {
      resultGift = await executeOperation();
    }

    await this.auditService.log({
      actorId: senderUserId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.GOLD_GIFT_CANCELLED,
      entityType: 'GoldGift',
      entityId: gift.giftId,
      details: { weightGrams: gift.weightMilligrams / 1000 },
    });

    return {
      success: true,
      message: 'Gift cancelled and gold balance restored to your vault.',
      gift: resultGift!,
    };
  }
}
