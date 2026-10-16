import { Role } from './index';

export enum Permission {
  // Customer Profile & Self
  PROFILE_VIEW_OWN = 'PROFILE_VIEW_OWN',
  PROFILE_UPDATE_OWN = 'PROFILE_UPDATE_OWN',

  // Quotes
  QUOTE_CREATE = 'QUOTE_CREATE',
  QUOTE_VIEW_OWN = 'QUOTE_VIEW_OWN',

  // Orders
  ORDER_CREATE = 'ORDER_CREATE',
  ORDER_VIEW_OWN = 'ORDER_VIEW_OWN',
  ORDER_CANCEL_OWN = 'ORDER_CANCEL_OWN',
  ORDER_VIEW_ALL = 'ORDER_VIEW_ALL',

  // Payments & Financials
  PAYMENT_INITIATE_OWN = 'PAYMENT_INITIATE_OWN',
  PAYMENT_VIEW_OWN = 'PAYMENT_VIEW_OWN',
  PAYMENT_VIEW_ALL = 'PAYMENT_VIEW_ALL',
  PAYMENT_REFUND_EXECUTE = 'PAYMENT_REFUND_EXECUTE',

  // Portfolio & Ledger
  PORTFOLIO_VIEW_OWN = 'PORTFOLIO_VIEW_OWN',
  LEDGER_VIEW_OWN = 'LEDGER_VIEW_OWN',
  LEDGER_VIEW_ALL = 'LEDGER_VIEW_ALL',

  // KYC & Compliance
  KYC_SUBMIT_OWN = 'KYC_SUBMIT_OWN',
  KYC_VIEW_OWN = 'KYC_VIEW_OWN',
  KYC_QUEUE_VIEW = 'KYC_QUEUE_VIEW',
  KYC_DOSSIER_VIEW = 'KYC_DOSSIER_VIEW',
  KYC_DECISION_EXECUTE = 'KYC_DECISION_EXECUTE',

  // Support
  TICKET_CREATE_OWN = 'TICKET_CREATE_OWN',
  TICKET_VIEW_OWN = 'TICKET_VIEW_OWN',
  TICKET_REPLY_OWN = 'TICKET_REPLY_OWN',
  TICKET_QUEUE_VIEW = 'TICKET_QUEUE_VIEW',
  TICKET_VIEW_ANY = 'TICKET_VIEW_ANY',
  TICKET_REPLY_ANY = 'TICKET_REPLY_ANY',
  TICKET_INTERNAL_NOTE_ADD = 'TICKET_INTERNAL_NOTE_ADD',
  TICKET_STATUS_UPDATE = 'TICKET_STATUS_UPDATE',

  // Staff & Administration
  ADMIN_OVERVIEW_VIEW = 'ADMIN_OVERVIEW_VIEW',
  USER_VIEW_ALL = 'USER_VIEW_ALL',
  USER_MANAGE_STATUS = 'USER_MANAGE_STATUS',
  USER_ROLE_ASSIGN = 'USER_ROLE_ASSIGN',
  RECONCILIATION_VIEW = 'RECONCILIATION_VIEW',
  AUDIT_VIEW_ALL = 'AUDIT_VIEW_ALL',
}

/**
 * Enterprise Least-Privilege Role Permission Matrix
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.CUSTOMER]: [
    Permission.PROFILE_VIEW_OWN,
    Permission.PROFILE_UPDATE_OWN,
    Permission.QUOTE_CREATE,
    Permission.QUOTE_VIEW_OWN,
    Permission.ORDER_CREATE,
    Permission.ORDER_VIEW_OWN,
    Permission.ORDER_CANCEL_OWN,
    Permission.PAYMENT_INITIATE_OWN,
    Permission.PAYMENT_VIEW_OWN,
    Permission.PORTFOLIO_VIEW_OWN,
    Permission.LEDGER_VIEW_OWN,
    Permission.KYC_SUBMIT_OWN,
    Permission.KYC_VIEW_OWN,
    Permission.TICKET_CREATE_OWN,
    Permission.TICKET_VIEW_OWN,
    Permission.TICKET_REPLY_OWN,
  ],

  [Role.KYC_OFFICER]: [
    Permission.KYC_QUEUE_VIEW,
    Permission.KYC_DOSSIER_VIEW,
    Permission.KYC_DECISION_EXECUTE,
    Permission.USER_VIEW_ALL,
  ],

  [Role.FINANCE_OFFICER]: [
    Permission.ORDER_VIEW_ALL,
    Permission.PAYMENT_VIEW_ALL,
    Permission.PAYMENT_REFUND_EXECUTE,
    Permission.RECONCILIATION_VIEW,
    Permission.LEDGER_VIEW_ALL,
    Permission.USER_VIEW_ALL,
  ],

  [Role.SUPPORT_AGENT]: [
    Permission.TICKET_QUEUE_VIEW,
    Permission.TICKET_VIEW_ANY,
    Permission.TICKET_REPLY_ANY,
    Permission.TICKET_INTERNAL_NOTE_ADD,
    Permission.TICKET_STATUS_UPDATE,
    Permission.USER_VIEW_ALL,
    Permission.ORDER_VIEW_ALL,
  ],

  [Role.AUDITOR]: [
    // Strictly Read-Only across platform records
    Permission.AUDIT_VIEW_ALL,
    Permission.LEDGER_VIEW_ALL,
    Permission.ORDER_VIEW_ALL,
    Permission.PAYMENT_VIEW_ALL,
    Permission.KYC_QUEUE_VIEW,
    Permission.KYC_DOSSIER_VIEW,
    Permission.RECONCILIATION_VIEW,
    Permission.ADMIN_OVERVIEW_VIEW,
    Permission.USER_VIEW_ALL,
  ],

  [Role.ADMIN]: [
    Permission.ADMIN_OVERVIEW_VIEW,
    Permission.USER_VIEW_ALL,
    Permission.USER_MANAGE_STATUS,
    Permission.ORDER_VIEW_ALL,
    Permission.PAYMENT_VIEW_ALL,
    Permission.PAYMENT_REFUND_EXECUTE,
    Permission.RECONCILIATION_VIEW,
    Permission.AUDIT_VIEW_ALL,
    Permission.LEDGER_VIEW_ALL,
    Permission.KYC_QUEUE_VIEW,
    Permission.KYC_DOSSIER_VIEW,
    Permission.KYC_DECISION_EXECUTE,
    Permission.TICKET_QUEUE_VIEW,
    Permission.TICKET_VIEW_ANY,
    Permission.TICKET_REPLY_ANY,
    Permission.TICKET_INTERNAL_NOTE_ADD,
    Permission.TICKET_STATUS_UPDATE,
  ],

  [Role.SUPER_ADMIN]: Object.values(Permission),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}
