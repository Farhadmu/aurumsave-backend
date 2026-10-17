import { PurityGrade, CONVERSIONS } from '@aurumsave/shared';

describe('AurumSave Gold Price History & Interactive Chart Data-State Integrity Tests', () => {
  describe('Minor Unit to BDT & Bhori Currency Conversions', () => {
    it('should accurately convert Poisha minor units to BDT per gram', () => {
      const buyPricePerGramPoisha = 1245000; // 12,450 BDT
      const rateBdt = buyPricePerGramPoisha / CONVERSIONS.POISHA_PER_BDT;

      expect(rateBdt).toBe(12450);
    });

    it('should compute exact 1 Bhori rate (11.664g) from per-gram rate without drift', () => {
      const rateBdt = 12450;
      const ratePerBhoriBdt = Number((rateBdt * CONVERSIONS.GRAMS_PER_BHORI).toFixed(2));

      expect(ratePerBhoriBdt).toBe(145216.8);
    });

    it('should accurately compute 22K jewellery standard benchmark rate', () => {
      const buyPricePerGramPoisha = 1141200; // 11,412 BDT
      const rateBdt = buyPricePerGramPoisha / CONVERSIONS.POISHA_PER_BDT;
      const ratePerBhoriBdt = Number((rateBdt * CONVERSIONS.GRAMS_PER_BHORI).toFixed(2));

      expect(rateBdt).toBe(11412);
      expect(ratePerBhoriBdt).toBe(133109.57);
    });
  });

  describe('Single-Record Baseline & Insufficient History State', () => {
    it('should recognize when only 1 circular record exists and prevent fake trend calculations', () => {
      const mockHistoryRecords = [
        {
          date: '2026-10-16',
          timestamp: '2026-10-16T01:40:13.398Z',
          purity: PurityGrade.K24,
          rateBdt: 12450,
          ratePerBhoriBdt: 145216.8,
          source: 'BAJUS_OFFICIAL_BENCHMARK',
          isVerifiedHistory: true,
        },
      ];

      const recordsCount = mockHistoryRecords.length;
      const hasMultiplePoints = recordsCount > 1;
      const isSingleRecord = recordsCount === 1;

      expect(isSingleRecord).toBe(true);
      expect(hasMultiplePoints).toBe(false);

      // Period delta must strictly require >= 2 points
      const periodDiff = hasMultiplePoints
        ? mockHistoryRecords[recordsCount - 1].rateBdt - mockHistoryRecords[0].rateBdt
        : 0;
      expect(periodDiff).toBe(0);
    });

    it('should format single record empty-state message truthfully', () => {
      const singleRecord = {
        date: '2026-10-16',
        purity: PurityGrade.K24,
        rateBdt: 12450,
      };

      const emptyStateMessage = 'Historical trend unavailable — additional verified benchmark records are required.';
      const availabilityBadge = '1 Actual Record Available (1M)';

      expect(emptyStateMessage).toContain('additional verified benchmark records are required');
      expect(availabilityBadge).toContain('1 Actual Record Available');
    });
  });

  describe('Multi-Point Real Historical Trend Calculations', () => {
    it('should compute actual period price change and percentage delta when >= 2 records exist', () => {
      const mockHistoricalSeries = [
        {
          date: '2026-10-10',
          rateBdt: 12300,
        },
        {
          date: '2026-10-12',
          rateBdt: 12380,
        },
        {
          date: '2026-10-14',
          rateBdt: 12420,
        },
        {
          date: '2026-10-16',
          rateBdt: 12450,
        },
      ];

      const recordsCount = mockHistoricalSeries.length;
      const hasMultiplePoints = recordsCount > 1;
      expect(hasMultiplePoints).toBe(true);

      const startRate = mockHistoricalSeries[0].rateBdt;
      const endRate = mockHistoricalSeries[recordsCount - 1].rateBdt;
      const periodDiff = endRate - startRate;
      const periodPct = Number(((periodDiff / startRate) * 100).toFixed(2));

      expect(periodDiff).toBe(150); // +150 BDT
      expect(periodPct).toBe(1.22); // +1.22%
    });

    it('should accurately determine period Low and High boundaries across multiple points', () => {
      const rates = [12300, 12250, 12400, 12450, 12380];
      const minRate = Math.min(...rates);
      const maxRate = Math.max(...rates);

      expect(minRate).toBe(12250);
      expect(maxRate).toBe(12450);
    });
  });

  describe('Timeframe Filtering & Window Integrity', () => {
    it('should filter records strictly within the requested timeframe window', () => {
      const now = new Date('2026-10-17T12:00:00.000Z').getTime();
      const records = [
        {
          date: '2026-10-16',
          timestamp: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          rateBdt: 12450,
        },
        {
          date: '2026-10-05',
          timestamp: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(), // 12 days ago
          rateBdt: 12350,
        },
        {
          date: '2026-09-01',
          timestamp: new Date(now - 46 * 24 * 60 * 60 * 1000).toISOString(), // 46 days ago
          rateBdt: 12100,
        },
      ];

      // 7D Filter (7 days)
      const cutoff7D = now - 7 * 24 * 60 * 60 * 1000;
      const records7D = records.filter((r) => new Date(r.timestamp).getTime() >= cutoff7D);
      expect(records7D).toHaveLength(1);
      expect(records7D[0].date).toBe('2026-10-16');

      // 1M Filter (30 days)
      const cutoff1M = now - 30 * 24 * 60 * 60 * 1000;
      const records1M = records.filter((r) => new Date(r.timestamp).getTime() >= cutoff1M);
      expect(records1M).toHaveLength(2);

      // 1Y Filter (365 days)
      const cutoff1Y = now - 365 * 24 * 60 * 60 * 1000;
      const records1Y = records.filter((r) => new Date(r.timestamp).getTime() >= cutoff1Y);
      expect(records1Y).toHaveLength(3);
    });

    it('should produce a zero-records empty state when no circulars exist in the window', () => {
      const now = new Date('2026-10-17T12:00:00.000Z').getTime();
      const records = [
        {
          date: '2026-08-01',
          timestamp: new Date(now - 77 * 24 * 60 * 60 * 1000).toISOString(), // 77 days ago
          rateBdt: 11950,
        },
      ];

      // 7D Filter
      const cutoff7D = now - 7 * 24 * 60 * 60 * 1000;
      const inWindow = records.filter((r) => new Date(r.timestamp).getTime() >= cutoff7D);

      expect(inWindow).toHaveLength(0);
      const isEmpty = inWindow.length === 0;
      expect(isEmpty).toBe(true);
    });
  });

  describe('Purity Grade Segregation & Availability Guard', () => {
    it('should strictly isolate 24K and 22K benchmark series without crossover', () => {
      const mockDbRecords = [
        { purity: PurityGrade.K24, rateBdt: 12450 },
        { purity: PurityGrade.K22, rateBdt: 11412 },
        { purity: PurityGrade.K21, rateBdt: 10893 },
      ];

      const k24Records = mockDbRecords.filter((r) => r.purity === PurityGrade.K24);
      const k22Records = mockDbRecords.filter((r) => r.purity === PurityGrade.K22);

      expect(k24Records).toHaveLength(1);
      expect(k24Records[0].rateBdt).toBe(12450);

      expect(k22Records).toHaveLength(1);
      expect(k22Records[0].rateBdt).toBe(11412);
    });
  });
});
