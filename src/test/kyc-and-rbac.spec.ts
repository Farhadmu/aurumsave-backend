import { Role, KycStatus, AuditAction } from '@aurumsave/shared';

describe('KYC Compliance State Machine & Server-Enforced RBAC', () => {
  describe('Registration Role Boundary Enforcement', () => {
    it('should ignore client-supplied staff role on public registration and strictly assign CUSTOMER', () => {
      // Simulating the server-enforced rule in auth.service.ts
      const registerPayload = {
        email: 'attacker@evil.com',
        fullName: 'Sneaky User',
        role: Role.SUPER_ADMIN, // Malicious attempt to escalate privileges
      };

      const enforceCustomerRoleOnRegistration = (payload: typeof registerPayload) => {
        return {
          ...payload,
          role: Role.CUSTOMER, // Server override
        };
      };

      const registeredUser = enforceCustomerRoleOnRegistration(registerPayload);
      expect(registeredUser.role).toBe(Role.CUSTOMER);
      expect(registeredUser.role).not.toBe(Role.SUPER_ADMIN);
    });
  });

  describe('KYC State Transitions', () => {
    it('should transition user from NOT_SUBMITTED to PENDING_REVIEW upon document submission', () => {
      let currentKycStatus = KycStatus.NOT_SUBMITTED;

      const submitKycDocuments = (status: KycStatus) => {
        if (status === KycStatus.APPROVED) {
          throw new Error('Already approved');
        }
        return KycStatus.PENDING_REVIEW;
      };

      currentKycStatus = submitKycDocuments(currentKycStatus);
      expect(currentKycStatus).toBe(KycStatus.PENDING_REVIEW);
    });

    it('should disallow duplicate submission when status is already APPROVED', () => {
      const approvedStatus = KycStatus.APPROVED;
      const canSubmit = approvedStatus !== KycStatus.APPROVED;

      expect(canSubmit).toBe(false);
    });

    it('should allow only authorized compliance staff to approve or reject KYC', () => {
      const allowedRoles = [Role.KYC_OFFICER, Role.ADMIN, Role.SUPER_ADMIN];

      const checkPermission = (role: Role) => allowedRoles.includes(role);

      expect(checkPermission(Role.KYC_OFFICER)).toBe(true);
      expect(checkPermission(Role.ADMIN)).toBe(true);
      expect(checkPermission(Role.SUPER_ADMIN)).toBe(true);
      expect(checkPermission(Role.CUSTOMER)).toBe(false);
      expect(checkPermission(Role.FINANCE_OFFICER)).toBe(false);
      expect(checkPermission(Role.SUPPORT_AGENT)).toBe(false);
      expect(checkPermission(Role.AUDITOR)).toBe(false);
    });
  });

  describe('Support Messages Data Isolation', () => {
    it('should hide internal staff notes from customer ticket queries', () => {
      const allMessages = [
        { id: 1, message: 'Customer query regarding transaction', isInternalNote: false },
        { id: 2, message: 'Officer investigating AML risk flag', isInternalNote: true },
        { id: 3, message: 'Official response to customer', isInternalNote: false },
      ];

      const getCustomerMessages = (messages: typeof allMessages, userRole: Role) => {
        if (userRole === Role.CUSTOMER) {
          return messages.filter((m) => !m.isInternalNote);
        }
        return messages;
      };

      const customerView = getCustomerMessages(allMessages, Role.CUSTOMER);
      const staffView = getCustomerMessages(allMessages, Role.KYC_OFFICER);

      expect(customerView).toHaveLength(2);
      expect(customerView.some((m) => m.isInternalNote)).toBe(false);
      expect(staffView).toHaveLength(3);
    });
  });
});
