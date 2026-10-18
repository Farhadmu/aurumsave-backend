import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KycApplication, KycApplicationSchema } from '../../database/schemas/kyc-application.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { CustomerProfile, CustomerProfileSchema } from '../../database/schemas/customer-profile.schema';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KycApplication.name, schema: KycApplicationSchema },
      { name: User.name, schema: UserSchema },
      { name: CustomerProfile.name, schema: CustomerProfileSchema },
    ]),
  ],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
