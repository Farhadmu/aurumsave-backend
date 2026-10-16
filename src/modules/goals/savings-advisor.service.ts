import { Injectable, NotFoundException } from '@nestjs/common';
import { PriceService } from '../prices/price.service';
import { GoalService } from './goal.service';
import { PurityGrade, CONVERSIONS } from '@aurumsave/shared';
import { SavingsAdvisorSimulateDto } from './goal.dto';

export interface ScenarioProjection {
  scenarioName: 'conservative' | 'baseline' | 'dynamic';
  annualAppreciationPct: number;
  projectedGoldRatePerGramBdt: number;
  projectedAccumulatedGrams: number;
  totalCapitalInvestedBdt: number;
  projectedMaturityValueBdt: number;
  projectedNominalGainBdt: number;
}

export interface SimulationResult {
  targetGrams: number;
  targetBhori: number;
  targetMonths: number;
  currentBenchmarkRateBdt: number;
  monthlyRequiredBudgetBdt: number;
  monthlyDiscretionaryBudgetBdt?: number;
  feasibilityScore: number; // 0 - 100
  status: 'on_track' | 'achievable_with_adjustment' | 'underfunded';
  scenarios: {
    conservative: ScenarioProjection;
    baseline: ScenarioProjection;
    dynamic: ScenarioProjection;
  };
  recommendations: {
    suggestedMonthlyGrams: number;
    suggestedMonthlyBdt: number;
    recommendedPurity: PurityGrade;
    bilingualNotes: {
      en: string[];
      bn: string[];
    };
  };
  disclaimer: {
    en: string;
    bn: string;
  };
}

@Injectable()
export class SavingsAdvisorService {
  constructor(
    private readonly priceService: PriceService,
    private readonly goalService: GoalService,
  ) {}

  private async getCurrentBenchmarkRate(): Promise<number> {
    try {
      const rate = await this.priceService.getRateForPurity(PurityGrade.K24);
      return rate.buyPricePerGramBdt || 12450;
    } catch {
      return 12450;
    }
  }

  async simulate(dto: SavingsAdvisorSimulateDto): Promise<SimulationResult> {
    const currentRate = await this.getCurrentBenchmarkRate();
    const months = Math.max(1, dto.targetMonths);

    // Establish target grams
    let targetGrams = dto.targetGrams || 0;
    if (!targetGrams && dto.targetAmountBdt) {
      targetGrams = Number((dto.targetAmountBdt / currentRate).toFixed(4));
    }
    if (targetGrams <= 0) {
      targetGrams = CONVERSIONS.GRAMS_PER_BHORI; // Default to 1 Bhori (11.664g)
    }

    const targetBhori = Number((targetGrams / CONVERSIONS.GRAMS_PER_BHORI).toFixed(3));
    const targetTotalAtCurrentRate = Math.round(targetGrams * currentRate);
    const requiredMonthlyBdt = Math.round(targetTotalAtCurrentRate / months);

    const discretionary = dto.monthlyBudgetBdt;
    let feasibilityScore = 100;
    let status: SimulationResult['status'] = 'on_track';

    if (discretionary !== undefined) {
      if (discretionary < requiredMonthlyBdt) {
        feasibilityScore = Math.min(99, Math.max(10, Math.round((discretionary / requiredMonthlyBdt) * 100)));
        status = feasibilityScore >= 60 ? 'achievable_with_adjustment' : 'underfunded';
      }
    }

    // Build deterministic scenario projections
    // Scenarios: Conservative (+3%/yr), Baseline (+9%/yr), Dynamic (+15%/yr)
    const years = months / 12;
    const calculateScenario = (
      name: 'conservative' | 'baseline' | 'dynamic',
      annualPct: number,
    ): ScenarioProjection => {
      const endRate = Math.round(currentRate * Math.pow(1 + annualPct / 100, years));
      const monthlyContribution = discretionary || requiredMonthlyBdt;
      const totalInvested = monthlyContribution * months;
      // In physical micro-gold accumulation, the customer accumulates grams steadily
      const accumulatedGrams = discretionary
        ? Number(((monthlyContribution / currentRate) * months).toFixed(4))
        : targetGrams;
      const maturityVal = Math.round(accumulatedGrams * endRate);
      const gain = Math.max(0, maturityVal - totalInvested);

      return {
        scenarioName: name,
        annualAppreciationPct: annualPct,
        projectedGoldRatePerGramBdt: endRate,
        projectedAccumulatedGrams: accumulatedGrams,
        totalCapitalInvestedBdt: totalInvested,
        projectedMaturityValueBdt: maturityVal,
        projectedNominalGainBdt: gain,
      };
    };

    const scenarios = {
      conservative: calculateScenario('conservative', 3.0),
      baseline: calculateScenario('baseline', 9.0),
      dynamic: calculateScenario('dynamic', 15.0),
    };

    const suggestedMonthlyGrams = Number((targetGrams / months).toFixed(4));

    // Grounded bilingual advice bullets
    const enNotes: string[] = [
      `Targeting ${targetGrams.toFixed(2)}g (${targetBhori} Bhori) across ${months} months requires accumulating ~${suggestedMonthlyGrams}g (৳${requiredMonthlyBdt.toLocaleString()}) per month at active BAJUS spot rates.`,
      discretionary && discretionary < requiredMonthlyBdt
        ? `Current monthly allocation of ৳${discretionary.toLocaleString()} leaves a monthly shortfall of ৳${(requiredMonthlyBdt - discretionary).toLocaleString()}. Consider extending horizon by ${Math.ceil((targetTotalAtCurrentRate - discretionary * months) / discretionary)} months.`
        : `Your monthly contribution pace matches or exceeds the required rate lock threshold. Physical allocated vault storage remains 100% free with bank-grade Class-III insurance.`,
      `Under baseline historical inflation hedge (+9% annualized), your portfolio could reach an indicative valuation of ৳${scenarios.baseline.projectedMaturityValueBdt.toLocaleString()} at maturity.`,
    ];

    const bnNotes: string[] = [
      `আপনার ${targetGrams.toFixed(2)} গ্রাম (${targetBhori} ভরি) লক্ষ্যমাত্রা ${months} মাসে অর্জন করতে প্রতি মাসে প্রায় ${suggestedMonthlyGrams} গ্রাম (৳ ${requiredMonthlyBdt.toLocaleString()}) সঞ্চয় করা প্রয়োজন।`,
      discretionary && discretionary < requiredMonthlyBdt
        ? `বর্তমান বাজেট ৳ ${discretionary.toLocaleString()} অনুযায়ী প্রতি মাসে ৳ ${(requiredMonthlyBdt - discretionary).toLocaleString()} ঘাটতি থাকবে। লক্ষ্যমাত্রা অর্জনের সময়সীমা আরও ${Math.ceil((targetTotalAtCurrentRate - discretionary * months) / discretionary)} মাস বৃদ্ধি করা যেতে পারে।`
        : `আপনার নির্ধারিত মাসিক সঞ্চয় গতি লক্ষ্যমাত্রার সম্পূর্ণ অনুকূল। ব্যাংকের গ্রেড-৩ ভল্টে ক্লায়েন্টের নামে সংরক্ষিত সোনা সম্পূর্ণ নিরাপদ ও বিনামূল্যে হেফাজত থাকবে।`,
      `ঐতিহাসিক গড় মূল্যস্ফীতি প্রতিরোধ হিসেবে (বার্ষিক ৯% প্রবৃদ্ধি বিবেচনায়), লক্ষ্যমাত্রা পূরণের সময় আপনার স্বর্ণের আনুমানিক বাজারমূল্য ৳ ${scenarios.baseline.projectedMaturityValueBdt.toLocaleString()} হতে পারে।`,
    ];

    return {
      targetGrams,
      targetBhori,
      targetMonths: months,
      currentBenchmarkRateBdt: currentRate,
      monthlyRequiredBudgetBdt: requiredMonthlyBdt,
      monthlyDiscretionaryBudgetBdt: discretionary,
      feasibilityScore,
      status,
      scenarios,
      recommendations: {
        suggestedMonthlyGrams,
        suggestedMonthlyBdt: requiredMonthlyBdt,
        recommendedPurity: PurityGrade.K24,
        bilingualNotes: {
          en: enNotes,
          bn: bnNotes,
        },
      },
      disclaimer: {
        en: 'Projections are deterministic multi-scenario models based on physical gold weight accumulation. Gold prices fluctuate in accordance with BAJUS and global market dynamics. Not a financial guarantee or speculative promise.',
        bn: 'এই হিসাবটি খাঁটি স্বর্ণের ওজন জমার ওপর ভিত্তি করে তৈরি গাণিতিক সিমুলেশন। স্বর্ণের বাজারদর স্থানীয় বাজুস ও আন্তর্জাতিক বাজারের ওপর নির্ভরশীল এবং তা পরিবর্তনশীল। এটি কোনো নির্দিষ্ট আর্থিক প্রতিশ্রুতির নিশ্চয়তা দেয় না।',
      },
    };
  }

  async getGoalRecommendations(userId: string, goalId: string) {
    const goal = await this.goalService.getGoalById(userId, goalId);
    const currentRate = await this.getCurrentBenchmarkRate();

    const targetGrams = (goal.targetWeightMg || 0) / 1000;
    const currentGrams = (goal.currentWeightMg || 0) / 1000;
    const remainingGrams = Math.max(0, targetGrams - currentGrams);

    let monthsRemaining = 12;
    if (goal.targetDate) {
      const now = new Date();
      const target = new Date(goal.targetDate);
      monthsRemaining = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
    }

    const requiredMonthlyGrams = Number((remainingGrams / monthsRemaining).toFixed(4));
    const requiredMonthlyBdt = Math.round(requiredMonthlyGrams * currentRate);

    const progressPct = targetGrams > 0 ? Math.min(100, Math.round((currentGrams / targetGrams) * 100)) : 0;
    const isOnTrack = progressPct >= (100 / (monthsRemaining + 1));

    return {
      goalId: goal._id.toString(),
      title: goal.title,
      category: goal.category,
      targetGrams,
      currentGrams,
      remainingGrams,
      progressPct,
      monthsRemaining,
      requiredMonthlyGrams,
      requiredMonthlyBdt,
      isOnTrack,
      adviceEn: isOnTrack
        ? `You are on pace! Maintain a monthly allocation of ${requiredMonthlyGrams}g (৳${requiredMonthlyBdt.toLocaleString()}) to hit your target by ${goal.targetDate ? new Date(goal.targetDate).toLocaleDateString('en-GB') : 'your deadline'}.`
        : `Catch-up needed: Increase monthly micro-accumulation to ${requiredMonthlyGrams}g (৳${requiredMonthlyBdt.toLocaleString()}) to complete your physical gold goal on schedule.`,
      adviceBn: isOnTrack
        ? `আপনার সঞ্চয়ের গতি সন্তোষজনক! লক্ষ্যমাত্রা সময়মতো পূরণ করতে প্রতি মাসে ${requiredMonthlyGrams} গ্রাম (৳ ${requiredMonthlyBdt.toLocaleString()}) সঞ্চয় অব্যাহত রাখুন।`
        : `গতি বৃদ্ধির পরামর্শ: সময়মতো শারীরিক স্বর্ণের ডেলিভারি পেতে প্রতি মাসে সঞ্চয়ের পরিমাণ বৃদ্ধি করে ${requiredMonthlyGrams} গ্রাম (৳ ${requiredMonthlyBdt.toLocaleString()})-এ উন্নীত করুন।`,
    };
  }
}
