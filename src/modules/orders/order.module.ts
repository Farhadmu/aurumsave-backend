import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../../database/schemas/order.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { QuoteModule } from '../quotes/quote.module';
import { LedgerModule } from '../ledger/ledger.module';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: User.name, schema: UserSchema },
    ]),
    QuoteModule,
    LedgerModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
