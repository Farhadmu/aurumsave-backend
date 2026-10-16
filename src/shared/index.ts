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

export * from './permissions';
