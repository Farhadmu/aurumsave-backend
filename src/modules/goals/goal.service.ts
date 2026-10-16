import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { SavingsGoal, SavingsGoalDocument, GoalStatus } from '../../database/schemas/savings-goal.schema';
import { SavingsPlan, SavingsPlanDocument, PlanFrequency, PlanStatus } from '../../database/schemas/savings-plan.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { GoldHolding, GoldHoldingDocument } from '../../database/schemas/gold-holding.schema';
import { PriceService } from '../prices/price.service';
import { PurityGrade, AuditAction, Role } from '@aurumsave/shared';
import { AuditService } from '../audit/audit.service';
import {
  CreateGoalDto,
  UpdateGoalDto,
  ContributeGoalDto,
  CalculatePlanDto,
  CreateSavingsPlanDto,
  CreateFamilyGoalDto,
  InviteFamilyMemberDto,
  ContributeFamilyGoalDto,
} from './goal.dto';

@Injectable()
export class GoalService {
  constructor(
    @InjectModel(SavingsGoal.name) private readonly goalModel: Model<SavingsGoalDocument>,
    @InjectModel(SavingsPlan.name) private readonly planModel: Model<SavingsPlanDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(GoldHolding.name) private readonly holdingModel: Model<GoldHoldingDocument>,
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

  async getSavingsPlans(userId: string): Promise<any[]> {
    return this.planModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
  }

  async createSavingsPlan(userId: string, dto: CreateSavingsPlanDto): Promise<any> {
    const planId = `SIP-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
    const nextDebitDate = new Date();
    if (dto.frequency === 'daily') {
      nextDebitDate.setDate(nextDebitDate.getDate() + 1);
    } else if (dto.frequency === 'weekly') {
      nextDebitDate.setDate(nextDebitDate.getDate() + 7);
    } else {
      nextDebitDate.setMonth(nextDebitDate.getMonth() + 1);
    }

    const plan = await this.planModel.create({
      planId,
      userId: new Types.ObjectId(userId),
      title: dto.title.trim(),
      frequency: (dto.frequency as PlanFrequency) || PlanFrequency.MONTHLY,
      amountPoisha: Math.round(dto.amountBdt * 100),
      purity: dto.purity ? (dto.purity as PurityGrade) : PurityGrade.K24,
      status: PlanStatus.ACTIVE,
      paymentMethod: dto.paymentMethod,
      accumulatedGoldMg: 0,
      totalContributionsCount: 0,
      nextDebitDate,
      hasConsentMandate: true,
      notes: dto.notes,
    });

    await this.auditService.log({
      actorId: userId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.ORDER_CREATED,
      entityType: 'SavingsPlan',
      entityId: planId,
      details: { title: dto.title, amountBdt: dto.amountBdt, frequency: dto.frequency },
    });

    return plan;
  }

  async toggleSavingsPlan(userId: string, planId: string, status: PlanStatus): Promise<any> {
    const plan = await this.planModel.findOneAndUpdate(
      { planId, userId: new Types.ObjectId(userId) },
      { status },
      { new: true },
    );
    if (!plan) {
      throw new NotFoundException(`Savings plan ${planId} not found`);
    }
    return plan;
  }

  async cancelSavingsPlan(userId: string, planId: string): Promise<any> {
    const plan = await this.planModel.findOneAndUpdate(
      { planId, userId: new Types.ObjectId(userId) },
      { status: PlanStatus.CANCELLED, cancelledAt: new Date() },
      { new: true },
    );
    if (!plan) {
      throw new NotFoundException(`Savings plan ${planId} not found`);
    }
    return plan;
  }

  async createFamilyGoal(userId: string, dto: CreateFamilyGoalDto): Promise<any> {
    const creator = await this.userModel.findById(userId);
    if (!creator) throw new NotFoundException('User not found');

    const goal = await this.goalModel.create({
      userId: new Types.ObjectId(userId),
      title: dto.title.trim(),
      category: dto.category,
      targetWeightMg: dto.targetWeightMg,
      targetAmountBdt: dto.targetAmountBdt,
      currentWeightMg: 0,
      currentAmountBdt: 0,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      frequency: 'monthly',
      status: GoalStatus.ACTIVE,
      isFamilyGoal: true,
      familyMembers: [
        {
          userId: new Types.ObjectId(userId),
          name: creator.fullName,
          phone: creator.phone,
          role: 'ADMIN',
          joinedAt: new Date(),
          totalContributedMg: 0,
        },
      ],
      notes: dto.notes,
      contributions: [],
    });

    await this.auditService.log({
      actorId: userId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.ORDER_CREATED,
      entityType: 'FamilyGoal',
      entityId: goal._id.toString(),
      details: { title: dto.title, targetWeightMg: dto.targetWeightMg },
    });

    return goal;
  }

  async getFamilyGoals(userId: string): Promise<any[]> {
    const userObjId = new Types.ObjectId(userId);
    const goals = await this.goalModel
      .find({
        isFamilyGoal: true,
        $or: [{ userId: userObjId }, { 'familyMembers.userId': userObjId }],
        status: { $ne: GoalStatus.ARCHIVED },
      })
      .sort({ createdAt: -1 })
      .lean();

    return goals.map((g) => ({
      ...g,
      isCreator: g.userId.toString() === userId,
      callerMembership: g.familyMembers?.find((m: any) => m.userId.toString() === userId) || {
        role: g.userId.toString() === userId ? 'ADMIN' : 'CONTRIBUTOR',
      },
    }));
  }

  async inviteFamilyMember(userId: string, goalId: string, dto: InviteFamilyMemberDto): Promise<any> {
    const goal = await this.goalModel.findById(goalId);
    if (!goal || !goal.isFamilyGoal) {
      throw new NotFoundException('Family savings goal not found');
    }

    const isCreator = goal.userId.toString() === userId;
    const memberRecord = goal.familyMembers?.find((m) => m.userId.toString() === userId);
    const isAdmin = isCreator || memberRecord?.role === 'ADMIN';

    if (!isAdmin) {
      throw new ForbiddenException('Only the Family Goal Admin can invite members');
    }

    const query = dto.identifier.trim();
    const isEmail = query.includes('@');
    const invitedUser = await this.userModel.findOne(
      isEmail ? { email: query.toLowerCase() } : { phone: query },
    );

    if (!invitedUser) {
      throw new NotFoundException('No registered AurumSave user found with this phone number or email');
    }

    const alreadyMember = goal.familyMembers?.some(
      (m) => m.userId.toString() === invitedUser._id.toString(),
    );
    if (alreadyMember) {
      throw new ConflictException('This user is already a member of this family goal');
    }

    goal.familyMembers.push({
      userId: invitedUser._id,
      name: invitedUser.fullName,
      phone: invitedUser.phone,
      role: dto.role || 'CONTRIBUTOR',
      joinedAt: new Date(),
      totalContributedMg: 0,
    });

    await goal.save();

    await this.auditService.log({
      actorId: userId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.PROFILE_UPDATED,
      entityType: 'FamilyGoal',
      entityId: goal._id.toString(),
      details: { invitedUserId: invitedUser._id.toString(), invitedName: invitedUser.fullName },
    });

    return {
      success: true,
      message: `${invitedUser.fullName} has been added to the family vault!`,
      goal,
    };
  }

  async contributeToFamilyGoal(userId: string, goalId: string, dto: ContributeFamilyGoalDto): Promise<any> {
    const goal = await this.goalModel.findById(goalId);
    if (!goal || !goal.isFamilyGoal) {
      throw new NotFoundException('Family savings goal not found');
    }

    const isCreator = goal.userId.toString() === userId;
    const isMember = goal.familyMembers?.some((m) => m.userId.toString() === userId);
    if (!isCreator && !isMember) {
      throw new ForbiddenException('You are not a member of this family goal');
    }

    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const weightMg = dto.weightMg || 0;
    const amountBdt = dto.amountBdt || 0;

    if (weightMg <= 0 && amountBdt <= 0) {
      throw new BadRequestException('Must provide either a gold weight (mg) or BDT amount to contribute');
    }

    if (weightMg > 0) {
      const holding = await this.holdingModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          purity: PurityGrade.K24,
          weightMilligramsAvailable: { $gte: weightMg },
        },
        {
          $inc: { weightMilligramsAvailable: -weightMg },
        },
        { new: true },
      );

      if (!holding) {
        throw new BadRequestException('Insufficient available 24K gold in your vault for this contribution');
      }
    }

    goal.currentWeightMg += weightMg;
    goal.currentAmountBdt += amountBdt;

    const member = goal.familyMembers?.find((m) => m.userId.toString() === userId);
    if (member) {
      member.totalContributedMg += weightMg;
    }

    goal.contributions.push({
      contributorUserId: user._id,
      contributorName: user.fullName,
      weightMg,
      amountBdt,
      date: new Date(),
      note: dto.note || 'Family collective savings contribution',
    });

    if (goal.targetWeightMg && goal.currentWeightMg >= goal.targetWeightMg) {
      goal.status = GoalStatus.COMPLETED;
    }

    await goal.save();

    await this.auditService.log({
      actorId: userId,
      actorRole: Role.CUSTOMER,
      action: AuditAction.ORDER_SETTLED,
      entityType: 'FamilyGoal',
      entityId: goal._id.toString(),
      details: { contributor: user.fullName, weightMg, amountBdt },
    });

    return {
      success: true,
      message: `Contributed successfully to ${goal.title}!`,
      goal,
    };
  }
}

