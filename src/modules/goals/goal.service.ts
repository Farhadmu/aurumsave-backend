import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SavingsGoal, SavingsGoalDocument, GoalStatus } from '../../database/schemas/savings-goal.schema';
import { PriceService } from '../prices/price.service';
import { PurityGrade, AuditAction, Role } from '@aurumsave/shared';
import { AuditService } from '../audit/audit.service';
import { CreateGoalDto, UpdateGoalDto, ContributeGoalDto, CalculatePlanDto } from './goal.dto';

@Injectable()
export class GoalService {
  constructor(
    @InjectModel(SavingsGoal.name) private readonly goalModel: Model<SavingsGoalDocument>,
    private readonly priceService: PriceService,
    private readonly auditService: AuditService,
  ) {}

  async getGoals(userId: string): Promise<any[]> {
    const goals = await this.goalModel
      .find({ userId: new Types.ObjectId(userId), status: { $ne: GoalStatus.ARCHIVED } })
      .sort({ createdAt: -1 })
      .lean();

    // Fetch benchmark price for valuation calculations
    let currentSellRatePerGram = 11500;
    try {
      const benchmark = await this.priceService.getRateForPurity(PurityGrade.K24);
      currentSellRatePerGram = benchmark.buyPricePerGramBdt; // Replacement value
    } catch {
      // Fallback to standard indicative rate if feed is calibrating
    }

    return goals.map((goal) => {
      const targetWeightGrams = (goal.targetWeightMg || 0) / 1000;
      const currentWeightGrams = (goal.currentWeightMg || 0) / 1000;
      const indicativeCurrentValuationBdt = Math.round(currentWeightGrams * currentSellRatePerGram);

      let progressPct = 0;
      if (goal.targetWeightMg && goal.targetWeightMg > 0) {
        progressPct = Math.min(100, Math.round((goal.currentWeightMg / goal.targetWeightMg) * 100));
      } else if (goal.targetAmountBdt && goal.targetAmountBdt > 0) {
        progressPct = Math.min(100, Math.round((goal.currentAmountBdt / goal.targetAmountBdt) * 100));
      }

      const remainingWeightGrams = Math.max(0, targetWeightGrams - currentWeightGrams);
      const remainingAmountBdt = goal.targetAmountBdt
        ? Math.max(0, goal.targetAmountBdt - goal.currentAmountBdt)
        : Math.round(remainingWeightGrams * currentSellRatePerGram);

      return {
        ...goal,
        targetWeightGrams,
        currentWeightGrams,
        remainingWeightGrams,
        indicativeCurrentValuationBdt,
        remainingAmountBdt,
        progressPct,
      };
    });
  }

  async createGoal(userId: string, dto: CreateGoalDto): Promise<SavingsGoalDocument> {
    if (!dto.targetWeightMg && !dto.targetAmountBdt) {
      throw new BadRequestException('Either target weight or target amount must be provided for the savings goal');
    }

    // Auto-calculate suggested monthly savings if targetDate is provided
    let suggestedMonthly = 0;
    if (dto.targetDate) {
      const now = new Date();
      const target = new Date(dto.targetDate);
      const diffMonths = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));

      if (dto.targetAmountBdt) {
        suggestedMonthly = Math.round(dto.targetAmountBdt / diffMonths);
      } else if (dto.targetWeightMg) {
        let ratePerGram = 11500;
        try {
          const rate = await this.priceService.getRateForPurity(PurityGrade.K24);
          ratePerGram = rate.buyPricePerGramBdt;
        } catch {}
        const totalEstBdt = (dto.targetWeightMg / 1000) * ratePerGram;
        suggestedMonthly = Math.round(totalEstBdt / diffMonths);
      }
    }

    const goal = new this.goalModel({
      userId: new Types.ObjectId(userId),
      title: dto.title,
      category: dto.category,
      targetWeightMg: dto.targetWeightMg,
      targetAmountBdt: dto.targetAmountBdt,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      suggestedMonthlyContributionBdt: suggestedMonthly > 0 ? suggestedMonthly : undefined,
      frequency: dto.frequency || 'monthly',
      notes: dto.notes,
      currentWeightMg: 0,
      currentAmountBdt: 0,
      status: GoalStatus.ACTIVE,
      contributions: [],
    });

    const saved = await goal.save();

    await this.auditService.log({
      actorId: userId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.SECURITY_EVENT,
      entityType: 'SavingsGoal',
      entityId: saved._id.toString(),
      details: { title: dto.title, category: dto.category, targetWeightMg: dto.targetWeightMg },
    });

    return saved;
  }

  async getGoalById(userId: string, goalId: string) {
    const goal = await this.goalModel.findById(goalId);
    if (!goal || goal.status === GoalStatus.ARCHIVED) {
      throw new NotFoundException('Savings goal not found');
    }
    if (goal.userId.toString() !== userId) {
      throw new ForbiddenException('Access denied to this savings goal');
    }
    return goal;
  }

  async updateGoal(userId: string, goalId: string, dto: UpdateGoalDto) {
    const goal = await this.getGoalById(userId, goalId);

    if (dto.title) goal.title = dto.title;
    if (dto.category) goal.category = dto.category;
    if (dto.targetWeightMg !== undefined) goal.targetWeightMg = dto.targetWeightMg;
    if (dto.targetAmountBdt !== undefined) goal.targetAmountBdt = dto.targetAmountBdt;
    if (dto.targetDate) goal.targetDate = new Date(dto.targetDate);
    if (dto.status) goal.status = dto.status;
    if (dto.frequency) goal.frequency = dto.frequency;
    if (dto.notes !== undefined) goal.notes = dto.notes;

    // Check if goal reached completion
    if (
      (goal.targetWeightMg && goal.currentWeightMg >= goal.targetWeightMg) ||
      (goal.targetAmountBdt && goal.currentAmountBdt >= goal.targetAmountBdt)
    ) {
      goal.status = GoalStatus.COMPLETED;
    }

    return goal.save();
  }

  async deleteGoal(userId: string, goalId: string) {
    const goal = await this.getGoalById(userId, goalId);
    goal.status = GoalStatus.ARCHIVED;
    await goal.save();
    return { success: true, message: 'Savings goal archived successfully' };
  }

  async contributeToGoal(userId: string, goalId: string, dto: ContributeGoalDto) {
    const goal = await this.getGoalById(userId, goalId);

    goal.currentWeightMg += dto.weightMg;
    goal.currentAmountBdt += dto.amountBdt;

    goal.contributions.push({
      orderId: dto.orderId ? new Types.ObjectId(dto.orderId) : undefined,
      weightMg: dto.weightMg,
      amountBdt: dto.amountBdt,
      date: new Date(),
      note: dto.note || 'Manual allocation towards goal',
    });

    if (
      (goal.targetWeightMg && goal.currentWeightMg >= goal.targetWeightMg) ||
      (goal.targetAmountBdt && goal.currentAmountBdt >= goal.targetAmountBdt)
    ) {
      goal.status = GoalStatus.COMPLETED;
    }

    await goal.save();
    return goal;
  }

  async calculateSavingsPlan(dto: CalculatePlanDto) {
    let ratePerGram = 11500;
    try {
      const benchmark = await this.priceService.getRateForPurity(PurityGrade.K24);
      ratePerGram = benchmark.buyPricePerGramBdt;
    } catch {}

    const months = Math.max(1, dto.targetMonths);
    let targetBdt = dto.targetAmountBdt || 0;
    let targetGrams = (dto.targetWeightMg || 0) / 1000;

    if (!targetBdt && targetGrams > 0) {
      targetBdt = Math.round(targetGrams * ratePerGram);
    } else if (!targetGrams && targetBdt > 0) {
      targetGrams = Number((targetBdt / ratePerGram).toFixed(3));
    }

    const monthlyBdt = Math.round(targetBdt / months);
    const weeklyBdt = Math.round(targetBdt / (months * 4.33));
    const dailyBdt = Math.round(targetBdt / (months * 30));

    const monthlyGrams = Number((targetGrams / months).toFixed(3));

    return {
      targetMonths: months,
      targetAmountBdt: targetBdt,
      targetWeightGrams: targetGrams,
      indicativeGoldRatePerGram: ratePerGram,
      schedules: {
        monthly: { amountBdt: monthlyBdt, goldWeightGrams: monthlyGrams },
        weekly: { amountBdt: weeklyBdt, goldWeightGrams: Number((targetGrams / (months * 4.33)).toFixed(3)) },
        daily: { amountBdt: dailyBdt, goldWeightGrams: Number((targetGrams / (months * 30)).toFixed(3)) },
      },
      disclaimer: 'Calculated estimates based on current verified benchmark rates. Gold market benchmark rates fluctuate with international and local market dynamics.',
    };
  }
}
