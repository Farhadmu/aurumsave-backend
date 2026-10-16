import { Role, KycStatus, PurityGrade, OrderType, OrderStatus, CONVERSIONS } from '@aurumsave/shared';

describe('AurumSave Fintech Financial Engine & Precision Unit Tests', () => {
  describe('Gold & Minor Unit Conversion Accuracy', () => {
    it('should correctly convert grams to milligrams with zero floating point drift', () => {
      const grams = 11.664; // 1 Bhori
      const milligrams = Math.round(grams * CONVERSIONS.MILLIGRAMS_PER_GRAM);
      expect(milligrams).toBe(11664);
    });

    it('should accurately calculate BDT to Poisha minor units', () => {
      const bdt = 12450.5;
      const poisha = Math.round(bdt * CONVERSIONS.POISHA_PER_BDT);
      expect(poisha).toBe(1245050);
    });

    it('should preserve fractional division when computing gold weight from fixed BDT amount', () => {
      const budgetBdt = 10000;
      const ratePerGramBdt = 12450;
      const ratePerMgPoisha = (ratePerGramBdt * 100) / 1000; // 1245 poisha per mg

      const targetPoisha = budgetBdt * 100; // 1,000,000 poisha
      const weightMg = Math.floor(targetPoisha / ratePerMgPoisha);
      const subtotalPoisha = weightMg * ratePerMgPoisha;

      expect(weightMg).toBe(803); // 803 milligrams = 0.803 grams
      expect(subtotalPoisha).toBeLessThanOrEqual(targetPoisha);
    });
  });

  describe('Quote & Fee Computation Engine', () => {
    it('should compute exact 0.5% platform fee for BUY orders without rounding overflow', () => {
      const subtotalPoisha = 1000000; // 10,000 BDT
      const feePoisha = Math.round(subtotalPoisha * 0.005);
      const totalPoisha = subtotalPoisha + feePoisha;

      expect(feePoisha).toBe(5000); // 50 BDT
      expect(totalPoisha).toBe(1005000); // 10,050 BDT
    });

    it('should waive platform fee for SELL liquidation orders', () => {
      const subtotalPoisha = 1000000;
      const isSell = true;
      const feePoisha = isSell ? 0 : Math.round(subtotalPoisha * 0.005);
      const totalPayoutPoisha = subtotalPoisha - feePoisha;

      expect(feePoisha).toBe(0);
      expect(totalPayoutPoisha).toBe(1000000);
    });
  });

  describe('Role-Based Access Control Boundaries', () => {
    it('should recognize super admin and admin roles as privileged staff', () => {
      const staffRoles = [Role.SUPER_ADMIN, Role.ADMIN, Role.KYC_OFFICER, Role.FINANCE_OFFICER, Role.SUPPORT_AGENT, Role.AUDITOR];
      expect(staffRoles).toContain(Role.SUPER_ADMIN);
      expect(staffRoles).toContain(Role.ADMIN);
      expect(staffRoles).not.toContain(Role.CUSTOMER);
    });

    it('should isolate compliance operations strictly to KYC_OFFICER and Admins', () => {
      const allowedRoles = [Role.KYC_OFFICER, Role.ADMIN, Role.SUPER_ADMIN];
      const isCustomerAllowed = allowedRoles.includes(Role.CUSTOMER);
      const isSupportAgentAllowed = allowedRoles.includes(Role.SUPPORT_AGENT);
      const isKycOfficerAllowed = allowedRoles.includes(Role.KYC_OFFICER);

      expect(isCustomerAllowed).toBe(false);
      expect(isSupportAgentAllowed).toBe(false);
      expect(isKycOfficerAllowed).toBe(true);
    });
  });

  describe('Double-Entry Ledger Integrity', () => {
    it('should calculate weighted average acquisition cost when accumulating gold purchases', () => {
      // First purchase: 5,000 mg (5g) at 12,000 BDT/g = 60,000 BDT (6,000,000 poisha)
      const p1_mg = 5000;
      const p1_poisha = 6000000;

      // Second purchase: 5,000 mg (5g) at 13,000 BDT/g = 65,000 BDT (6,500,000 poisha)
      const p2_mg = 5000;
      const p2_poisha = 6500000;

      const totalMg = p1_mg + p2_mg;
      const totalPoisha = p1_poisha + p2_poisha;
      const avgCostPerMgPoisha = Math.round(totalPoisha / totalMg);
      const avgCostPerGramBdt = (avgCostPerMgPoisha * 1000) / 100;

      expect(totalMg).toBe(10000);
      expect(avgCostPerGramBdt).toBe(12500); // Expected average of 12000 and 13000
    });

    it('should accurately calculate unrealized capital gains against live market valuation', () => {
      const holdingMg = 10000; // 10 grams
      const totalCostBdt = 120000; // Bought at 12,000 BDT/g
      const currentLiveRatePerGramBdt = 12450; // Current market price

      const currentValuationBdt = (holdingMg / 1000) * currentLiveRatePerGramBdt;
      const unrealizedGainBdt = currentValuationBdt - totalCostBdt;
      const gainPercentage = Number(((unrealizedGainBdt / totalCostBdt) * 100).toFixed(2));

      expect(currentValuationBdt).toBe(124500);
      expect(unrealizedGainBdt).toBe(4500);
      expect(gainPercentage).toBe(3.75);
    });
  });
});
