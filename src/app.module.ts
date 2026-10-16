import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { PriceModule } from './modules/prices/price.module';
import { QuoteModule } from './modules/quotes/quote.module';
import { OrderModule } from './modules/orders/order.module';
import { PaymentModule } from './modules/payments/payment.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { KycModule } from './modules/kyc/kyc.module';
import { SupportModule } from './modules/support/support.module';
import { StaffModule } from './modules/staff/staff.module';
import { AiModule } from './modules/ai/ai.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120, // 120 requests per minute
      },
    ]),
    DatabaseModule,
    AuditModule,
    AuthModule,
    PriceModule,
    QuoteModule,
    OrderModule,
    PaymentModule,
    LedgerModule,
    PortfolioModule,
    KycModule,
    SupportModule,
    StaffModule,
    AiModule,
    HealthModule,
  ],
})
export class AppModule {}
