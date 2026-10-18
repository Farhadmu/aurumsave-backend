import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
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
      const initialProducts = [
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
          inStockQuantity: 50,
          reservedQuantity: 0,
          images: ['/images/hero/bullion-macro.jpg'],
          certifier: 'BSTI & PAMP Assay Certified',
          standard: 'LBMA Good Delivery Standard',
          packagingType: 'Tamper-Evident Security Assay Blister Pack',
          descriptionEn: '99.99% pure 24K fine investment gold bar sealed in bank-grade CertiPAMP assay card with security hologram.',
          descriptionBn: '৯৯.৯৯% খাঁটি ২৪ ক্যারেট ফাইন গোল্ড বার, সিকিউরিটি হলোগ্রাম ও সার্টিপ্যাম্প অ্যাসে প্যাক দ্বারা সুরক্ষিত।',
          isActive: true,
        },
        {
          productId: 'PROD-BAR-2G-24K',
          titleEn: 'AurumSave Sovereign 2g 24K Minted Gold Bar',
          titleBn: 'অরামসেভ ২ গ্রাম ২৪ ক্যারেট মিন্টেড গোল্ড বার',
          slug: '2g-24k-minted-gold-bar',
          productType: 'MINTED_BAR',
          purity: PurityGrade.K24,
          weightGrams: 2.0,
          weightMilligrams: 2000,
          makingFeePoisha: 65000, // ৳650 making fee
          inStockQuantity: 40,
          reservedQuantity: 0,
          images: ['/images/hero/bullion-macro.jpg'],
          certifier: 'BSTI & Emirates Gold Assayed',
          standard: 'LBMA Good Delivery Standard',
          packagingType: 'Tamper-Evident Security Assay Blister Pack',
          descriptionEn: 'Serialized 2g 24K gold bar with individual certificate number and anti-counterfeiting QR code.',
          descriptionBn: 'সিরিয়ালাইজড ২ গ্রাম ২৪ ক্যারেট গোল্ড বার, পৃথক সার্টিফিকেট নম্বর ও কিউআর কোড সহ।',
          isActive: true,
        },
        {
          productId: 'PROD-BAR-2.5G-24K',
          titleEn: 'AurumSave Sovereign 2.5g 24K Minted Gold Bar',
          titleBn: 'অরামসেভ ২.৫ গ্রাম ২৪ ক্যারেট মিন্টেড গোল্ড বার',
          slug: '2-5g-24k-minted-gold-bar',
          productType: 'MINTED_BAR',
          purity: PurityGrade.K24,
          weightGrams: 2.5,
          weightMilligrams: 2500,
          makingFeePoisha: 80000, // ৳800 making fee
          inStockQuantity: 30,
          reservedQuantity: 0,
          images: ['/images/hero/texture-cinematic.jpg'],
          certifier: 'BSTI & Valcambi Assay Certified',
          standard: 'LBMA Good Delivery Standard',
          packagingType: 'Tamper-Evident Security Assay Blister Pack',
          descriptionEn: 'Precision minted 2.5g 24K investment gold bullion, ideal for disciplined monthly physical savers.',
          descriptionBn: 'নিখুঁত মিন্টেড ২.৫ গ্রাম ২৪ ক্যারেট বিনিয়োগ গোল্ড বার, নিয়মিত স্বর্ণ সঞ্চয়কারীদের জন্য আদর্শ।',
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
          inStockQuantity: 25,
          reservedQuantity: 0,
          images: ['/images/hero/vault-cinematic.jpg'],
          certifier: 'BSTI & PAMP Assay Certified',
          standard: 'LBMA Good Delivery Standard',
          packagingType: 'Tamper-Evident Security Assay Blister Pack',
          descriptionEn: '999.9 fine gold investment bar crafted to international LBMA bullion specifications with tamper-proof blister.',
          descriptionBn: 'আন্তর্জাতিক এলবিএমএ মানসম্পন্ন ৯৯৯.৯ খাঁটি স্বর্ণ বার, ব্যাংকিং গ্রেড নিরাপত্তায় মোড়কজাত।',
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
          inStockQuantity: 20,
          reservedQuantity: 0,
          images: ['/images/hero/texture-cinematic.jpg'],
          certifier: 'BSTI & Valcambi Assay Certified',
          standard: 'LBMA Good Delivery Standard',
          packagingType: 'Tamper-Evident Security Assay Blister Pack',
          descriptionEn: 'Substantial 10g 24K gold bullion bar. Maximum liquidity and accepted nationwide by certified jewellers.',
          descriptionBn: '১০ গ্রাম ২৪ ক্যারেট খাঁটি গোল্ড বার। সর্বোচ্চ নির্ভরযোগ্যতা ও দেশব্যাপী জুয়েলার্সদের দ্বারা স্বীকৃত।',
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
          inStockQuantity: 15,
          reservedQuantity: 0,
          images: ['/images/hero/bullion-macro.jpg'],
          certifier: 'BSTI Hallmark 916 Assayed',
          standard: 'Bangladesh Jewellery Standard',
          packagingType: 'Heritage Velvet Gift Box & Seal',
          descriptionEn: 'Traditional 1 Bhori (11.664g) 22K (916) hallmarked gold bullion bar. Perfect for heritage family reserves.',
          descriptionBn: 'ঐতিহ্যবাহী ১ ভরি (১১.৬৬৪ গ্রাম) ২২ ক্যারেট (৯১৬) হলমার্কযুক্ত খাঁটি স্বর্ণ বার। পারিবারিক সঞ্চয়ের বিশ্বস্ত প্রতীক।',
          isActive: true,
        },
      ];

      for (const prod of initialProducts) {
        await this.productModel.findOneAndUpdate(
          { productId: prod.productId },
          { $setOnInsert: prod },
          { upsert: true, new: true },
        );
      }
      this.logger.log('Official gold store products (1g to 10g + 1 Bhori) synced successfully.');
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
      deliveryMethod?: 'HOME_DELIVERY' | 'PICKUP_POINT';
      pickupPointId?: string;
      shippingAddress?: {
        fullName: string;
        phone: string;
        alternativePhone?: string;
        recipientNid?: string;
        division: string;
        district: string;
        upazila?: string;
        addressLine: string;
        postalCode?: string;
        instructions?: string;
      };
      paymentMethod?: string;
      paymentReference?: string;
    },
  ) {
    if (!buyerId || !Types.ObjectId.isValid(buyerId)) {
      throw new UnauthorizedException('Authentication required: Valid customer account required to purchase gold bullion');
    }

    if (!dto.productId || typeof dto.productId !== 'string') {
      throw new BadRequestException('Valid gold bullion productId is required');
    }

    const quantity = Math.max(1, Math.min(50, Number(dto.quantity) || 1));
    const deliveryMethod = dto.deliveryMethod || (dto.shippingAddress ? 'HOME_DELIVERY' : 'PICKUP_POINT');

    // Idempotency guard: prevent duplicate orders on rapid double-clicks or retries
    if (dto.paymentReference) {
      const existing = await this.orderModel.findOne({
        paymentReference: dto.paymentReference,
        buyerId: new Types.ObjectId(buyerId),
      });
      if (existing) {
        this.logger.warn(`Idempotent order replay detected for payment reference: ${dto.paymentReference}`);
        return {
          success: true,
          message: 'Order already confirmed.',
          order: existing,
        };
      }
    }

    let pickup: any = null;
    if (deliveryMethod === 'PICKUP_POINT') {
      const pointId = dto.pickupPointId || 'PKP-DHK-GULSHAN';
      pickup = await this.pickupModel.findOne({ pointId, status: 'ACTIVE' });
      if (!pickup) {
        throw new BadRequestException('Selected district pickup point is invalid or currently inactive');
      }
    } else {
      if (!dto.shippingAddress || !dto.shippingAddress.fullName || !dto.shippingAddress.phone || !dto.shippingAddress.addressLine) {
        throw new BadRequestException('Full recipient name, phone, and delivery address are mandatory for home delivery');
      }
    }

    // Atomically reserve stock
    await this.reserveProductStock(dto.productId, quantity);

    try {
      const product = await this.productModel.findOne({ productId: dto.productId });
      if (!product) throw new NotFoundException('Gold product not found in company catalog');

      const rate = await this.priceService.getRateForPurity(product.purity);
      const goldValuePoisha = Math.round(rate.buyPricePerGramPoisha * product.weightGrams);
      const unitTotalPoisha = goldValuePoisha + product.makingFeePoisha;
      const subtotalPoisha = unitTotalPoisha * quantity;
      
      // Armored Courier delivery fee: ৳250 (25000 poisha) for Home Delivery, ৳0 for Pickup Point
      const deliveryFeePoisha = deliveryMethod === 'HOME_DELIVERY' ? 25000 : 0;
      const totalPoisha = subtotalPoisha + deliveryFeePoisha;

      const orderId = `AS-GOLD-${Math.floor(100000 + Math.random() * 900000)}`;
      const trackingNumber = `TRK-${Date.now().toString().slice(-6)}-${uuidv4().substring(0, 4).toUpperCase()}`;
      // Generate 6-digit handover verification OTP
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
        platformFeePoisha: deliveryFeePoisha,
        assayFeePoisha: 0,
        totalPoisha,
        paymentStatus: 'ESCROW_HELD',
        paymentMethod: dto.paymentMethod || 'BKASH',
        paymentReference: dto.paymentReference || `PAY-${Date.now()}`,
        fulfillmentStatus:
          deliveryMethod === 'HOME_DELIVERY'
            ? FulfillmentStatus.PENDING_INSPECTION
            : FulfillmentStatus.READY_FOR_PICKUP,
        deliveryMethod,
        shippingAddress: dto.shippingAddress,
        trackingNumber,
        pickupPointId: pickup ? pickup.pointId : 'HOME_DELIVERY',
        pickupVerificationOtp,
      });

      try {
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
            pickupPointId: pickup ? pickup.pointId : 'HOME_DELIVERY',
            deliveryMethod,
            trackingNumber,
          },
        });
      } catch (auditErr: any) {
        this.logger.warn(`Non-blocking audit log warning: ${auditErr?.message}`);
      }

      return {
        success: true,
        message: 'Order created successfully. Your physical gold bar is allocated and ready for handover.',
        order,
      };
    } catch (err: any) {
      // Rollback stock reservation on failure
      await this.releaseProductStock(dto.productId, quantity).catch(() => {});
      this.logger.error(`Store order placement failed: ${err.message}`, err.stack);
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ConflictException ||
        err instanceof UnauthorizedException
      ) {
        throw err;
      }
      throw new BadRequestException(
        err.message || 'Unable to complete gold bullion order. Please check inputs and retry.',
      );
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
          images: data.images && data.images.length > 0 ? data.images : ['/images/hero/bullion-macro.jpg'],
          certifier: data.certifier || 'BSTI & PAMP Assay Certified',
          standard: data.standard || 'LBMA Good Delivery Standard',
          packagingType: data.packagingType || 'Tamper-Evident Security Assay Blister Pack',
          descriptionEn: data.descriptionEn || '',
          descriptionBn: data.descriptionBn || '',
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
      },
      { upsert: true, new: true },
    );

    return updated;
  }

  async deleteProduct(productId: string) {
    const deleted = await this.productModel.findOneAndDelete({ productId });
    if (!deleted) throw new NotFoundException('Gold product not found');
    return { success: true, message: `Product ${productId} deleted successfully` };
  }
}
