import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PriceModule } from '../prices/price.module';
import { AuditModule } from '../audit/audit.module';

import { OfficialProduct, OfficialProductSchema } from '../../database/schemas/official-product.schema';
import { MarketplaceListing, MarketplaceListingSchema } from '../../database/schemas/marketplace-listing.schema';
import { PickupPoint, PickupPointSchema } from '../../database/schemas/pickup-point.schema';
import { CommerceOrder, CommerceOrderSchema } from '../../database/schemas/commerce-order.schema';
import { JewellerySellRequest, JewellerySellRequestSchema } from '../../database/schemas/jewellery-sell-request.schema';

import { OfficialStoreService } from './official-store.service';
import { MarketplaceService } from './marketplace.service';
import { PickupPointService } from './pickup-point.service';
import { CommerceController } from './commerce.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OfficialProduct.name, schema: OfficialProductSchema },
      { name: MarketplaceListing.name, schema: MarketplaceListingSchema },
      { name: PickupPoint.name, schema: PickupPointSchema },
      { name: CommerceOrder.name, schema: CommerceOrderSchema },
      { name: JewellerySellRequest.name, schema: JewellerySellRequestSchema },
    ]),
    PriceModule,
    AuditModule,
  ],
  controllers: [CommerceController],
  providers: [OfficialStoreService, MarketplaceService, PickupPointService],
  exports: [OfficialStoreService, MarketplaceService, PickupPointService],
})
export class CommerceModule {}
