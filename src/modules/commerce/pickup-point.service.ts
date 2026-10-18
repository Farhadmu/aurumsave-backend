import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PickupPointStatus,
  CommerceOrderType,
  FulfillmentStatus,
  MarketplaceListingStatus,
  AuditAction,
  Role,
} from '@aurumsave/shared';
import {
  PickupPoint,
  PickupPointDocument,
} from '../../database/schemas/pickup-point.schema';
import {
  CommerceOrder,
  CommerceOrderDocument,
} from '../../database/schemas/commerce-order.schema';
import {
  MarketplaceListing,
  MarketplaceListingDocument,
} from '../../database/schemas/marketplace-listing.schema';
import { AuditService } from '../audit/audit.service';

export interface VerifyHandoverDto {
  orderId: string;
  otp: string;
  pickupPointId: string;
  handoverNotes?: string;
}

@Injectable()
export class PickupPointService implements OnModuleInit {
  private readonly logger = new Logger(PickupPointService.name);

  constructor(
    @InjectModel(PickupPoint.name)
    private readonly pickupModel: Model<PickupPointDocument>,
    @InjectModel(CommerceOrder.name)
    private readonly orderModel: Model<CommerceOrderDocument>,
    @InjectModel(MarketplaceListing.name)
    private readonly listingModel: Model<MarketplaceListingDocument>,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit() {
    await this.seedInitialPickupPoints();
  }

  async seedInitialPickupPoints() {
    try {
      const count = await this.pickupModel.countDocuments();
      if (count === 0) {
        this.logger.log('Seeding official AurumSave district & divisional vault hubs across Bangladesh...');
        await this.pickupModel.create([
          {
            pointId: 'PKP-DHK-GULSHAN',
            nameEn: 'AurumSave Central Vault & Assay Lab — Gulshan',
            nameBn: 'অরামসেভ কেন্দ্রীয় ভল্ট ও অ্যাসে ল্যাব — গুলশান',
            division: 'Dhaka',
            district: 'Dhaka',
            addressEn: 'Level 4, Aurum Tower, Road 11, Gulshan-2, Dhaka-1212',
            addressBn: 'লেভেল ৪, অরাম টাওয়ার, রোড ১১, গুলশান-২, ঢাকা-১২১২',
            contactPerson: 'Zubair Rahman (Senior Vault Officer)',
            phone: '+880 1711 002233',
            operatingHours: 'Sun - Thu: 9:30 AM - 6:30 PM, Sat: 10:00 AM - 4:00 PM',
            supportedServices: ['OFFICIAL_STORE_PICKUP', 'MARKETPLACE_HANDOVER', 'JEWELLERY_ASSAY'],
            dailyCapacity: 50,
            currentScheduledToday: 0,
            status: PickupPointStatus.ACTIVE,
            securityFeatures: [
              'BSTI & Thermo Niton XRF Spectrometer Laboratory',
              'Class-3 Armored Bullion Vault',
              'Live Armed Security & Dual-Custody Handover Verification',
            ],
          },
          {
            pointId: 'PKP-DHK-MOTIJHEEL',
            nameEn: 'AurumSave Financial District Vault Desk — Motijheel',
            nameBn: 'অরামসেভ ফাইন্যান্সিয়াল ডিস্ট্রিক্ট ভল্ট ডেস্ক — মতিঝিল',
            division: 'Dhaka',
            district: 'Dhaka',
            addressEn: 'Suite 802, City Centre, 90/1 Motijheel C/A, Dhaka-1000',
            addressBn: 'সুইট ৮০২, সিটি সেন্টার, ৯০/১ মতিঝিল বা/এ, ঢাকা-১০০০',
            contactPerson: 'Farhan Hossain (Branch Operations Lead)',
            phone: '+880 1711 445566',
            operatingHours: 'Sun - Thu: 10:00 AM - 5:30 PM',
            supportedServices: ['OFFICIAL_STORE_PICKUP', 'MARKETPLACE_HANDOVER'],
            dailyCapacity: 35,
            currentScheduledToday: 0,
            status: PickupPointStatus.ACTIVE,
            securityFeatures: [
              'Monitored Depository',
              'CCTV Surveillance Network',
              'OTP Secured Handover Safe',
            ],
          },
          {
            pointId: 'PKP-CTG-AGRABAD',
            nameEn: 'AurumSave Port City Depository & Assay Hub — Chattogram',
            nameBn: 'অরামসেভ পোর্ট সিটি ডিপোজিটরি ও অ্যাসে হাব — চট্টগ্রাম',
            division: 'Chattogram',
            district: 'Chattogram',
            addressEn: 'World Trade Center Annex, Ground Floor, Agrabad C/A, Chattogram-4100',
            addressBn: 'ওয়ার্ল্ড ট্রেড সেন্টার এনেক্স, গ্রাউন্ড ফ্লোর, আগ্রাবাদ বা/এ, চট্টগ্রাম-৪১০০',
            contactPerson: 'Kawsar Mahmud (Regional Depository Manager)',
            phone: '+880 1819 889900',
            operatingHours: 'Sun - Thu: 10:00 AM - 6:00 PM',
            supportedServices: ['OFFICIAL_STORE_PICKUP', 'MARKETPLACE_HANDOVER', 'JEWELLERY_ASSAY'],
            dailyCapacity: 30,
            currentScheduledToday: 0,
            status: PickupPointStatus.ACTIVE,
            securityFeatures: [
              'Thermo Fisher Scientific Gold Assay System',
              'Reinforced Vaulting Units',
              'Continuous Armored Patrol',
            ],
          },
          {
            pointId: 'PKP-SYL-ZINDABAZAR',
            nameEn: 'AurumSave Sylhet Regional Depository — Zindabazar',
            nameBn: 'অরামসেভ সিলেট রিজিওনাল ডিপোজিটরি — জিন্দাবাজার',
            division: 'Sylhet',
            district: 'Sylhet',
            addressEn: 'Al-Hamra Shopping City Tower, 3rd Floor, Zindabazar, Sylhet-3100',
            addressBn: 'আল-হামরা শপিং সিটি টাওয়ার, ৩য় তলা, জিন্দাবাজার, সিলেট-৩১০০',
            contactPerson: 'Tamim Ahmed (Branch Custody Lead)',
            phone: '+880 1720 112244',
            operatingHours: 'Sun - Thu: 10:00 AM - 5:00 PM',
            supportedServices: ['OFFICIAL_STORE_PICKUP', 'MARKETPLACE_HANDOVER', 'JEWELLERY_ASSAY'],
            dailyCapacity: 25,
            currentScheduledToday: 0,
            status: PickupPointStatus.ACTIVE,
            securityFeatures: [
              'High-Precision Digital Density & XRF Assay Bench',
              'Multi-Factor Safe Access',
              'Armed Security Guard on Premises',
            ],
          },
          {
            pointId: 'PKP-RAJ-SHAHEB',
            nameEn: 'AurumSave Northern Division Hub — Rajshahi',
            nameBn: 'অরামসেভ উত্তরাঞ্চলীয় বিভাগীয় হাব — রাজশাহী',
            division: 'Rajshahi',
            district: 'Rajshahi',
            addressEn: 'Hold-45, Shaheb Bazar Zero Point, Rajshahi-6000',
            addressBn: 'হোল্ডিং-৪৫, সাহেব বাজার জিরো পয়েন্ট, রাজশাহী-৬০০০',
            contactPerson: 'Shahadat Karim (Desk Custodian)',
            phone: '+880 1715 556677',
            operatingHours: 'Sun - Thu: 10:00 AM - 5:00 PM',
            supportedServices: ['OFFICIAL_STORE_PICKUP', 'MARKETPLACE_HANDOVER'],
            dailyCapacity: 20,
            currentScheduledToday: 0,
            status: PickupPointStatus.ACTIVE,
            securityFeatures: ['Biometric Handover Verification Safe', 'Armed Security Guard'],
          },
          {
            pointId: 'PKP-KHU-KDA',
            nameEn: 'AurumSave South-Western Division Desk — Khulna',
            nameBn: 'অরামসেভ দক্ষিণ-পশ্চিমাঞ্চলীয় বিভাগীয় ডেস্ক — খুলনা',
            division: 'Khulna',
            district: 'Khulna',
            addressEn: 'Shadhinota Bhaban, KDA Avenue, Khulna-9100',
            addressBn: 'স্বাধীনতা ভবন, কেডিএ এভিনিউ, খুলনা-৯১০০',
            contactPerson: 'Morshed Alam (Security & Vault Officer)',
            phone: '+880 1912 334455',
            operatingHours: 'Sun - Thu: 10:00 AM - 5:00 PM',
            supportedServices: ['OFFICIAL_STORE_PICKUP', 'MARKETPLACE_HANDOVER'],
            dailyCapacity: 20,
            currentScheduledToday: 0,
            status: PickupPointStatus.ACTIVE,
            securityFeatures: ['Dual-Key Depository', 'CCTV 24/7 Monitoring'],
          },
        ]);
        this.logger.log('Initial verified pickup hubs seeded successfully.');
      }
    } catch (err: any) {
      this.logger.warn(`Pickup points seed skipped: ${err.message}`);
    }
  }

  async getAll(filters?: { division?: string; district?: string; status?: PickupPointStatus }) {
    const query: any = {};
    if (filters?.division) query.division = filters.division;
    if (filters?.district) query.district = filters.district;
    if (filters?.status) query.status = filters.status;
    else query.status = PickupPointStatus.ACTIVE;

    return this.pickupModel.find(query).sort({ division: 1, nameEn: 1 }).lean();
  }

  async getById(pointId: string) {
    const point = await this.pickupModel.findOne({ pointId }).lean();
    if (!point) throw new NotFoundException('Pickup desk location not found');
    return point;
  }

  async upsertPickupPoint(data: any) {
    const pointId = data.pointId || `PKP-${Date.now().toString().slice(-6)}`;
    const updated = await this.pickupModel.findOneAndUpdate(
      { pointId },
      {
        $set: {
          pointId,
          nameEn: data.nameEn,
          nameBn: data.nameBn,
          division: data.division,
          district: data.district,
          addressEn: data.addressEn,
          addressBn: data.addressBn,
          contactPerson: data.contactPerson,
          phone: data.phone,
          operatingHours: data.operatingHours,
          supportedServices: data.supportedServices || [
            'OFFICIAL_STORE_PICKUP',
            'MARKETPLACE_HANDOVER',
          ],
          dailyCapacity: data.dailyCapacity || 25,
          status: data.status || PickupPointStatus.ACTIVE,
          securityFeatures: data.securityFeatures || ['Biometric Custody', 'CCTV'],
        },
      },
      { upsert: true, new: true },
    );
    return updated;
  }

  // Dual verification: verify customer OTP, update order fulfillment, and release escrow
  async verifyAndConfirmHandover(staffId: string, dto: VerifyHandoverDto) {
    const order = await this.orderModel.findOne({ orderId: dto.orderId });
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);

    if (order.fulfillmentStatus === FulfillmentStatus.HANDOVER_COMPLETED) {
      throw new BadRequestException('Order has already been handed over and confirmed');
    }

    if (order.pickupVerificationOtp !== dto.otp.trim()) {
      throw new BadRequestException('Invalid pickup verification OTP. Please verify customer phone/app screen.');
    }

    if (dto.pickupPointId && order.pickupPointId !== dto.pickupPointId) {
      throw new BadRequestException(
        `Order is registered for pickup point "${order.pickupPointId}", not "${dto.pickupPointId}"`,
      );
    }

    order.fulfillmentStatus = FulfillmentStatus.HANDOVER_COMPLETED;
    order.paymentStatus = 'SETTLED_TO_SELLER';
    order.handoverConfirmedByStaffId = new Types.ObjectId(staffId);
    order.handoverConfirmedAt = new Date();
    order.handoverNotes = dto.handoverNotes || 'Handover verified and gold released at desk';

    await order.save();

    // If Marketplace C2C, mark listing as SOLD
    if (order.commerceType === CommerceOrderType.MARKETPLACE) {
      const listingItem = order.items.find((i) => i.listingId);
      if (listingItem?.listingId) {
        await this.listingModel.updateOne(
          { listingId: listingItem.listingId },
          {
            $set: {
              status: MarketplaceListingStatus.SOLD,
              soldAt: new Date(),
            },
          },
        );
      }
    }

    await this.auditService.log({
      actorId: staffId,
      actorRole: Role.ADMIN,
      action: AuditAction.COMMERCE_HANDOVER_CONFIRMED,
      entityType: 'CommerceOrder',
      entityId: order.orderId,
      details: {
        commerceType: order.commerceType,
        pickupPointId: order.pickupPointId,
        buyerId: order.buyerId.toString(),
        sellerId: order.sellerId?.toString(),
        notes: dto.handoverNotes,
      },
    });

    return {
      success: true,
      message: 'Physical gold handover confirmed. Escrow settlement recorded.',
      order,
    };
  }
}
