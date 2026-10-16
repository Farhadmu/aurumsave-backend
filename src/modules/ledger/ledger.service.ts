import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { LedgerEntryType, PurityGrade, CONVERSIONS } from '@aurumsave/shared';
import { LedgerEntry, LedgerEntryDocument } from '../../database/schemas/ledger-entry.schema';
import { GoldHolding, GoldHoldingDocument } from '../../database/schemas/gold-holding.schema';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(
    @InjectModel(LedgerEntry.name) private readonly ledgerModel: Model<LedgerEntryDocument>,
    @InjectModel(GoldHolding.name) private readonly holdingModel: Model<GoldHoldingDocument>,
  ) {}

  /**
   * Commits an accredited gold purchase into customer holding and ledger
   */
  async creditGoldPurchase(params: {
    userId: string;
    orderId: string;
    paymentId: string;
    purity: PurityGrade;
    weightMilligrams: number;
    costPoisha: number;
    description: string;
  }): Promise<{ entry: LedgerEntryDocument; holding: GoldHoldingDocument }> {
    const userObjectId = new Types.ObjectId(params.userId);

    // Find or create customer holding for this purity
    let holding = await this.holdingModel.findOne({
      userId: userObjectId,
      purity: params.purity,
    });

    if (!holding) {
      holding = await this.holdingModel.create({
        userId: userObjectId,
        purity: params.purity,
        weightMilligramsAvailable: 0,
        weightMilligramsPending: 0,
        totalCostPoisha: 0,
        averageCostPerMilligramPoisha: 0,
      });
    }

    // Update holding balances with exact precision arithmetic
    const newWeightMg = holding.weightMilligramsAvailable + params.weightMilligrams;
    const newTotalCostPoisha = holding.totalCostPoisha + params.costPoisha;
    const newAvgCostPerMg = newWeightMg > 0 ? Math.round(newTotalCostPoisha / newWeightMg) : 0;

    holding.weightMilligramsAvailable = newWeightMg;
    holding.totalCostPoisha = newTotalCostPoisha;
    holding.averageCostPerMilligramPoisha = newAvgCostPerMg;
    await holding.save();

    // Query previous running balance
    const lastEntry = await this.ledgerModel
      .findOne({ userId: userObjectId })
      .sort({ createdAt: -1 });

    const prevGoldMg = lastEntry ? lastEntry.runningGoldBalanceMg : 0;
    const prevFiatPoisha = lastEntry ? lastEntry.runningFiatBalancePoisha : 0;

    const entryId = `LED-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    const entry = await this.ledgerModel.create({
      entryId,
      userId: userObjectId,
      orderId: params.orderId,
      paymentId: params.paymentId,
      type: LedgerEntryType.GOLD_PURCHASE,
      debitPoisha: params.costPoisha,
      creditPoisha: 0,
      debitGoldMg: 0,
      creditGoldMg: params.weightMilligrams,
      runningGoldBalanceMg: prevGoldMg + params.weightMilligrams,
      runningFiatBalancePoisha: prevFiatPoisha, // Fiat was paid externally via MFS
      description: params.description,
    });

    this.logger.log(
      `[LEDGER CREDIT] User: ${params.userId} +${params.weightMilligrams}mg (${params.purity}) for ${params.costPoisha} poisha`,
    );

    return { entry, holding };
  }

  /**
   * Atomically reserves gold for a sell order into pending balance to prevent concurrent overselling
   */
  async reserveGoldForSale(params: {
    userId: string;
    purity: PurityGrade;
    weightMilligrams: number;
  }): Promise<GoldHoldingDocument> {
    const userObjectId = new Types.ObjectId(params.userId);

    const holding = await this.holdingModel.findOneAndUpdate(
      {
        userId: userObjectId,
        purity: params.purity,
        weightMilligramsAvailable: { $gte: params.weightMilligrams },
      },
      {
        $inc: {
          weightMilligramsAvailable: -params.weightMilligrams,
          weightMilligramsPending: params.weightMilligrams,
        },
      },
      { new: true },
    );

    if (!holding) {
      throw new BadRequestException('Insufficient gold balance in your vault for this transaction');
    }

    return holding;
  }

  /**
   * Releases reserved gold back to available if a sell order is cancelled or rejected
   */
  async releaseReservedGold(params: {
    userId: string;
    purity: PurityGrade;
    weightMilligrams: number;
  }): Promise<GoldHoldingDocument> {
    const userObjectId = new Types.ObjectId(params.userId);

    const holding = await this.holdingModel.findOneAndUpdate(
      {
        userId: userObjectId,
        purity: params.purity,
        weightMilligramsPending: { $gte: params.weightMilligrams },
      },
      {
        $inc: {
          weightMilligramsAvailable: params.weightMilligrams,
          weightMilligramsPending: -params.weightMilligrams,
        },
      },
      { new: true },
    );

    if (!holding) {
      throw new BadRequestException('Failed to release reserved gold: insufficient pending balance');
    }

    return holding;
  }

  /**
   * Finalizes an executed gold sale upon confirmed payout, clearing pending gold and recording ledger credit
   */
  async settleGoldSale(params: {
    userId: string;
    orderId: string;
    purity: PurityGrade;
    weightMilligrams: number;
    payoutPoisha: number;
    description: string;
  }): Promise<{ entry: LedgerEntryDocument; holding: GoldHoldingDocument }> {
    const userObjectId = new Types.ObjectId(params.userId);

    const holding = await this.holdingModel.findOneAndUpdate(
      {
        userId: userObjectId,
        purity: params.purity,
        weightMilligramsPending: { $gte: params.weightMilligrams },
      },
      {
        $inc: {
          weightMilligramsPending: -params.weightMilligrams,
        },
      },
      { new: true },
    );

    if (!holding) {
      throw new BadRequestException('Cannot settle gold sale: pending balance not reserved');
    }

    if (holding.weightMilligramsAvailable === 0 && holding.weightMilligramsPending === 0) {
      holding.totalCostPoisha = 0;
      holding.averageCostPerMilligramPoisha = 0;
    } else {
      holding.totalCostPoisha = Math.max(
        0,
        holding.totalCostPoisha - Math.round(params.weightMilligrams * holding.averageCostPerMilligramPoisha),
      );
    }
    await holding.save();

    const lastEntry = await this.ledgerModel
      .findOne({ userId: userObjectId })
      .sort({ createdAt: -1 });

    const prevGoldMg = lastEntry ? lastEntry.runningGoldBalanceMg : 0;
    const prevFiatPoisha = lastEntry ? lastEntry.runningFiatBalancePoisha : 0;

    const entryId = `LED-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    const entry = await this.ledgerModel.create({
      entryId,
      userId: userObjectId,
      orderId: params.orderId,
      type: LedgerEntryType.GOLD_SALE,
      debitPoisha: 0,
      creditPoisha: params.payoutPoisha,
      debitGoldMg: params.weightMilligrams,
      creditGoldMg: 0,
      runningGoldBalanceMg: Math.max(0, prevGoldMg - params.weightMilligrams),
      runningFiatBalancePoisha: prevFiatPoisha + params.payoutPoisha,
      description: params.description,
    });

    this.logger.log(
      `[LEDGER DEBIT SETTLED] User: ${params.userId} -${params.weightMilligrams}mg (${params.purity}) payout: ${params.payoutPoisha} poisha`,
    );

    return { entry, holding };
  }

  /**
   * Debits gold from customer holding for direct sale or physical redemption (atomic)
   */
  async debitGoldSale(params: {
    userId: string;
    orderId: string;
    purity: PurityGrade;
    weightMilligrams: number;
    payoutPoisha: number;
    description: string;
  }): Promise<{ entry: LedgerEntryDocument; holding: GoldHoldingDocument }> {
    const userObjectId = new Types.ObjectId(params.userId);

    const holding = await this.holdingModel.findOneAndUpdate(
      {
        userId: userObjectId,
        purity: params.purity,
        weightMilligramsAvailable: { $gte: params.weightMilligrams },
      },
      {
        $inc: {
          weightMilligramsAvailable: -params.weightMilligrams,
        },
      },
      { new: true },
    );

    if (!holding) {
      throw new BadRequestException('Insufficient gold balance in your vault for this transaction');
    }

    if (holding.weightMilligramsAvailable === 0) {
      holding.totalCostPoisha = 0;
      holding.averageCostPerMilligramPoisha = 0;
    } else {
      holding.totalCostPoisha = Math.max(
        0,
        holding.totalCostPoisha - Math.round(params.weightMilligrams * holding.averageCostPerMilligramPoisha),
      );
    }
    await holding.save();

    const lastEntry = await this.ledgerModel
      .findOne({ userId: userObjectId })
      .sort({ createdAt: -1 });

    const prevGoldMg = lastEntry ? lastEntry.runningGoldBalanceMg : 0;
    const prevFiatPoisha = lastEntry ? lastEntry.runningFiatBalancePoisha : 0;

    const entryId = `LED-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    const entry = await this.ledgerModel.create({
      entryId,
      userId: userObjectId,
      orderId: params.orderId,
      type: LedgerEntryType.GOLD_SALE,
      debitPoisha: 0,
      creditPoisha: params.payoutPoisha,
      debitGoldMg: params.weightMilligrams,
      creditGoldMg: 0,
      runningGoldBalanceMg: Math.max(0, prevGoldMg - params.weightMilligrams),
      runningFiatBalancePoisha: prevFiatPoisha + params.payoutPoisha,
      description: params.description,
    });

    this.logger.log(
      `[LEDGER DEBIT] User: ${params.userId} -${params.weightMilligrams}mg (${params.purity}) payout: ${params.payoutPoisha} poisha`,
    );

    return { entry, holding };
  }

  /**
   * Reverses a gold purchase upon authorized refund, debiting gold holding and recording reversal entry
   */
  async reverseGoldPurchase(params: {
    userId: string;
    orderId: string;
    paymentId: string;
    purity: PurityGrade;
    weightMilligrams: number;
    refundPoisha: number;
    description: string;
  }): Promise<{ entry: LedgerEntryDocument; holding: GoldHoldingDocument }> {
    const userObjectId = new Types.ObjectId(params.userId);

    const holding = await this.holdingModel.findOne({
      userId: userObjectId,
      purity: params.purity,
    });

    if (!holding || holding.weightMilligramsAvailable < params.weightMilligrams) {
      throw new BadRequestException('Cannot reverse gold purchase: gold has already been withdrawn or sold');
    }

    const newWeightMg = holding.weightMilligramsAvailable - params.weightMilligrams;
    const newTotalCostPoisha = Math.max(0, holding.totalCostPoisha - params.refundPoisha);
    const newAvgCostPerMg = newWeightMg > 0 ? Math.round(newTotalCostPoisha / newWeightMg) : 0;

    holding.weightMilligramsAvailable = newWeightMg;
    holding.totalCostPoisha = newTotalCostPoisha;
    holding.averageCostPerMilligramPoisha = newAvgCostPerMg;
    await holding.save();

    const lastEntry = await this.ledgerModel
      .findOne({ userId: userObjectId })
      .sort({ createdAt: -1 });

    const prevGoldMg = lastEntry ? lastEntry.runningGoldBalanceMg : 0;
    const prevFiatPoisha = lastEntry ? lastEntry.runningFiatBalancePoisha : 0;

    const entryId = `LED-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    const entry = await this.ledgerModel.create({
      entryId,
      userId: userObjectId,
      orderId: params.orderId,
      paymentId: params.paymentId,
      type: LedgerEntryType.REVERSAL,
      debitPoisha: 0,
      creditPoisha: params.refundPoisha,
      debitGoldMg: params.weightMilligrams,
      creditGoldMg: 0,
      runningGoldBalanceMg: Math.max(0, prevGoldMg - params.weightMilligrams),
      runningFiatBalancePoisha: prevFiatPoisha,
      description: params.description,
    });

    this.logger.log(
      `[LEDGER REVERSAL] User: ${params.userId} -${params.weightMilligrams}mg (${params.purity}) refunded: ${params.refundPoisha} poisha`,
    );

    return { entry, holding };
  }

  async getCustomerLedgerHistory(userId: string, limit: number = 50, skip: number = 0) {
    const userObjectId = new Types.ObjectId(userId);
    const [entries, total] = await Promise.all([
      this.ledgerModel
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.ledgerModel.countDocuments({ userId: userObjectId }),
    ]);

    return { entries, total, limit, skip };
  }
}
