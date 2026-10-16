import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CustomerHoldingsSummary,
  CONVERSIONS,
  PurityGrade,
} from '@aurumsave/shared';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { GoldHolding, GoldHoldingDocument } from '../../database/schemas/gold-holding.schema';
import { PriceService } from '../prices/price.service';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectModel(GoldHolding.name) private readonly holdingModel: Model<GoldHoldingDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly priceService: PriceService,
    private readonly ledgerService: LedgerService,
  ) {}

  async getPortfolioSummary(userId: string): Promise<CustomerHoldingsSummary> {
    const userObjectId = new Types.ObjectId(userId);
    const holdings = await this.holdingModel.find({ userId: userObjectId }).lean();
    const liveRates = await this.priceService.getCurrentRates();

    const rateMap = new Map(liveRates.map((r) => [r.purity, r.buyPricePerGramBdt]));

    let totalGoldMg = 0;
    let availableGoldMg = 0;
    let pendingGoldMg = 0;
    let totalValuationBdt = 0;
    let totalCostBdt = 0;

    const breakdownByPurity = holdings.map((h) => {
      const ratePerGram = rateMap.get(h.purity) || 0;
      const ratePerMg = ratePerGram / CONVERSIONS.MILLIGRAMS_PER_GRAM;
      const valuationBdt = Number((h.weightMilligramsAvailable * ratePerMg).toFixed(2));
      const costBdt = Number((h.totalCostPoisha / CONVERSIONS.POISHA_PER_BDT).toFixed(2));

      totalGoldMg += h.weightMilligramsAvailable + h.weightMilligramsPending;
      availableGoldMg += h.weightMilligramsAvailable;
      pendingGoldMg += h.weightMilligramsPending;
      totalValuationBdt += valuationBdt;
      totalCostBdt += costBdt;

      const avgRateBdt =
        h.weightMilligramsAvailable > 0
          ? Number(((h.averageCostPerMilligramPoisha * CONVERSIONS.MILLIGRAMS_PER_GRAM) / CONVERSIONS.POISHA_PER_BDT).toFixed(2))
          : 0;

      return {
        purity: h.purity,
        grams: Number((h.weightMilligramsAvailable / CONVERSIONS.MILLIGRAMS_PER_GRAM).toFixed(4)),
        valuationBdt,
        avgPurchaseRateBdt: avgRateBdt,
      };
    });

    const unrealizedGainLossBdt = Number((totalValuationBdt - totalCostBdt).toFixed(2));
    const unrealizedGainLossPercentage =
      totalCostBdt > 0
        ? Number(((unrealizedGainLossBdt / totalCostBdt) * 100).toFixed(2))
        : 0;

    return {
      totalGoldGrams: Number((totalGoldMg / CONVERSIONS.MILLIGRAMS_PER_GRAM).toFixed(4)),
      availableGoldGrams: Number((availableGoldMg / CONVERSIONS.MILLIGRAMS_PER_GRAM).toFixed(4)),
      pendingGoldGrams: Number((pendingGoldMg / CONVERSIONS.MILLIGRAMS_PER_GRAM).toFixed(4)),
      totalValuationBdt: Number(totalValuationBdt.toFixed(2)),
      unrealizedGainLossBdt,
      unrealizedGainLossPercentage,
      breakdownByPurity,
      fiatBalanceBdt: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getPortfolioHistory(userId: string) {
    return this.ledgerService.getCustomerLedgerHistory(userId, 50, 0);
  }

  async getAccountStatement(userId: string, startDate?: string, endDate?: string) {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId).select('fullName email phone kycStatus createdAt').lean();

    const ledgerEntries = await this.ledgerService.getCustomerLedgerHistory(userId, 500, 0);
    const currentSummary = await this.getPortfolioSummary(userId);

    // Filter by date range if provided
    const filteredEntries = ledgerEntries.entries.filter((e: any) => {
      const d = new Date(e.createdAt);
      if (startDate && d < new Date(startDate)) return false;
      if (endDate && d > new Date(endDate)) return false;
      return true;
    });

    let totalCreditedGoldMg = 0;
    let totalDebitedGoldMg = 0;
    let totalDepositedPoisha = 0;
    let totalLiquidatedPoisha = 0;

    for (const item of filteredEntries) {
      totalCreditedGoldMg += item.creditGoldMg || 0;
      totalDebitedGoldMg += item.debitGoldMg || 0;
      totalDepositedPoisha += item.creditPoisha || 0;
      totalLiquidatedPoisha += item.debitPoisha || 0;
    }

    const statementId = `STMT-${Date.now()}-${userId.slice(-6).toUpperCase()}`;

    return {
      statementId,
      institution: {
        name: 'AurumSave Bullion Vaults Ltd.',
        license: 'Bangladesh Bank AML/CFT Compliant Bullion Depository',
        address: 'Gulshan Financial District, Dhaka-1212, Bangladesh',
      },
      accountHolder: {
        userId,
        fullName: user?.fullName || 'Valued Customer',
        email: user?.email || '',
        phone: user?.phone || '',
        kycStatus: user?.kycStatus || 'UNVERIFIED',
      },
      statementPeriod: {
        from: startDate || (user as any)?.createdAt || new Date(Date.now() - 30 * 86400000).toISOString(),
        to: endDate || new Date().toISOString(),
        generatedAt: new Date().toISOString(),
      },
      summary: {
        totalGoldGrams: currentSummary.totalGoldGrams,
        availableGoldGrams: currentSummary.availableGoldGrams,
        currentValuationBdt: currentSummary.totalValuationBdt,
        periodPurchasedGrams: Number((totalCreditedGoldMg / CONVERSIONS.MILLIGRAMS_PER_GRAM).toFixed(4)),
        periodLiquidatedGrams: Number((totalDebitedGoldMg / CONVERSIONS.MILLIGRAMS_PER_GRAM).toFixed(4)),
        periodDepositedBdt: totalDepositedPoisha / CONVERSIONS.POISHA_PER_BDT,
        periodLiquidatedBdt: totalLiquidatedPoisha / CONVERSIONS.POISHA_PER_BDT,
        unrealizedGainLossBdt: currentSummary.unrealizedGainLossBdt,
        unrealizedGainLossPercentage: currentSummary.unrealizedGainLossPercentage,
      },
      holdingsBreakdown: currentSummary.breakdownByPurity,
      transactions: filteredEntries.map((e: any) => ({
        entryId: e.entryId,
        date: e.createdAt,
        type: e.type,
        description: e.description,
        orderId: e.orderId,
        goldChangeGrams: Number((((e.creditGoldMg || 0) - (e.debitGoldMg || 0)) / CONVERSIONS.MILLIGRAMS_PER_GRAM).toFixed(4)),
        fiatAmountBdt: ((e.creditPoisha || 0) + (e.debitPoisha || 0)) / CONVERSIONS.POISHA_PER_BDT,
        runningGoldBalanceGrams: Number(((e.runningGoldBalanceMg || 0) / CONVERSIONS.MILLIGRAMS_PER_GRAM).toFixed(4)),
      })),
    };
  }
}
