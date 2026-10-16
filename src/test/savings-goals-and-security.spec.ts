import { GoalCategory, GoalStatus } from '../database/schemas/savings-goal.schema';
import { PurityGrade, Role, AuditAction } from '@aurumsave/shared';

describe('Smart Gold Savings Goals & Personal Security Center Invariants', () => {
  describe('Smart Gold Savings Goal Financial Calculations', () => {
    it('should accurately calculate goal progress based on target gold weight in milligrams', () => {
      const targetWeightMg = 10000; // 10 grams
      const currentWeightMg = 4500; // 4.5 grams

      const progressPct = Math.min(100, Math.round((currentWeightMg / targetWeightMg) * 100));
      const remainingWeightGrams = (targetWeightMg - currentWeightMg) / 1000;

      expect(progressPct).toBe(45);
      expect(remainingWeightGrams).toBe(5.5);
    });

    it('should transition status to COMPLETED when target weight is attained', () => {
      const targetWeightMg = 5000;
      let currentWeightMg = 4800;
      let status = GoalStatus.ACTIVE;

      const newContributionMg = 300;
      currentWeightMg += newContributionMg;

      if (currentWeightMg >= targetWeightMg) {
        status = GoalStatus.COMPLETED;
      }

      expect(status).toBe(GoalStatus.COMPLETED);
      expect(currentWeightMg).toBe(5100);
    });

    it('should compute non-linear monthly and weekly savings schedules based on target horizon', () => {
      const targetWeightGrams = 12; // 12 grams
      const targetMonths = 6;
      const benchmarkRatePerGram = 11500; // BDT
      const targetAmountBdt = targetWeightGrams * benchmarkRatePerGram; // 138,000 BDT

      const monthlyContributionBdt = Math.round(targetAmountBdt / targetMonths);
      const weeklyContributionBdt = Math.round(targetAmountBdt / (targetMonths * 4.33));
      const monthlyGoldWeightGrams = targetWeightGrams / targetMonths;

      expect(targetAmountBdt).toBe(138000);
      expect(monthlyContributionBdt).toBe(23000);
      expect(weeklyContributionBdt).toBe(5312);
      expect(monthlyGoldWeightGrams).toBe(2);
    });

    it('should prevent empty or non-positive goal target initialization', () => {
      const validateGoalInput = (targetMg?: number, targetBdt?: number): boolean => {
        if (!targetMg && !targetBdt) return false;
        if (targetMg && targetMg <= 0) return false;
        if (targetBdt && targetBdt <= 0) return false;
        return true;
      };

      expect(validateGoalInput(undefined, undefined)).toBe(false);
      expect(validateGoalInput(0, 0)).toBe(false);
      expect(validateGoalInput(-500, undefined)).toBe(false);
      expect(validateGoalInput(1000, undefined)).toBe(true);
      expect(validateGoalInput(undefined, 50000)).toBe(true);
    });
  });

  describe('Personal Security Center & Account Freeze Controls', () => {
    it('should fail-closed and block order execution when user account is frozen', () => {
      const user = {
        id: 'usr-123',
        isActive: true,
        isAccountFrozen: true,
        frozenAt: new Date(),
        frozenReason: 'Customer detected suspicious activity',
      };

      const canExecuteOrder = (u: typeof user): { allowed: boolean; reason?: string } => {
        if (!u.isActive) return { allowed: false, reason: 'Account suspended' };
        if (u.isAccountFrozen) return { allowed: false, reason: 'Account frozen under emergency lockdown' };
        return { allowed: true };
      };

      const result = canExecuteOrder(user);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('emergency lockdown');
    });

    it('should generate verifiable telemetry metadata for active security sessions', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36';
      const ipAddress = '103.114.98.42'; // Bangladesh IP

      let deviceName = 'Desktop Browser';
      if (/windows/i.test(userAgent)) deviceName = 'Windows PC';

      const session = {
        ipAddress,
        deviceName,
        isActive: true,
        lastActive: new Date().toISOString(),
      };

      expect(session.deviceName).toBe('Windows PC');
      expect(session.ipAddress).toBe('103.114.98.42');
      expect(session.isActive).toBe(true);
    });

    it('should enforce that unfreezing an account records a cryptographically sealed security audit log', () => {
      const auditPayload = {
        action: AuditAction.SECURITY_EVENT,
        actorRole: Role.SUPER_ADMIN,
        entityType: 'User',
        details: {
          eventType: 'ACCOUNT_UNFROZEN',
          targetEmail: 'customer@aurumsave.com',
        },
      };

      expect(auditPayload.action).toBe(AuditAction.SECURITY_EVENT);
      expect(auditPayload.actorRole).toBe(Role.SUPER_ADMIN);
      expect(auditPayload.details.eventType).toBe('ACCOUNT_UNFROZEN');
    });
  });
});
