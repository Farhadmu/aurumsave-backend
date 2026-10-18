import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  PurityGrade,
  CommerceOrderType,
  FulfillmentStatus,
  AuditAction,
  Role,
  CONVERSIONS,
  OfficialProductDto,
} from '@aurumsave/shared';
import { OfficialProduct, OfficialProductDocument } from '../../database/schemas/official-product.schema';
import { CommerceOrder, CommerceOrderDocument } from '../../database/schemas/commerce-order.schema';
import { PickupPoint, PickupPointDocument } from '../../database/schemas/pickup-point.schema';
import { PriceService } from '../prices/price.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OfficialStoreService implements OnModuleInit {
  private readonly logger = new Logger(OfficialStoreService.name);

  constructor(
    @InjectModel(OfficialProduct.name) private readonly productModel: Model<OfficialProductDocument>,
    @InjectModel(CommerceOrder.name) private readonly orderModel: Model<CommerceOrderDocument>,
    @InjectModel(PickupPoint.name) private readonly pickupModel: Model<PickupPointDocument>,
    private readonly priceService: PriceService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedInitialOfficialProducts();
  }

  async seedInitialOfficialProducts() {
    try {
      const count = await this.productModel.countDocuments();
      if (count === 0) {
        this.logger.log('Seeding official AurumSave minted bullion products (1g, 5g, 10g, 1 Bhori)...');
        await this.productModel.create([
          {
            productId: 'PROD-BAR-1G-24K',
            titleEn: 'AurumSave Sovereign 1g 24K Minted Gold Bar',
            titleBn: 'অরামসেভ ১ গ্রাম ২৪ ক্যারেট মিন্টেড গোল্ড বার',
            slug: '1g-24k-minted-gold-bar',
            productType: 'MINTED_BAR',
            purity: PurityGrade.K24,
            weightGrams: 1.0,
            weightMilligrams: 1000,
            makingFeePoisha: 45000, // ৳450 tamper-proof blister fee
            inStockQuantity: 25,
            reservedQuantity: 0,
            images: ['/images/hero/bullion-macro.jpg'],
            certifier: 'BSTI & PAMP Assay Certified',
            standard: 'LBMA Good Delivery Standard',
            isActive: true,
          },
          {
            productId: 'PROD-BAR-5G-24K',
            titleEn: 'AurumSave Sovereign 5g 24K Minted Gold Bar',
            titleBn: 'অরামসেভ ৫ গ্রাম ২৪ ক্যারেট মিন্টেড গোল্ড বার',
            slug: '5g-24k-minted-gold-bar',
            productType: 'MINTED_BAR',
            purity: PurityGrade.K24,
            weightGrams: 5.0,
            weightMilligrams: 5000,
            makingFeePoisha: 125000, // ৳1,250 making fee
            inStockQuantity: 15,
            reservedQuantity: 0,
            images: ['/images/hero/vault-cinematic.jpg'],
            certifier: 'BSTI & PAMP Assay Certified',
            standard: 'LBMA Good Delivery Standard',
            isActive: true,
          },
          {
            productId: 'PROD-BAR-10G-24K',
            titleEn: 'AurumSave Sovereign 10g 24K Minted Gold Bar',
            titleBn: 'অরামসেভ ১০ গ্রাম ২৪ ক্যারেট মিন্টেড গোল্ড বার',
            slug: '10g-24k-minted-gold-bar',
            productType: 'MINTED_BAR',
            purity: PurityGrade.K24,
            weightGrams: 10.0,
            weightMilligrams: 10000,
            makingFeePoisha: 200000, // ৳2,000 making fee
            inStockQuantity: 10,
            reservedQuantity: 0,
            images: ['/images/hero/texture-cinematic.jpg'],
            certifier: 'BSTI & Valcambi Assay Certified',
            standard: 'LBMA Good Delivery Standard',
            isActive: true,
          },
          {
            productId: 'PROD-BAR-1BHORI-22K',
            titleEn: 'AurumSave Heritage 1 Bhori (11.664g) 22K Investment Bar',
            titleBn: 'অরামসেভ হেরিটেজ ১ ভরি (১১.৬৬৪ গ্রাম) ২২ ক্যারেট গোল্ড বার',
            slug: '1-bhori-22k-investment-bar',
            productType: 'CAST_BAR',
            purity: PurityGrade.K22,
            weightGrams: 11.664,
            weightMilligrams: 11664,
            makingFeePoisha: 250000, // ৳2,500 making fee
            inStockQuantity: 8,
            reservedQuantity: 0,
            images: ['/images/hero/bullion-macro.jpg'],
            certifier: 'BSTI Hallmark 916 Assayed',
            standard: 'Bangladesh Jewellery Standard',
            isActive: true,
          },
        ]);
        this.logger.log('Official gold store products seeded successfully.');
      }
    } catch (err: any) {
      this.logger.warn(`Official products seed skipped: ${err.message}`);
    }
  }

  async getProducts(): Promise<any[]> {
    const products = await this.productModel.find({ isActive: true }).sort({ weightGrams: 1 }).lean();
    const liveRates = await this.priceService.getCurrentRates();

    return products.map((prod) => {
      const rate = liveRates.find((r) => r.purity === prod.purity);
      const ratePerGramBdt = rate ? rate.buyPricePerGramBdt : 12450;
      const goldValueBdt = ratePerGramBdt * prod.weightGrams;
      const makingFeeBdt = prod.makingFeePoisha / CONVERSIONS.POISHA_PER_BDT;
      const calculatedPriceBdt = Math.round(goldValueBdt + makingFeeBdt);

      return {
        ...prod,
        ratePerGramBdt,
        goldValueBdt: Math.round(goldValueBdt),
        makingFeeBdt: Math.round(makingFeeBdt),
        calculatedPriceBdt,
        calculatedPricePoisha: calculatedPriceBdt * CONVERSIONS.POISHA_PER_BDT,
      };
    });
  }

  async getProductBySlug(slug: string): Promise<any> {
    const prod = await this.productModel.findOne({ slug }).lean();
    if (!prod) throw new NotFoundException('Gold product not found');

    const rate = await this.priceService.getRateForPurity(prod.purity);
    const goldValueBdt = rate.buyPricePerGramBdt * prod.weightGrams;
    const makingFeeBdt = prod.makingFeePoisha / CONVERSIONS.POISHA_PER_BDT;
    const calculatedPriceBdt = Math.round(goldValueBdt + makingFeeBdt);

    return {
      ...prod,
      ratePerGramBdt: rate.buyPricePerGramBdt,
      goldValueBdt: Math.round(goldValueBdt),
      makingFeeBdt: Math.round(makingFeeBdt),
      calculatedPriceBdt,
      calculatedPricePoisha: calculatedPriceBdt * CONVERSIONS.POISHA_PER_BDT,
    };
  }

  // Atomic reservation to prevent race conditions and overselling
  async reserveProductStock(productId: string, quantity: number): Promise<OfficialProductDocument> {
    const updated = await this.productModel.findOneAndUpdate(
      { productId, inStockQuantity: { $gte: quantity } },
      {
        $inc: { inStockQuantity: -quantity, reservedQuantity: quantity },
      },
      { new: true },
    );

    if (!updated) {
      throw new ConflictException(
        'Selected product quantity is no longer available in company vault stock',
      );
    }
    return updated;
  }

  async releaseProductStock(productId: string, quantity: number) {
    await this.productModel.findOneAndUpdate(
      { productId },
      {
        $inc: { inStockQuantity: quantity, reservedQuantity: -quantity },
      },
    );
  }

  async createStoreOrder(
    buyerId: string,
    dto: {
      productId: string;
      quantity: number;
      pickupPointId: string;
    },
  ) {
    const quantity = Math.max(1, dto.quantity || 1);

    // Verify pickup point exists and is active
    const pickup = await this.pickupModel.findOne({ pointId: dto.pickupPointId, status: 'ACTIVE' });
    if (!pickup) {
      throw new BadRequestException('Selected district pickup point is invalid or currently inactive');
    }

    // Atomically reserve stock
    await this.reserveProductStock(dto.productId, quantity);

    try {
      const product = await this.productModel.findOne({ productId: dto.productId });
      if (!product) throw new NotFoundException('Product not found');

      const rate = await this.priceService.getRateForPurity(product.purity);
      const goldValuePoisha = Math.round(rate.buyPricePerGramPoisha * product.weightGrams);
      const unitTotalPoisha = goldValuePoisha + product.makingFeePoisha;
      const subtotalPoisha = unitTotalPoisha * quantity;
      const totalPoisha = subtotalPoisha;

      const orderId = `ORD-STR-${Date.now().toString().slice(-6)}-${uuidv4().substring(0, 4).toUpperCase()}`;
      // Generate 6-digit handover OTP
      const pickupVerificationOtp = Math.floor(100000 + Math.random() * 900000).toString();

      const order = await this.orderModel.create({
        orderId,
        commerceType: CommerceOrderType.OFFICIAL_STORE,
        buyerId: new Types.ObjectId(buyerId),
        items: [
          {
            productId: product.productId,
            title: product.titleEn,
            purity: product.purity,
            weightGrams: product.weightGrams,
            unitPricePoisha: unitTotalPoisha,
            makingFeePoisha: product.makingFeePoisha,
            quantity,
            totalPoisha: subtotalPoisha,
          },
        ],
        subtotalPoisha,
        platformFeePoisha: 0,
        assayFeePoisha: 0,
        totalPoisha,
        paymentStatus: 'ESCROW_HELD',
        fulfillmentStatus: FulfillmentStatus.READY_FOR_PICKUP,
        pickupPointId: pickup.pointId,
        pickupVerificationOtp,
      });

      await this.auditService.log({
        actorId: buyerId,
        actorRole: Role.CUSTOMER,
        action: AuditAction.COMMERCE_STORE_ORDER_CREATED,
        entityType: 'CommerceOrder',
        entityId: orderId,
        details: {
          productId: product.productId,
          quantity,
          totalBdt: totalPoisha / CONVERSIONS.POISHA_PER_BDT,
          pickupPointId: pickup.pointId,
        },
      });

      return {
        success: true,
        message: 'Order created successfully. Your physical gold bar is allocated and ready for handover.',
        order,
      };
    } catch (err: any) {
      // Rollback stock reservation on failure
      await this.releaseProductStock(dto.productId, quantity);
      throw err;
    }
  }

  async upsertProduct(data: any, staffId: string) {
    const productId = data.productId || `PROD-${Date.now().toString().slice(-6)}`;
    const weightMilligrams = Math.round(data.weightGrams * CONVERSIONS.MILLIGRAMS_PER_GRAM);

    const updated = await this.productModel.findOneAndUpdate(
      { productId },
      {
        $set: {
          productId,
          titleEn: data.titleEn,
          titleBn: data.titleBn,
          slug: data.slug || productId.toLowerCase(),
          productType: data.productType || 'MINTED_BAR',
          purity: data.purity,
          weightGrams: data.weightGrams,
          weightMilligrams,
          makingFeePoisha: data.makingFeePoisha,
          inStockQuantity: data.inStockQuantity,
          images: data.images || [],
          certifier: data.certifier || 'BSTI Assay Certified',
          standard: data.standard || 'LBMA Good Delivery Standard',
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      },
      { upsert: true, new: true },
    );

    return updated;
  }
}
