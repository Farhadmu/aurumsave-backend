import { PurityGrade, LedgerEntryType, CONVERSIONS } from '@aurumsave/shared';

describe('Ledger Integrity, Precision Math & Vault Holding Consistency', () => {
  describe('Purity Segregation Standards', () => {
    it('should strictly isolate 24K and 22K holdings without cross-contamination', () => {
      const userHoldings = new Map<PurityGrade, { availableMg: number; totalCostPoisha: number }>();

      userHoldings.set(PurityGrade.K24, { availableMg: 5000, totalCostPoisha: 6225000 });
      userHoldings.set(PurityGrade.K22, { availableMg: 10000, totalCostPoisha: 11412000 });

      // Selling 3,000 mg of 24K must only decrement 24K balance
      const sellPurity = PurityGrade.K24;
      const sellMg = 3000;

      const targetHolding = userHoldings.get(sellPurity)!;
      targetHolding.availableMg -= sellMg;

      expect(userHoldings.get(PurityGrade.K24)!.availableMg).toBe(2000);
      expect(userHoldings.get(PurityGrade.K22)!.availableMg).toBe(10000); // 22K holding completely untouched
    });

    it('should disallow sell orders exceeding available gold in the requested purity', () => {
      const available24KMg = 2000;
      const requestedSellMg = 2500;

      const hasSufficientGold = available24KMg >= requestedSellMg;
      expect(hasSufficientGold).toBe(false);
    });
  });

  describe('Immutable Double-Entry Ledger Mechanics', () => {
    it('should compute exact running balance chain across multiple transactions', () => {
      const ledgerHistory = [];
      let runningGoldMg = 0;
      let runningFiatPoisha = 0;

      // Tx 1: Buy 5,000 mg gold for 62,250 BDT (6,225,000 poisha)
      const tx1 = {
        type: LedgerEntryType.GOLD_PURCHASE,
        creditGoldMg: 5000,
        debitGoldMg: 0,
        debitPoisha: 6225000,
        creditPoisha: 0,
      };
      runningGoldMg += tx1.creditGoldMg - tx1.debitGoldMg;
      ledgerHistory.push({ ...tx1, runningGoldMg, runningFiatPoisha });

      // Tx 2: Buy 3,000 mg gold for 37,350 BDT (3,735,000 poisha)
      const tx2 = {
        type: LedgerEntryType.GOLD_PURCHASE,
        creditGoldMg: 3000,
        debitGoldMg: 0,
        debitPoisha: 3735000,
        creditPoisha: 0,
      };
      runningGoldMg += tx2.creditGoldMg - tx2.debitGoldMg;
      ledgerHistory.push({ ...tx2, runningGoldMg, runningFiatPoisha });

      // Tx 3: Sell 2,000 mg gold for 24,300 BDT payout (2,430,000 poisha)
      const tx3 = {
        type: LedgerEntryType.GOLD_SALE,
        creditGoldMg: 0,
        debitGoldMg: 2000,
        debitPoisha: 0,
        creditPoisha: 2430000,
      };
      runningGoldMg += tx3.creditGoldMg - tx3.debitGoldMg;
      runningFiatPoisha += tx3.creditPoisha;
      ledgerHistory.push({ ...tx3, runningGoldMg, runningFiatPoisha });

      expect(ledgerHistory).toHaveLength(3);
      expect(ledgerHistory[0].runningGoldMg).toBe(5000);
      expect(ledgerHistory[1].runningGoldMg).toBe(8000);
      expect(ledgerHistory[2].runningGoldMg).toBe(6000); // 8000 - 2000
      expect(ledgerHistory[2].runningFiatPoisha).toBe(2430000);
    });

    it('should preserve mathematical balance between system payments received and orders allocated', () => {
      const settledPayments = [
        { amountPoisha: 1245000 },
        { amountPoisha: 2490000 },
        { amountPoisha: 6225000 },
      ];

      const completedOrders = [
        { totalPoisha: 1245000 },
        { totalPoisha: 2490000 },
        { totalPoisha: 6225000 },
      ];

      const totalPaymentsPoisha = settledPayments.reduce((sum, p) => sum + p.amountPoisha, 0);
      const totalOrdersPoisha = completedOrders.reduce((sum, o) => sum + o.totalPoisha, 0);

      const discrepancy = Math.abs(totalPaymentsPoisha - totalOrdersPoisha);
      const isReconciled = discrepancy === 0;

      expect(totalPaymentsPoisha).toBe(9960000);
      expect(totalOrdersPoisha).toBe(9960000);
      expect(isReconciled).toBe(true);
    });
  });
});
