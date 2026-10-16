import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { OrderType, CONVERSIONS, QuoteDetails } from '@aurumsave/shared';
import { Quote, QuoteDocument } from '../../database/schemas/quote.schema';
import { PriceService } from '../prices/price.service';
import { CreateQuoteDto } from './quote.dto';

const QUOTE_VALIDITY_SECONDS = 300; // 5 minutes rate lock

@Injectable()
export class QuoteService {
  constructor(
    @InjectModel(Quote.name) private readonly quoteModel: Model<QuoteDocument>,
    private readonly priceService: PriceService,
  ) {}

  async createQuote(userId: string, dto: CreateQuoteDto): Promise<QuoteDetails> {
    if (!dto.grams && !dto.amountBdt) {
      throw new BadRequestException('Either grams or amountBdt must be specified');
    }

    const liveRate = await this.priceService.getRateForPurity(dto.purity);
    if (liveRate.isStale) {
      throw new BadRequestException(
        `Gold market benchmark rates for ${dto.purity} are currently stale or unverified (expired: ${liveRate.expiresAt}). Real-money quotes are temporarily halted until rates are refreshed.`,
      );
    }
    const pricePerGramPoisha =
      dto.orderType === OrderType.BUY
        ? liveRate.buyPricePerGramPoisha
        : liveRate.sellPricePerGramPoisha;

    // Rate per milligram in poisha
    const ratePerMilligramPoisha = pricePerGramPoisha / CONVERSIONS.MILLIGRAMS_PER_GRAM;

    let weightMilligrams: number;
    let subtotalPoisha: number;

    if (dto.grams) {
      weightMilligrams = Math.round(dto.grams * CONVERSIONS.MILLIGRAMS_PER_GRAM);
      subtotalPoisha = Math.round(weightMilligrams * ratePerMilligramPoisha);
    } else {
      const targetPoisha = Math.round((dto.amountBdt || 0) * CONVERSIONS.POISHA_PER_BDT);
      weightMilligrams = Math.floor(targetPoisha / ratePerMilligramPoisha);
      subtotalPoisha = Math.round(weightMilligrams * ratePerMilligramPoisha);
    }

    if (weightMilligrams <= 0) {
      throw new BadRequestException('Calculated gold weight is below the minimum threshold (100mg)');
    }

    // Platform fee: 0.5% for buy, 0% for sell
    const platformFeePoisha =
      dto.orderType === OrderType.BUY ? Math.round(subtotalPoisha * 0.005) : 0;
    const vaultStorageFeePoisha = 0; // Free allocated vault storage

    const totalPoisha =
      dto.orderType === OrderType.BUY
        ? subtotalPoisha + platformFeePoisha + vaultStorageFeePoisha
        : subtotalPoisha - platformFeePoisha;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + QUOTE_VALIDITY_SECONDS * 1000);
    const quoteId = `QTE-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;

    await this.quoteModel.create({
      quoteId,
      userId: new Types.ObjectId(userId),
      orderType: dto.orderType,
      purity: dto.purity,
      weightMilligrams,
      ratePerMilligramPoisha,
      subtotalPoisha,
      platformFeePoisha,
      vaultStorageFeePoisha,
      totalPoisha,
      expiresAt,
      isUsed: false,
    });

    const weightGrams = Number((weightMilligrams / CONVERSIONS.MILLIGRAMS_PER_GRAM).toFixed(4));
    const subtotalBdt = Number((subtotalPoisha / CONVERSIONS.POISHA_PER_BDT).toFixed(2));
    const platformFeeBdt = Number((platformFeePoisha / CONVERSIONS.POISHA_PER_BDT).toFixed(2));
    const totalBdt = Number((totalPoisha / CONVERSIONS.POISHA_PER_BDT).toFixed(2));
    const ratePerGramBdt = Number((pricePerGramPoisha / CONVERSIONS.POISHA_PER_BDT).toFixed(2));

    return {
      quoteId,
      orderType: dto.orderType,
      purity: dto.purity,
      weightGrams,
      weightMilligrams,
      ratePerGramBdt,
      subtotalBdt,
      platformFeeBdt,
      vaultStorageFeeBdt: 0,
      totalBdt,
      totalPoisha,
      expiresAt: expiresAt.toISOString(),
      validForSeconds: QUOTE_VALIDITY_SECONDS,
    };
  }

  async getValidQuote(quoteId: string, userId: string): Promise<QuoteDocument> {
    const quote = await this.quoteModel.findOne({ quoteId });
    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.userId.toString() !== userId) {
      throw new BadRequestException('This quote belongs to another user');
    }

    if (quote.isUsed) {
      throw new BadRequestException('This quote has already been utilized');
    }

    if (new Date() > new Date(quote.expiresAt)) {
      throw new BadRequestException('Quote has expired. Please request a fresh rate.');
    }

    return quote;
  }
}
