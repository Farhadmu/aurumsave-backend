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
  SUPER_ADMIN_MANAGE_SUPPLIERS = 'SUPER_ADMIN_MANAGE_SUPPLIERS',
  SUPER_ADMIN_MANAGE_VAULT = 'SUPER_ADMIN_MANAGE_VAULT',
  SUPER_ADMIN_DUAL_APPROVAL = 'SUPER_ADMIN_DUAL_APPROVAL',
  SUPER_ADMIN_MANAGE_CMS = 'SUPER_ADMIN_MANAGE_CMS',
  SUPER_ADMIN_EMERGENCY_CONTROL = 'SUPER_ADMIN_EMERGENCY_CONTROL',
  COMMERCE_STORE_MANAGE = 'COMMERCE_STORE_MANAGE',
  COMMERCE_MARKETPLACE_REVIEW = 'COMMERCE_MARKETPLACE_REVIEW',
  COMMERCE_PICKUP_MANAGE = 'COMMERCE_PICKUP_MANAGE',
  COMMERCE_HANDOVER_CONFIRM = 'COMMERCE_HANDOVER_CONFIRM',
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
  GOLD_GIFT_ESCROW = 'GOLD_GIFT_ESCROW',
  GOLD_GIFT_TRANSFER = 'GOLD_GIFT_TRANSFER',
  GOLD_GIFT_REVERSAL = 'GOLD_GIFT_REVERSAL',
  FIAT_DEPOSIT = 'FIAT_DEPOSIT',
  FIAT_WITHDRAWAL = 'FIAT_WITHDRAWAL',
  FEE = 'FEE',
  REVERSAL = 'REVERSAL',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_ON_CUSTOMER = 'WAITING_ON_CUSTOMER',
  ESCALATED_TO_FINANCE = 'ESCALATED_TO_FINANCE',
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
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  KYC_SUBMITTED = 'KYC_SUBMITTED',
  KYC_REVIEWED = 'KYC_REVIEWED',
  QUOTE_REQUESTED = 'QUOTE_REQUESTED',
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_PAYMENT_RECEIVED = 'ORDER_PAYMENT_RECEIVED',
  ORDER_SETTLED = 'ORDER_SETTLED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  LEDGER_COMMITTED = 'LEDGER_COMMITTED',
  GOLD_GIFT_SENT = 'GOLD_GIFT_SENT',
  GOLD_GIFT_CLAIMED = 'GOLD_GIFT_CLAIMED',
  GOLD_GIFT_REJECTED = 'GOLD_GIFT_REJECTED',
  GOLD_GIFT_CANCELLED = 'GOLD_GIFT_CANCELLED',
  DISPUTE_RAISED = 'DISPUTE_RAISED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  ADMIN_SETTING_UPDATED = 'ADMIN_SETTING_UPDATED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  SECURITY_EVENT = 'SECURITY_EVENT',
  DUAL_APPROVAL_REQUESTED = 'DUAL_APPROVAL_REQUESTED',
  DUAL_APPROVAL_DECIDED = 'DUAL_APPROVAL_DECIDED',
  SUPPLIER_UPDATED = 'SUPPLIER_UPDATED',
  PURCHASE_ORDER_CREATED = 'PURCHASE_ORDER_CREATED',
  VAULT_CUSTODY_UPDATED = 'VAULT_CUSTODY_UPDATED',
  CMS_CONTENT_PUBLISHED = 'CMS_CONTENT_PUBLISHED',
  EMERGENCY_KILLSWITCH_TRIGGERED = 'EMERGENCY_KILLSWITCH_TRIGGERED',
  COMMERCE_STORE_ORDER_CREATED = 'COMMERCE_STORE_ORDER_CREATED',
  COMMERCE_MARKETPLACE_LISTED = 'COMMERCE_MARKETPLACE_LISTED',
  COMMERCE_MARKETPLACE_REVIEWED = 'COMMERCE_MARKETPLACE_REVIEWED',
  COMMERCE_ESCROW_LOCKED = 'COMMERCE_ESCROW_LOCKED',
  COMMERCE_HANDOVER_CONFIRMED = 'COMMERCE_HANDOVER_CONFIRMED',
  COMMERCE_PICKUP_POINT_UPDATED = 'COMMERCE_PICKUP_POINT_UPDATED',
  JEWELLERY_SELL_REQUESTED = 'JEWELLERY_SELL_REQUESTED',
  JEWELLERY_ASSAY_COMPLETED = 'JEWELLERY_ASSAY_COMPLETED',
}

export enum MarketplaceCategory {
  GOLD_BAR = 'GOLD_BAR',
  COIN = 'COIN',
  NECKLACE = 'NECKLACE',
  RING = 'RING',
  BANGLE = 'BANGLE',
  CHAIN = 'CHAIN',
  EARRING = 'EARRING',
  OTHER_JEWELLERY = 'OTHER_JEWELLERY',
}

export enum MarketplaceListingStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  ACTIVE = 'ACTIVE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum MarketplaceVerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PHYSICALLY_ASSAYED = 'PHYSICALLY_ASSAYED',
  HALLMARK_VERIFIED = 'HALLMARK_VERIFIED',
  DOCUMENT_VERIFIED = 'DOCUMENT_VERIFIED',
  REJECTED = 'REJECTED',
}

export enum ItemCondition {
  NEW_IN_BLISTER = 'NEW_IN_BLISTER',
  LIKE_NEW = 'LIKE_NEW',
  USED_GOOD = 'USED_GOOD',
  SCRAP_OR_DAMAGED = 'SCRAP_OR_DAMAGED',
}

export enum PickupPointStatus {
  ACTIVE = 'ACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  INACTIVE = 'INACTIVE',
}

export enum CommerceOrderType {
  OFFICIAL_STORE = 'OFFICIAL_STORE',
  MARKETPLACE = 'MARKETPLACE',
  SCRAP_BUYBACK = 'SCRAP_BUYBACK',
}

export enum FulfillmentStatus {
  PENDING_INSPECTION = 'PENDING_INSPECTION',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  HANDOVER_COMPLETED = 'HANDOVER_COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface OfficialProductDto {
  productId: string;
  titleEn: string;
  titleBn: string;
  slug: string;
  productType: 'MINTED_BAR' | 'CAST_BAR' | 'COIN';
  purity: PurityGrade;
  weightGrams: number;
  weightMilligrams: number;
  makingFeePoisha: number;
  inStockQuantity: number;
  reservedQuantity: number;
  images: string[];
  certifier: string;
  standard: string;
  isActive: boolean;
  calculatedPriceBdt?: number;
}

export interface MarketplaceListingDto {
  listingId: string;
  sellerId: string;
  sellerName: string;
  category: MarketplaceCategory;
  title: string;
  description: string;
  photos: string[];
  claimedPurity: PurityGrade;
  claimedGrossWeightGrams: number;
  claimedNetGoldWeightGrams: number;
  stoneWastageDeductionGrams: number;
  condition: ItemCondition;
  askingPricePoisha: number;
  askingPriceBdt?: number;
  status: MarketplaceListingStatus;
  verificationStatus: MarketplaceVerificationStatus;
  verifiedPurity?: PurityGrade;
  verifiedNetGoldWeightGrams?: number;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface PickupPointDto {
  pointId: string;
  nameEn: string;
  nameBn: string;
  division: string;
  district: string;
  addressEn: string;
  addressBn: string;
  contactPerson: string;
  phone: string;
  operatingHours: string;
  supportedServices: string[];
  dailyCapacity: number;
  currentScheduledToday: number;
  status: PickupPointStatus;
  securityFeatures: string[];
}

export enum DualApprovalOperation {
  PRICE_OVERRIDE = 'PRICE_OVERRIDE',
  LEDGER_ADJUSTMENT = 'LEDGER_ADJUSTMENT',
  PAYMENT_REFUND = 'PAYMENT_REFUND',
  ACCOUNT_UNFREEZE = 'ACCOUNT_UNFREEZE',
  TREASURY_TRANSFER = 'TREASURY_TRANSFER',
  EMERGENCY_KILLSWITCH = 'EMERGENCY_KILLSWITCH',
}

export enum DualApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export enum VaultCustodyStatus {
  IN_VAULT = 'IN_VAULT',
  ALLOCATED_TO_CUSTOMERS = 'ALLOCATED_TO_CUSTOMERS',
  DISPATCHED_REDEMPTION = 'DISPATCHED_REDEMPTION',
  IN_TRANSIT = 'IN_TRANSIT',
}

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PLACED = 'PLACED',
  SETTLED = 'SETTLED',
  CANCELLED = 'CANCELLED',
}

export enum CmsContentType {
  BANNER = 'BANNER',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  FAQ = 'FAQ',
  ACADEMY_ARTICLE = 'ACADEMY_ARTICLE',
  SEO_METADATA = 'SEO_METADATA',
}

export interface SupplierDto {
  supplierId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  licenseNumber: string;
  purityGradesOffered: PurityGrade[];
  currentBidQuotePoishaPerGram: number;
  currentAskQuotePoishaPerGram: number;
  isActive: boolean;
  rating: number;
}

export interface VaultCustodyRecordDto {
  recordId: string;
  vaultLocation: string;
  depositoryPartner: string;
  barSerialNumber: string;
  purity: PurityGrade;
  weightGrams: number;
  weightMilligrams: number;
  assayCertificateNumber: string;
  status: VaultCustodyStatus;
  verifiedByStaffId?: string;
  verifiedAt?: string;
}

export interface PurchaseOrderDto {
  poNumber: string;
  supplierId: string;
  supplierName: string;
  purity: PurityGrade;
  weightGrams: number;
  weightMilligrams: number;
  ratePerGramPoisha: number;
  totalPoisha: number;
  status: PurchaseOrderStatus;
  paymentReference?: string;
  vaultRecordId?: string;
}

export interface DualApprovalRequestDto {
  requestId: string;
  operationType: DualApprovalOperation;
  payload: Record<string, any>;
  reason: string;
  makerId: string;
  makerRole: Role;
  makerName?: string;
  status: DualApprovalStatus;
  checkerId?: string;
  checkerRole?: Role;
  checkerName?: string;
  decisionNote?: string;
  expiresAt: string;
  createdAt: string;
}

export interface CmsContentDto {
  slug: string;
  contentType: CmsContentType;
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  metadata?: Record<string, any>;
  isPublished: boolean;
  priorityOrder: number;
}

export interface UserSummary {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  role: Role;
  kycStatus: KycStatus;
  isActive: boolean;
  isAccountFrozen?: boolean;
  frozenAt?: string;
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
