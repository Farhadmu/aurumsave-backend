import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CustomerHoldingsSummary,
  CONVERSIONS,
  PurityGrade,
} from '@aurumsave/shared';
import { GoldHolding, GoldHoldingDocument } from '../../database/schemas/gold-holding.schema';
import { PriceService } from '../prices/price.service';
import { LedgerService } from '../ledger/ledger.service';

@Injectable()
export class PortfolioService {
  constructor(
    @InjectModel(GoldHolding.name) private readonly holdingModel: Model<GoldHoldingDocument>,
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
}
