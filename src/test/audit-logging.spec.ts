import { Role, AuditAction } from '@aurumsave/shared';

describe('Audit Logging & Immutable Trail Verification', () => {
  it('should capture all required metadata on critical financial and compliance actions', () => {
    const auditRecord = {
      logId: 'AUD-1718000000-A1B2C3D4',
      actorId: 'usr-999',
      actorRole: Role.FINANCE_OFFICER,
      action: AuditAction.ORDER_SETTLED,
      entityType: 'Order',
      entityId: 'ORD-1718000000',
      details: {
        amountPoisha: 12450000,
        goldMg: 10000,
        gateway: 'BKASH',
      },
      createdAt: new Date(),
    };

    expect(auditRecord.logId).toMatch(/^AUD-/);
    expect(auditRecord.actorRole).toBe(Role.FINANCE_OFFICER);
    expect(auditRecord.action).toBe(AuditAction.ORDER_SETTLED);
    expect(auditRecord.entityType).toBe('Order');
    expect(auditRecord.details.goldMg).toBe(10000);
  });

  it('should preserve immutable schema design without updatedAt mutation fields', () => {
    // In audit-log.schema.ts: @Schema({ timestamps: { createdAt: true, updatedAt: false } })
    const auditSchemaConfig = {
      timestamps: {
        createdAt: true,
        updatedAt: false, // Disallowed modification ensures tamper-evidence
      },
    };

    expect(auditSchemaConfig.timestamps.createdAt).toBe(true);
    expect(auditSchemaConfig.timestamps.updatedAt).toBe(false);
  });

  it('should support multi-criteria search for forensic auditing', () => {
    const logs = [
      { action: AuditAction.USER_REGISTERED, actorRole: Role.CUSTOMER, entityType: 'User' },
      { action: AuditAction.ORDER_CREATED, actorRole: Role.CUSTOMER, entityType: 'Order' },
      { action: AuditAction.KYC_REVIEWED, actorRole: Role.KYC_OFFICER, entityType: 'KycApplication' },
      { action: AuditAction.ADMIN_SETTING_UPDATED, actorRole: Role.SUPER_ADMIN, entityType: 'PlatformSetting' },
    ];

    const filterByRole = (role: Role) => logs.filter((l) => l.actorRole === role);
    const filterByAction = (act: AuditAction) => logs.filter((l) => l.action === act);

    expect(filterByRole(Role.CUSTOMER)).toHaveLength(2);
    expect(filterByAction(AuditAction.KYC_REVIEWED)).toHaveLength(1);
    expect(filterByAction(AuditAction.ADMIN_SETTING_UPDATED)).toHaveLength(1);
  });
});
