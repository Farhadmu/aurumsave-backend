/**
 * AurumSave Fintech Core Shared Types & Precision Financial Standards
 */

export enum Role {
  CUSTOMER = 'CUSTOMER',
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  KYC_OFFICER = 'KYC_OFFICER',
  FINANCE_OFFICER = 'FINANCE_OFFICER',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  AUDITOR = 'AUDITOR',
}

export enum Permission {
  PROFILE_VIEW_OWN = 'PROFILE_VIEW_OWN',
  PROFILE_UPDATE_OWN = 'PROFILE_UPDATE_OWN',
  QUOTE_CREATE = 'QUOTE_CREATE',
  QUOTE_VIEW_OWN = 'QUOTE_VIEW_OWN',
  ORDER_CREATE = 'ORDER_CREATE',
  ORDER_VIEW_OWN = 'ORDER_VIEW_OWN',
  ORDER_CANCEL_OWN = 'ORDER_CANCEL_OWN',
  ORDER_VIEW_ALL = 'ORDER_VIEW_ALL',
  PAYMENT_INITIATE_OWN = 'PAYMENT_INITIATE_OWN',
  PAYMENT_VIEW_OWN = 'PAYMENT_VIEW_OWN',
  PAYMENT_VIEW_ALL = 'PAYMENT_VIEW_ALL',
  PAYMENT_REFUND_EXECUTE = 'PAYMENT_REFUND_EXECUTE',
  PORTFOLIO_VIEW_OWN = 'PORTFOLIO_VIEW_OWN',
  LEDGER_VIEW_OWN = 'LEDGER_VIEW_OWN',
  LEDGER_VIEW_ALL = 'LEDGER_VIEW_ALL',
  KYC_SUBMIT_OWN = 'KYC_SUBMIT_OWN',
  KYC_VIEW_OWN = 'KYC_VIEW_OWN',
  KYC_QUEUE_VIEW = 'KYC_QUEUE_VIEW',
  KYC_DOSSIER_VIEW = 'KYC_DOSSIER_VIEW',
  KYC_DECISION_EXECUTE = 'KYC_DECISION_EXECUTE',
  TICKET_CREATE_OWN = 'TICKET_CREATE_OWN',
  TICKET_VIEW_OWN = 'TICKET_VIEW_OWN',
  TICKET_REPLY_OWN = 'TICKET_REPLY_OWN',
  TICKET_QUEUE_VIEW = 'TICKET_QUEUE_VIEW',
  TICKET_VIEW_ANY = 'TICKET_VIEW_ANY',
  TICKET_REPLY_ANY = 'TICKET_REPLY_ANY',
  TICKET_INTERNAL_NOTE_ADD = 'TICKET_INTERNAL_NOTE_ADD',
  TICKET_STATUS_UPDATE = 'TICKET_STATUS_UPDATE',
  ADMIN_OVERVIEW_VIEW = 'ADMIN_OVERVIEW_VIEW',
  USER_VIEW_ALL = 'USER_VIEW_ALL',
  USER_MANAGE_STATUS = 'USER_MANAGE_STATUS',
  USER_ROLE_ASSIGN = 'USER_ROLE_ASSIGN',
  RECONCILIATION_VIEW = 'RECONCILIATION_VIEW',
  AUDIT_VIEW_ALL = 'AUDIT_VIEW_ALL',
}

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

export enum PurityGrade {
  K24 = '24K', // 99.9% fineness
  K22 = '22K', // 91.6% fineness (standard Bangladesh jewellery rate)
  K21 = '21K', // 87.5% fineness
  K18 = '18K', // 75.0% fineness
}

export enum WeightUnit {
  GRAM = 'GRAM',
  MILLIGRAM = 'MILLIGRAM',
  BHORI = 'BHORI', // 1 Bhori (Tola) = 11.664 grams
  ANNA = 'ANNA',   // 1/16 Bhori = 0.729 grams
  RATTI = 'RATTI', // 1/96 Bhori = 0.1215 grams
}

export const CONVERSIONS = {
  MILLIGRAMS_PER_GRAM: 1000,
  GRAMS_PER_BHORI: 11.664,
  MILLIGRAMS_PER_BHORI: 11664,
  POISHA_PER_BDT: 100,
} as const;

export enum OrderType {
  BUY = 'BUY',
  SELL = 'SELL',
  SIP = 'SIP',
}

export enum OrderStatus {
  CREATED = 'CREATED',
  QUOTED = 'QUOTED',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  BKASH = 'BKASH',
  NAGAD = 'NAGAD',
  UPAY = 'UPAY',
  ROCKET = 'ROCKET',
  SSLCOMMERZ = 'SSLCOMMERZ',
  BANK_TRANSFER = 'BANK_TRANSFER',
  AURUM_WALLET = 'AURUM_WALLET',
}

export enum PaymentStatus {
  INITIATED = 'INITIATED',
  PENDING = 'PENDING',
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum KycStatus {
  NOT_SUBMITTED = 'NOT_SUBMITTED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
}

export enum KycDocumentType {
  NID_FRONT = 'NID_FRONT',
  NID_BACK = 'NID_BACK',
  PASSPORT = 'PASSPORT',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  SELFIE = 'SELFIE',
  TIN_CERTIFICATE = 'TIN_CERTIFICATE',
}

export enum LedgerEntryType {
  GOLD_DEPOSIT = 'GOLD_DEPOSIT',
  GOLD_WITHDRAWAL = 'GOLD_WITHDRAWAL',
  GOLD_PURCHASE = 'GOLD_PURCHASE',
  GOLD_SALE = 'GOLD_SALE',
  FIAT_DEPOSIT = 'FIAT_DEPOSIT',
  FIAT_WITHDRAWAL = 'FIAT_WITHDRAWAL',
  FEE = 'FEE',
  REVERSAL = 'REVERSAL',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_ON_CUSTOMER = 'WAITING_ON_CUSTOMER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum AuditAction {
  USER_REGISTERED = 'USER_REGISTERED',
  USER_LOGGED_IN = 'USER_LOGGED_IN',
  USER_LOGGED_OUT = 'USER_LOGGED_OUT',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  KYC_SUBMITTED = 'KYC_SUBMITTED',
  KYC_REVIEWED = 'KYC_REVIEWED',
  QUOTE_REQUESTED = 'QUOTE_REQUESTED',
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_PAYMENT_RECEIVED = 'ORDER_PAYMENT_RECEIVED',
  ORDER_SETTLED = 'ORDER_SETTLED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  LEDGER_COMMITTED = 'LEDGER_COMMITTED',
  DISPUTE_RAISED = 'DISPUTE_RAISED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  ADMIN_SETTING_UPDATED = 'ADMIN_SETTING_UPDATED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export interface UserSummary {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  role: Role;
  kycStatus: KycStatus;
  isActive: boolean;
  createdAt: string;
}

export interface LivePriceRate {
  purity: PurityGrade;
  buyPricePerGramPoisha: number; // In Poisha (1/100 BDT)
  sellPricePerGramPoisha: number; // In Poisha
  buyPricePerGramBdt: number;
  sellPricePerGramBdt: number;
  buyPricePerBhoriBdt: number;
  sellPricePerBhoriBdt: number;
  effectiveAt: string;
  expiresAt: string;
  source: string;
  isStale: boolean;
  spreadPercentage: number;
}

export interface QuoteDetails {
  quoteId: string;
  orderType: OrderType;
  purity: PurityGrade;
  weightGrams: number;
  weightMilligrams: number;
  ratePerGramBdt: number;
  subtotalBdt: number;
  platformFeeBdt: number;
  vaultStorageFeeBdt: number;
  totalBdt: number;
  totalPoisha: number;
  expiresAt: string;
  validForSeconds: number;
}

export interface CustomerHoldingsSummary {
  totalGoldGrams: number;
  availableGoldGrams: number;
  pendingGoldGrams: number;
  totalValuationBdt: number;
  unrealizedGainLossBdt: number;
  unrealizedGainLossPercentage: number;
  breakdownByPurity: Array<{
    purity: PurityGrade;
    grams: number;
    valuationBdt: number;
    avgPurchaseRateBdt: number;
  }>;
  fiatBalanceBdt: number;
  lastUpdated: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  meta?: Record<string, any>;
  timestamp: string;
}
