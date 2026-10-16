import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from '../../database/schemas/payment.schema';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

import { BkashVerifier } from './providers/bkash.verifier';
import { NagadVerifier } from './providers/nagad.verifier';
import { SslCommerzVerifier } from './providers/sslcommerz.verifier';
import { PaymentVerificationService } from './providers/payment-verification.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    LedgerModule,
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    BkashVerifier,
    NagadVerifier,
    SslCommerzVerifier,
    PaymentVerificationService,
  ],
  exports: [PaymentService, PaymentVerificationService],
})
export class PaymentModule {}
