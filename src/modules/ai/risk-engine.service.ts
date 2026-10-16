import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from '../../database/schemas/order.schema';
import { Payment, PaymentDocument } from '../../database/schemas/payment.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { OrderStatus, PaymentStatus, KycStatus, OrderType } from '@aurumsave/shared';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskAction = 'ALLOW' | 'FLAG_FOR_MONITORING' | 'QUEUE_FOR_STAFF_REVIEW' | 'HALT_AND_FREEZE';

export interface RiskEvaluationResult {
  userId: string;
  orderId?: string;
  orderType: OrderType;
  amountBdt: number;
  weightGrams: number;
  riskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  action: RiskAction;
  signals: {
    code: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    scoreContribution: number;
  }[];
  explanation: {
    en: string;
    bn: string;
  };
  evaluatedAt: string;
}

@Injectable()
export class RiskEngineService {
  private readonly logger = new Logger(RiskEngineService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async evaluateTransactionRisk(params: {
    userId: string;
    orderType: OrderType;
    amountBdt: number;
    weightGrams: number;
    ipAddress?: string;
  }): Promise<RiskEvaluationResult> {
    const { userId, orderType, amountBdt, weightGrams } = params;
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId).lean();

    let score = 0;
    const signals: RiskEvaluationResult['signals'] = [];

    // Signal 1: Account Age & KYC Status vs Amount
    const userCreatedAt = (user as any)?.createdAt;
    const accountAgeHours = userCreatedAt
      ? (Date.now() - new Date(userCreatedAt).getTime()) / (1000 * 60 * 60)
      : 999;
    const isKycApproved = user?.kycStatus === KycStatus.APPROVED;

    if (!isKycApproved && amountBdt >= 50000) {
      score += 25;
      signals.push({
        code: 'UNVERIFIED_ELEVATED_VALUE',
        description: 'Transaction exceeds ৳50,000 on an account without completed BFIU KYC verification.',
        severity: 'MEDIUM',
        scoreContribution: 25,
      });
    }

    if (accountAgeHours < 24 && amountBdt >= 100000) {
      score += 35;
      signals.push({
        code: 'NEW_ACCOUNT_LARGE_TRANSACTION',
        description: 'Large transaction (>= ৳100,000) requested within 24 hours of account creation.',
        severity: 'HIGH',
        scoreContribution: 35,
      });
    }

    // Signal 2: Order Velocity in Past 1 Hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOrdersCount = await this.orderModel.countDocuments({
      userId: userObjectId,
      createdAt: { $gte: oneHourAgo },
    });

    if (recentOrdersCount >= 5) {
      score += 30;
      signals.push({
        code: 'HIGH_VELOCITY_BURST',
        description: `Customer submitted ${recentOrdersCount} orders within the last hour.`,
        severity: 'HIGH',
        scoreContribution: 30,
      });
    } else if (recentOrdersCount >= 3) {
      score += 15;
      signals.push({
        code: 'ELEVATED_VELOCITY',
        description: `Customer submitted ${recentOrdersCount} orders within the last hour.`,
        severity: 'MEDIUM',
        scoreContribution: 15,
      });
    }

    // Signal 3: Failed Payment Burst in Past 24 Hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failedPaymentsCount = await this.paymentModel.countDocuments({
      userId: userObjectId,
      status: PaymentStatus.FAILED,
      createdAt: { $gte: twentyFourHoursAgo },
    });

    if (failedPaymentsCount >= 3) {
      score += 25;
      signals.push({
        code: 'FAILED_PAYMENTS_BURST',
        description: `Customer experienced ${failedPaymentsCount} failed payment callbacks in the past 24 hours.`,
        severity: 'MEDIUM',
        scoreContribution: 25,
      });
    }

    // Signal 4: Size Deviation From Historical Average
    const pastCompletedOrders = await this.orderModel
      .find({
        userId: userObjectId,
        status: OrderStatus.COMPLETED,
        orderType,
      })
      .select('totalPoisha')
      .lean();

    if (pastCompletedOrders.length >= 3) {
      const avgBdt =
        pastCompletedOrders.reduce((acc, curr) => acc + curr.totalPoisha / 100, 0) /
        pastCompletedOrders.length;

      if (amountBdt > avgBdt * 4 && amountBdt >= 40000) {
        score += 20;
        signals.push({
          code: 'SIZE_DEVIATION',
          description: `Order amount (৳${amountBdt.toLocaleString()}) is more than 4x customer historical baseline (৳${Math.round(avgBdt).toLocaleString()}).`,
          severity: 'MEDIUM',
          scoreContribution: 20,
        });
      }
    }

    // Signal 5: Rapid Buy-to-Sell Liquidation Velocity
    if (orderType === OrderType.SELL) {
      const lastCompletedBuy = await this.orderModel
        .findOne({
          userId: userObjectId,
          orderType: OrderType.BUY,
          status: OrderStatus.COMPLETED,
        })
        .sort({ completedAt: -1 })
        .lean();

      if (lastCompletedBuy && lastCompletedBuy.completedAt) {
        const timeSinceBuyMinutes =
          (Date.now() - new Date(lastCompletedBuy.completedAt).getTime()) / (1000 * 60);
        if (timeSinceBuyMinutes < 30) {
          score += 25;
          signals.push({
            code: 'RAPID_LIQUIDATION_CYCLE',
            description: `Gold liquidation requested within ${Math.round(timeSinceBuyMinutes)} minutes of purchase completion.`,
            severity: 'MEDIUM',
            scoreContribution: 25,
          });
        }
      }
    }

    // Normalize final score to 0 - 100
    const finalScore = Math.min(100, score);

    // Determine Risk Level & Prescribed System Action
    let riskLevel: RiskLevel = 'LOW';
    let action: RiskAction = 'ALLOW';

    if (finalScore >= 80) {
      riskLevel = 'CRITICAL';
      action = 'HALT_AND_FREEZE';
    } else if (finalScore >= 60) {
      riskLevel = 'HIGH';
      action = 'QUEUE_FOR_STAFF_REVIEW';
    } else if (finalScore >= 30) {
      riskLevel = 'MEDIUM';
      action = 'FLAG_FOR_MONITORING';
    }

    const enExplanation =
      signals.length === 0
        ? 'Transaction profile matches normal retail savings behavior with zero suspicious velocity or anomaly signals.'
        : `Identified ${signals.length} risk telemetry signals with aggregate risk score ${finalScore}/100. Primary trigger: ${signals[0]?.code}.`;

    const bnExplanation =
      signals.length === 0
        ? 'স্বাভাবিক সঞ্চয় আচরণের সাথে সংগতিপূর্ণ। কোনো সন্দেহজনক গতিবিধি লক্ষ্য করা যায়নি।'
        : `স্বয়ংক্রিয় নজরদারিতে ${signals.length}টি ঝুঁকি সংকেত সনাক্ত হয়েছে (স্কোর: ${finalScore}/১০০)। প্রধান সংকেত: ${signals[0]?.code}।`;

    return {
      userId,
      orderType,
      amountBdt,
      weightGrams,
      riskScore: finalScore,
      riskLevel,
      action,
      signals,
      explanation: {
        en: enExplanation,
        bn: bnExplanation,
      },
      evaluatedAt: new Date().toISOString(),
    };
  }

  async getRecentFlaggedTransactions(limit = 20) {
    // Queries orders that were placed on hold or had review status notes
    const flaggedOrders = await this.orderModel
      .find({
        status: { $in: [OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_CONFIRMED] },
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return flaggedOrders;
  }
}
