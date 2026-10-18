import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  PurityGrade,
  MarketplaceCategory,
  MarketplaceListingStatus,
  MarketplaceVerificationStatus,
  ItemCondition,
  CommerceOrderType,
  FulfillmentStatus,
  AuditAction,
  Role,
  CONVERSIONS,
} from '@aurumsave/shared';
import {
  MarketplaceListing,
  MarketplaceListingDocument,
} from '../../database/schemas/marketplace-listing.schema';
import {
  CommerceOrder,
  CommerceOrderDocument,
} from '../../database/schemas/commerce-order.schema';
import {
  PickupPoint,
  PickupPointDocument,
} from '../../database/schemas/pickup-point.schema';
import {
  JewellerySellRequest,
  JewellerySellRequestDocument,
} from '../../database/schemas/jewellery-sell-request.schema';
import { PriceService } from '../prices/price.service';
import { AuditService } from '../audit/audit.service';

export interface CreateListingDto {
  category: MarketplaceCategory;
  title: string;
  description: string;
  photos: string[];
  claimedPurity: PurityGrade;
  claimedGrossWeightGrams: number;
  claimedNetGoldWeightGrams: number;
  condition: ItemCondition;
  askingPricePoisha: number;
}

export interface ReviewListingDto {
  decision: 'APPROVE' | 'REJECT';
  verifiedPurity?: PurityGrade;
  verifiedNetGoldWeightGrams?: number;
  notes?: string;
  rejectionReason?: string;
}

export interface CreateScrapSellDto {
  category: string;
  claimedPurity: PurityGrade;
  claimedGrossWeightGrams: number;
  preferredPickupPointId: string;
  photos?: string[];
  disbursementMethod?: string;
}

export interface AppraiseScrapDto {
  actualPurity: PurityGrade;
  actualGrossWeightGrams: number;
  stoneWeightDeductionGrams: number;
  assayStaffNotes?: string;
}

@Injectable()
export class MarketplaceService implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectModel(MarketplaceListing.name)
    private readonly listingModel: Model<MarketplaceListingDocument>,
    @InjectModel(CommerceOrder.name)
    private readonly orderModel: Model<CommerceOrderDocument>,
    @InjectModel(PickupPoint.name)
    private readonly pickupModel: Model<PickupPointDocument>,
    @InjectModel(JewellerySellRequest.name)
    private readonly scrapModel: Model<JewellerySellRequestDocument>,
    private readonly priceService: PriceService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedInitialListings();
  }

  async seedInitialListings() {
    try {
      const count = await this.listingModel.countDocuments();
      if (count === 0) {
        this.logger.log('Seeding initial verified customer marketplace listings...');
        await this.listingModel.create([
          {
            listingId: 'LST-BAR-5G-PAMP',
            sellerId: new Types.ObjectId('650000000000000000000001'),
            sellerName: 'Karim Ullah (Verified Private Client)',
            category: MarketplaceCategory.GOLD_BAR,
            title: 'PAMP Suisse 5g 24K Minted Gold Bar (Assayed Card)',
            description: 'Original sealed blister pack from PAMP Suisse with certificate serial number #99214. Stored in temperature-controlled private locker.',
            photos: ['/images/hero/vault-cinematic.jpg'],
            claimedPurity: PurityGrade.K24,
            verifiedPurity: PurityGrade.K24,
            claimedGrossWeightGrams: 5.0,
            claimedNetGoldWeightGrams: 5.0,
            verifiedNetGoldWeightGrams: 5.0,
            stoneWastageDeductionGrams: 0,
            condition: ItemCondition.NEW_IN_BLISTER,
            askingPricePoisha: 6280000,
            status: MarketplaceListingStatus.ACTIVE,
            verificationStatus: MarketplaceVerificationStatus.PHYSICALLY_ASSAYED,
            verificationNotes: 'XRF Spectrometer verified 99.98% Au at Gulshan Depository Desk.',
            verifiedAt: new Date(),
          },
          {
            listingId: 'LST-CHAIN-1BHORI-22K',
            sellerId: new Types.ObjectId('650000000000000000000002'),
            sellerName: 'Farhana Yasmin',
            category: MarketplaceCategory.CHAIN,
            title: 'Heritage 1 Bhori (11.664g) 22K Solid Gold Rope Chain',
            description: 'Traditional solid rope chain purchased from a reputed BAJUS jeweller with original memo. Net gold weight 11.200g after 0.464g hook/lock solder deduction.',
            photos: ['/images/hero/bullion-macro.jpg'],
            claimedPurity: PurityGrade.K22,
            verifiedPurity: PurityGrade.K22,
            claimedGrossWeightGrams: 11.664,
            claimedNetGoldWeightGrams: 11.2,
            verifiedNetGoldWeightGrams: 11.2,
            stoneWastageDeductionGrams: 0.464,
            condition: ItemCondition.LIKE_NEW,
            askingPricePoisha: 13150000,
            status: MarketplaceListingStatus.ACTIVE,
            verificationStatus: MarketplaceVerificationStatus.DOCUMENT_VERIFIED,
            verificationNotes: 'Original invoice and hallmark 916 verified by desk officer.',
            verifiedAt: new Date(),
          },
          {
            listingId: 'LST-RING-21K-VINTAGE',
            sellerId: new Types.ObjectId('650000000000000000000003'),
            sellerName: 'Tanvir Hossain',
            category: MarketplaceCategory.RING,
            title: 'Classic 21K Gold Wedding Ring (3.2g)',
            description: 'Minimalist 21K gold band. Seeking safe handover via AurumSave escrow desk.',
            photos: ['/images/hero/texture-cinematic.jpg'],
            claimedPurity: PurityGrade.K21,
            claimedGrossWeightGrams: 3.2,
            claimedNetGoldWeightGrams: 3.2,
            stoneWastageDeductionGrams: 0,
            condition: ItemCondition.USED_GOOD,
            askingPricePoisha: 3450000,
            status: MarketplaceListingStatus.PENDING_REVIEW,
            verificationStatus: MarketplaceVerificationStatus.UNVERIFIED,
          },
        ]);
        this.logger.log('Initial verified marketplace listings seeded successfully.');
      }
    } catch (err: any) {
      this.logger.warn(`Marketplace listings seed skipped: ${err.message}`);
    }
  }

  // 1. Create a customer listing (Starts as PENDING_REVIEW and UNVERIFIED)
  async createListing(userId: string, userName: string, dto: CreateListingDto) {
    if (dto.claimedGrossWeightGrams <= 0 || dto.claimedNetGoldWeightGrams <= 0) {
      throw new BadRequestException('Weights must be positive numbers');
    }
    if (dto.claimedGrossWeightGrams < dto.claimedNetGoldWeightGrams) {
      throw new BadRequestException('Gross weight cannot be less than net gold weight');
    }
    if (dto.askingPricePoisha <= 0) {
      throw new BadRequestException('Asking price must be greater than zero');
    }

    const stoneWastage = Math.max(
      0,
      Number((dto.claimedGrossWeightGrams - dto.claimedNetGoldWeightGrams).toFixed(3)),
    );

    const listingId = `LST-${Date.now().toString().slice(-6)}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const listing = await this.listingModel.create({
      listingId,
      sellerId: new Types.ObjectId(userId),
      sellerName: userName,
      category: dto.category,
      title: dto.title.trim(),
      description: dto.description.trim(),
      photos: dto.photos && dto.photos.length > 0 ? dto.photos : ['/images/hero/macro-bar.jpg'],
      claimedPurity: dto.claimedPurity,
      claimedGrossWeightGrams: dto.claimedGrossWeightGrams,
      claimedNetGoldWeightGrams: dto.claimedNetGoldWeightGrams,
      stoneWastageDeductionGrams: stoneWastage,
      condition: dto.condition,
      askingPricePoisha: Math.round(dto.askingPricePoisha),
      status: MarketplaceListingStatus.PENDING_REVIEW,
      verificationStatus: MarketplaceVerificationStatus.UNVERIFIED,
    });

    await this.auditService.log({
      actorId: userId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.COMMERCE_MARKETPLACE_LISTED,
      entityType: 'MarketplaceListing',
      entityId: listingId,
      details: {
        category: dto.category,
        claimedPurity: dto.claimedPurity,
        grossGrams: dto.claimedGrossWeightGrams,
        netGrams: dto.claimedNetGoldWeightGrams,
        askingBdt: dto.askingPricePoisha / CONVERSIONS.POISHA_PER_BDT,
      },
    });

    return {
      success: true,
      message: 'Listing submitted for staff appraisal and review. It will appear publicly once approved.',
      listing,
    };
  }

  // 2. Public feed of active listings
  async getActiveListings(filters: {
    category?: MarketplaceCategory;
    purity?: PurityGrade;
    minPricePoisha?: number;
    maxPricePoisha?: number;
  }) {
    const query: any = { status: MarketplaceListingStatus.ACTIVE };

    if (filters.category) query.category = filters.category;
    if (filters.purity) {
      query.$or = [
        { verifiedPurity: filters.purity },
        { claimedPurity: filters.purity },
      ];
    }
    if (filters.minPricePoisha || filters.maxPricePoisha) {
      query.askingPricePoisha = {};
      if (filters.minPricePoisha) query.askingPricePoisha.$gte = filters.minPricePoisha;
      if (filters.maxPricePoisha) query.askingPricePoisha.$lte = filters.maxPricePoisha;
    }

    const listings = await this.listingModel.find(query).sort({ createdAt: -1 }).lean();
    return listings;
  }

  // 3. Get single listing by ID
  async getListingById(listingId: string) {
    const listing = await this.listingModel.findOne({ listingId }).lean();
    if (!listing) throw new NotFoundException('Marketplace listing not found');
    return listing;
  }

  // 4. Get listings by seller
  async getMyListings(userId: string) {
    return this.listingModel
      .find({ sellerId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  // 5. Cancel listing (seller action)
  async cancelListing(userId: string, listingId: string) {
    const listing = await this.listingModel.findOne({
      listingId,
      sellerId: new Types.ObjectId(userId),
    });
    if (!listing) throw new NotFoundException('Listing not found or you are not the owner');

    if (
      listing.status !== MarketplaceListingStatus.PENDING_REVIEW &&
      listing.status !== MarketplaceListingStatus.ACTIVE
    ) {
      throw new BadRequestException(
        `Cannot cancel listing with status "${listing.status}"`,
      );
    }

    listing.status = MarketplaceListingStatus.CANCELLED;
    await listing.save();

    return { success: true, message: 'Listing cancelled successfully' };
  }

  // 6. Staff review queue
  async getReviewQueue() {
    return this.listingModel
      .find({ status: MarketplaceListingStatus.PENDING_REVIEW })
      .sort({ createdAt: 1 })
      .lean();
  }

  // 7. Staff approves or rejects listing
  async reviewListing(staffId: string, listingId: string, dto: ReviewListingDto) {
    const listing = await this.listingModel.findOne({ listingId });
    if (!listing) throw new NotFoundException('Listing not found');

    if (listing.status !== MarketplaceListingStatus.PENDING_REVIEW) {
      throw new BadRequestException(`Listing is not pending review (current: ${listing.status})`);
    }

    if (dto.decision === 'APPROVE') {
      listing.status = MarketplaceListingStatus.ACTIVE;
      if (dto.verifiedPurity && dto.verifiedNetGoldWeightGrams) {
        listing.verificationStatus = MarketplaceVerificationStatus.PHYSICALLY_ASSAYED;
        listing.verifiedPurity = dto.verifiedPurity;
        listing.verifiedNetGoldWeightGrams = dto.verifiedNetGoldWeightGrams;
      } else {
        listing.verificationStatus = MarketplaceVerificationStatus.DOCUMENT_VERIFIED;
      }
      listing.verifiedByStaffId = new Types.ObjectId(staffId);
      listing.verifiedAt = new Date();
      listing.verificationNotes = dto.notes || 'Verified by AurumSave Jewellery & Bullion Desk';
    } else {
      listing.status = MarketplaceListingStatus.REJECTED;
      listing.rejectionReason = dto.rejectionReason || 'Item does not meet marketplace authenticity guidelines';
      listing.verifiedByStaffId = new Types.ObjectId(staffId);
      listing.verifiedAt = new Date();
    }

    await listing.save();

    await this.auditService.log({
      actorId: staffId,
      actorRole: Role.ADMIN,
      action: AuditAction.COMMERCE_MARKETPLACE_REVIEWED,
      entityType: 'MarketplaceListing',
      entityId: listingId,
      details: {
        decision: dto.decision,
        verificationStatus: listing.verificationStatus,
        notes: dto.notes,
        rejectionReason: dto.rejectionReason,
      },
    });

    return {
      success: true,
      message: `Listing ${dto.decision === 'APPROVE' ? 'approved and made active' : 'rejected'}.`,
      listing,
    };
  }

  // 8. Purchase marketplace item via Escrow
  async purchaseWithEscrow(
    buyerId: string,
    dto: { listingId: string; pickupPointId: string },
  ) {
    const pickup = await this.pickupModel.findOne({
      pointId: dto.pickupPointId,
      status: 'ACTIVE',
    });
    if (!pickup) {
      throw new BadRequestException('Selected pickup point is invalid or currently inactive');
    }

    // Atomically reserve listing
    const listing = await this.listingModel.findOneAndUpdate(
      {
        listingId: dto.listingId,
        status: MarketplaceListingStatus.ACTIVE,
      },
      {
        $set: {
          status: MarketplaceListingStatus.RESERVED,
          reservedByUserId: new Types.ObjectId(buyerId),
          reservationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour reservation
        },
      },
      { new: true },
    );

    if (!listing) {
      throw new ConflictException('This listing has already been reserved or sold to another customer');
    }

    if (listing.sellerId.toString() === buyerId) {
      // Revert reservation
      await this.listingModel.updateOne(
        { listingId: dto.listingId },
        { $set: { status: MarketplaceListingStatus.ACTIVE, reservedByUserId: null } },
      );
      throw new BadRequestException('You cannot purchase your own marketplace listing');
    }

    try {
      const askingPoisha = listing.askingPricePoisha;
      // 1.5% AurumSave Escrow & Safe Handover Assurance fee
      const platformFeePoisha = Math.round(askingPoisha * 0.015);
      const assayFeePoisha = 35000; // ৳350 compulsory desk inspection & assay testing fee
      const totalPoisha = askingPoisha + platformFeePoisha + assayFeePoisha;

      const orderId = `ORD-MKT-${Date.now().toString().slice(-6)}-${uuidv4().substring(0, 4).toUpperCase()}`;
      const pickupVerificationOtp = Math.floor(100000 + Math.random() * 900000).toString();

      const order = await this.orderModel.create({
        orderId,
        commerceType: CommerceOrderType.MARKETPLACE,
        buyerId: new Types.ObjectId(buyerId),
        sellerId: listing.sellerId,
        items: [
          {
            listingId: listing.listingId,
            title: listing.title,
            purity: listing.verifiedPurity || listing.claimedPurity,
            weightGrams: listing.verifiedNetGoldWeightGrams || listing.claimedNetGoldWeightGrams,
            unitPricePoisha: askingPoisha,
            makingFeePoisha: 0,
            quantity: 1,
            totalPoisha: askingPoisha,
          },
        ],
        subtotalPoisha: askingPoisha,
        platformFeePoisha,
        assayFeePoisha,
        totalPoisha,
        paymentStatus: 'ESCROW_HELD',
        fulfillmentStatus: FulfillmentStatus.READY_FOR_PICKUP,
        pickupPointId: pickup.pointId,
        pickupVerificationOtp,
      });

      listing.escrowOrderId = orderId;
      listing.buyerId = new Types.ObjectId(buyerId);
      await listing.save();

      await this.auditService.log({
        actorId: buyerId,
        actorRole: Role.CUSTOMER,
        action: AuditAction.COMMERCE_ESCROW_LOCKED,
        entityType: 'CommerceOrder',
        entityId: orderId,
        details: {
          listingId: listing.listingId,
          sellerId: listing.sellerId.toString(),
          subtotalBdt: askingPoisha / CONVERSIONS.POISHA_PER_BDT,
          platformFeeBdt: platformFeePoisha / CONVERSIONS.POISHA_PER_BDT,
          totalBdt: totalPoisha / CONVERSIONS.POISHA_PER_BDT,
          pickupPointId: pickup.pointId,
        },
      });

      return {
        success: true,
        message: 'Order created with Escrow protection. Funds are safely held until both parties complete physical handover and verification at the AurumSave desk.',
        order,
      };
    } catch (err: any) {
      // Revert reservation on order creation failure
      await this.listingModel.updateOne(
        { listingId: dto.listingId },
        { $set: { status: MarketplaceListingStatus.ACTIVE, reservedByUserId: null } },
      );
      throw err;
    }
  }

  // 9. Scrap Jewellery / Direct Sell Requests
  async createScrapSellRequest(
    userId: string,
    userName: string,
    customerPhone: string,
    dto: CreateScrapSellDto,
  ) {
    if (dto.claimedGrossWeightGrams <= 0) {
      throw new BadRequestException('Gross weight must be greater than 0');
    }

    const pickup = await this.pickupModel.findOne({
      pointId: dto.preferredPickupPointId,
      status: 'ACTIVE',
    });
    if (!pickup) {
      throw new BadRequestException('Selected district pickup/assay desk is invalid or inactive');
    }

    const requestId = `JWL-${Date.now().toString().slice(-6)}-${uuidv4().substring(0, 4).toUpperCase()}`;

    const request = await this.scrapModel.create({
      requestId,
      customerId: new Types.ObjectId(userId),
      customerName: userName,
      customerPhone: customerPhone || 'Not provided',
      category: dto.category,
      claimedPurity: dto.claimedPurity,
      claimedGrossWeightGrams: dto.claimedGrossWeightGrams,
      photos: dto.photos || [],
      preferredPickupPointId: pickup.pointId,
      status: 'SUBMITTED',
      disbursementMethod: dto.disbursementMethod || 'GOLD_WALLET_CREDIT',
    });

    await this.auditService.log({
      actorId: userId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.JEWELLERY_SELL_REQUESTED,
      entityType: 'JewellerySellRequest',
      entityId: requestId,
      details: {
        category: dto.category,
        claimedPurity: dto.claimedPurity,
        grossGrams: dto.claimedGrossWeightGrams,
        pickupPointId: pickup.pointId,
      },
    });

    return {
      success: true,
      message: 'Scrap gold/jewellery liquidation request submitted. Visit your designated desk for on-site XRF testing and immediate payout.',
      request,
    };
  }

  async getMyScrapSellRequests(userId: string) {
    return this.scrapModel
      .find({ customerId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getScrapSellQueue() {
    return this.scrapModel
      .find({ status: { $in: ['SUBMITTED', 'SCHEDULED_FOR_ASSAY', 'ASSAYED_OFFER_MADE'] } })
      .sort({ createdAt: 1 })
      .lean();
  }

  async appraiseScrapRequest(staffId: string, requestId: string, dto: AppraiseScrapDto) {
    const request = await this.scrapModel.findOne({ requestId });
    if (!request) throw new NotFoundException('Scrap sell request not found');

    const netGoldWeight = Math.max(
      0.001,
      Number((dto.actualGrossWeightGrams - dto.stoneWeightDeductionGrams).toFixed(3)),
    );

    const rate = await this.priceService.getRateForPurity(dto.actualPurity);
    const offerPoisha = Math.round(rate.sellPricePerGramPoisha * netGoldWeight);

    request.actualPurity = dto.actualPurity;
    request.actualGrossWeightGrams = dto.actualGrossWeightGrams;
    request.stoneWeightDeductionGrams = dto.stoneWeightDeductionGrams;
    request.actualNetGoldWeightGrams = netGoldWeight;
    request.calculatedOfferPoisha = offerPoisha;
    request.status = 'ASSAYED_OFFER_MADE';
    request.assayStaffId = new Types.ObjectId(staffId);
    request.assayStaffNotes = dto.assayStaffNotes || 'Assayed via on-site XRF Spectrometer';
    request.assayedAt = new Date();

    await request.save();

    await this.auditService.log({
      actorId: staffId,
      actorRole: Role.ADMIN,
      action: AuditAction.JEWELLERY_ASSAY_COMPLETED,
      entityType: 'JewellerySellRequest',
      entityId: requestId,
      details: {
        actualPurity: dto.actualPurity,
        netGrams: netGoldWeight,
        offerBdt: offerPoisha / CONVERSIONS.POISHA_PER_BDT,
      },
    });

    return {
      success: true,
      message: 'Appraisal completed and formal purchase offer recorded.',
      request,
    };
  }

  async respondToScrapOffer(userId: string, requestId: string, action: 'ACCEPT' | 'REJECT') {
    const request = await this.scrapModel.findOne({
      requestId,
      customerId: new Types.ObjectId(userId),
    });
    if (!request) throw new NotFoundException('Request not found');

    if (request.status !== 'ASSAYED_OFFER_MADE') {
      throw new BadRequestException('Offer is not ready or has already been resolved');
    }

    if (action === 'ACCEPT') {
      request.status = 'ACCEPTED_BY_CUSTOMER';
    } else {
      request.status = 'REJECTED';
    }

    await request.save();
    return {
      success: true,
      message: `Offer ${action.toLowerCase()}ed.`,
      request,
    };
  }
}
