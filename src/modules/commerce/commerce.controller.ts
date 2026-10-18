import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Permission, Role, MarketplaceCategory, PurityGrade } from '@aurumsave/shared';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { OfficialStoreService } from './official-store.service';
import {
  MarketplaceService,
  CreateListingDto,
  ReviewListingDto,
  CreateScrapSellDto,
  AppraiseScrapDto,
} from './marketplace.service';
import { PickupPointService, VerifyHandoverDto } from './pickup-point.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommerceOrder, CommerceOrderDocument } from '../../database/schemas/commerce-order.schema';

@ApiTags('Commerce')
@Controller('commerce')
export class CommerceController {
  constructor(
    private readonly storeService: OfficialStoreService,
    private readonly marketplaceService: MarketplaceService,
    private readonly pickupPointService: PickupPointService,
    @InjectModel(CommerceOrder.name)
    private readonly orderModel: Model<CommerceOrderDocument>,
  ) {}

  // ==========================================
  // A. OFFICIAL AURUMSAVE GOLD STORE
  // ==========================================

  @Get('store/products')
  @ApiOperation({ summary: 'Get all active minted gold bullion products with live calculated prices' })
  async getStoreProducts(): Promise<{ success: boolean; data: any[] }> {
    const products = await this.storeService.getProducts();
    return { success: true, data: products };
  }

  @Get('store/products/:slug')
  @ApiOperation({ summary: 'Get single official gold product by slug' })
  async getStoreProductBySlug(@Param('slug') slug: string): Promise<{ success: boolean; data: any }> {
    const product = await this.storeService.getProductBySlug(slug);
    return { success: true, data: product };
  }

  @Post('store/orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place order for official minted gold bullion bar with pickup desk reservation' })
  async createStoreOrder(
    @CurrentUser('id') buyerId: string,
    @Body() dto: { productId: string; quantity: number; pickupPointId: string },
  ) {
    const result = await this.storeService.createStoreOrder(buyerId, dto);
    return { success: true, ...result };
  }

  @Post('store/products')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Permission.COMMERCE_STORE_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin/Staff upsert official product in company vault catalog' })
  async upsertProduct(@CurrentUser('id') staffId: string, @Body() body: any) {
    const updated = await this.storeService.upsertProduct(body, staffId);
    return { success: true, data: updated };
  }

  // ==========================================
  // B. CUSTOMER-TO-CUSTOMER (C2C) MARKETPLACE
  // ==========================================

  @Get('marketplace/listings')
  @ApiOperation({ summary: 'Get verified active customer marketplace listings' })
  async getMarketplaceListings(
    @Query('category') category?: MarketplaceCategory,
    @Query('purity') purity?: PurityGrade,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
  ) {
    const filters: any = {};
    if (category) filters.category = category;
    if (purity) filters.purity = purity;
    if (minPrice) filters.minPricePoisha = Number(minPrice);
    if (maxPrice) filters.maxPricePoisha = Number(maxPrice);

    const listings = await this.marketplaceService.getActiveListings(filters);
    return { success: true, data: listings };
  }

  @Get('marketplace/listings/:listingId')
  @ApiOperation({ summary: 'Get single marketplace listing by ID' })
  async getListingById(@Param('listingId') listingId: string) {
    const listing = await this.marketplaceService.getListingById(listingId);
    return { success: true, data: listing };
  }

  @Post('marketplace/listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer submits a gold or jewellery listing for staff review' })
  async createListing(
    @CurrentUser() user: any,
    @Body() dto: CreateListingDto,
  ) {
    const userName = user.name || user.email || 'AurumSave Seller';
    const result = await this.marketplaceService.createListing(user.id, userName, dto);
    return { success: true, ...result };
  }

  @Get('marketplace/my-listings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get listings submitted by current logged-in customer' })
  async getMyListings(@CurrentUser('id') userId: string) {
    const listings = await this.marketplaceService.getMyListings(userId);
    return { success: true, data: listings };
  }

  @Delete('marketplace/listings/:listingId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel/delist a marketplace listing' })
  async cancelListing(
    @CurrentUser('id') userId: string,
    @Param('listingId') listingId: string,
  ) {
    const result = await this.marketplaceService.cancelListing(userId, listingId);
    return { success: true, ...result };
  }

  @Post('marketplace/orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase a C2C listing with Escrow hold and pickup desk reservation' })
  async purchaseWithEscrow(
    @CurrentUser('id') buyerId: string,
    @Body() dto: { listingId: string; pickupPointId: string },
  ) {
    const result = await this.marketplaceService.purchaseWithEscrow(buyerId, dto);
    return { success: true, ...result };
  }

  @Get('marketplace/review-queue')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Permission.COMMERCE_MARKETPLACE_REVIEW)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff queue of customer listings pending assay/inspection review' })
  async getReviewQueue() {
    const queue = await this.marketplaceService.getReviewQueue();
    return { success: true, data: queue };
  }

  @Post('marketplace/listings/:listingId/review')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Permission.COMMERCE_MARKETPLACE_REVIEW)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff approves or rejects a customer marketplace listing' })
  async reviewListing(
    @CurrentUser('id') staffId: string,
    @Param('listingId') listingId: string,
    @Body() dto: ReviewListingDto,
  ) {
    const result = await this.marketplaceService.reviewListing(staffId, listingId, dto);
    return { success: true, ...result };
  }

  // ==========================================
  // C. SCRAP JEWELLERY DIRECT SELL / LIQUIDATION
  // ==========================================

  @Post('marketplace/scrap-sell')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer submits scrap jewellery for on-site assay & liquidation' })
  async createScrapSell(
    @CurrentUser() user: any,
    @Body() dto: CreateScrapSellDto,
  ) {
    const userName = user.name || user.email || 'AurumSave Customer';
    const userPhone = user.phone || '';
    const result = await this.marketplaceService.createScrapSellRequest(
      user.id,
      userName,
      userPhone,
      dto,
    );
    return { success: true, ...result };
  }

  @Get('marketplace/scrap-sell/my-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer views their scrap jewellery liquidation requests' })
  async getMyScrapRequests(@CurrentUser('id') userId: string) {
    const requests = await this.marketplaceService.getMyScrapSellRequests(userId);
    return { success: true, data: requests };
  }

  @Get('marketplace/scrap-sell/queue')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Permission.COMMERCE_MARKETPLACE_REVIEW)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff queue for physical scrap jewellery assay & appraisals' })
  async getScrapQueue() {
    const queue = await this.marketplaceService.getScrapSellQueue();
    return { success: true, data: queue };
  }

  @Post('marketplace/scrap-sell/:requestId/appraise')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Permission.COMMERCE_MARKETPLACE_REVIEW)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff completes on-site XRF assay and makes formal purchase offer' })
  async appraiseScrap(
    @CurrentUser('id') staffId: string,
    @Param('requestId') requestId: string,
    @Body() dto: AppraiseScrapDto,
  ) {
    const result = await this.marketplaceService.appraiseScrapRequest(staffId, requestId, dto);
    return { success: true, ...result };
  }

  @Post('marketplace/scrap-sell/:requestId/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Customer accepts or rejects the formal appraisal offer' })
  async respondToScrapOffer(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
    @Body() body: { action: 'ACCEPT' | 'REJECT' },
  ) {
    const result = await this.marketplaceService.respondToScrapOffer(userId, requestId, body.action);
    return { success: true, ...result };
  }

  // ==========================================
  // D. DISTRICT PICKUP POINTS & HANDOVER
  // ==========================================

  @Get('pickup-points')
  @ApiOperation({ summary: 'Get list of active physical pickup desks across Bangladesh divisions' })
  async getPickupPoints(
    @Query('division') division?: string,
    @Query('district') district?: string,
  ) {
    const points = await this.pickupPointService.getAll({ division, district });
    return { success: true, data: points };
  }

  @Get('pickup-points/:pointId')
  @ApiOperation({ summary: 'Get pickup desk details by ID' })
  async getPickupPointById(@Param('pointId') pointId: string) {
    const point = await this.pickupPointService.getById(pointId);
    return { success: true, data: point };
  }

  @Post('pickup-points')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Permission.COMMERCE_PICKUP_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff creates or updates a district pickup point' })
  async upsertPickupPoint(@Body() body: any) {
    const point = await this.pickupPointService.upsertPickupPoint(body);
    return { success: true, data: point };
  }

  @Post('pickup-points/verify-handover')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Permission.COMMERCE_HANDOVER_CONFIRM)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff verifies customer OTP and confirms physical gold handover' })
  async verifyHandover(
    @CurrentUser('id') staffId: string,
    @Body() dto: VerifyHandoverDto,
  ) {
    const result = await this.pickupPointService.verifyAndConfirmHandover(staffId, dto);
    return { success: true, ...result };
  }

  // ==========================================
  // E. COMMERCE ORDERS & STATUS
  // ==========================================

  @Get('orders/my-orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user commerce orders (store purchases, marketplace buys/sells)' })
  async getMyCommerceOrders(@CurrentUser('id') userId: string) {
    const orders = await this.orderModel
      .find({
        $or: [
          { buyerId: new Types.ObjectId(userId) },
          { sellerId: new Types.ObjectId(userId) },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    return { success: true, data: orders };
  }

  @Get('orders/all')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @RequirePermissions(Permission.COMMERCE_HANDOVER_CONFIRM)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Staff list all commerce orders' })
  async getAllCommerceOrders() {
    const orders = await this.orderModel.find().sort({ createdAt: -1 }).limit(100).lean();
    return { success: true, data: orders };
  }

  @Get('orders/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get commerce order details' })
  async getCommerceOrder(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Param('orderId') orderId: string,
  ) {
    const order = await this.orderModel.findOne({ orderId }).lean();
    if (!order) return { success: false, message: 'Order not found' };

    // Customers can only view their own orders; staff can view any
    const isCustomerOwner =
      order.buyerId.toString() === userId || (order.sellerId && order.sellerId.toString() === userId);
    const isStaff = [
      Role.ADMIN,
      Role.SUPER_ADMIN,
      Role.FINANCE_OFFICER,
      Role.AUDITOR,
    ].includes(role);

    if (!isCustomerOwner && !isStaff) {
      return { success: false, message: 'Access denied' };
    }

    return { success: true, data: order };
  }
}
