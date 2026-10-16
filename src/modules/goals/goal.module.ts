import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SavingsGoal, SavingsGoalSchema } from '../../database/schemas/savings-goal.schema';
import { GoalService } from './goal.service';
import { SavingsAdvisorService } from './savings-advisor.service';
import { GoalController } from './goal.controller';
import { PriceModule } from '../prices/price.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SavingsGoal.name, schema: SavingsGoalSchema },
    ]),
    PriceModule,
    AuditModule,
  ],
  controllers: [GoalController],
  providers: [GoalService, SavingsAdvisorService],
  exports: [GoalService, SavingsAdvisorService],
})
export class GoalModule {}
