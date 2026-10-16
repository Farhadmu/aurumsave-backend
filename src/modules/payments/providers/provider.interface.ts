import { PaymentMethod } from '@aurumsave/shared';
import { PaymentDocument } from '../../../database/schemas/payment.schema';

export type ProviderReadinessStatus = 'READY_FOR_STAGING' | 'BLOCKED' | 'NOT_IMPLEMENTED';

export interface PaymentVerificationResult {
  verified: boolean;
  gatewayTransactionId: string;
  amountBdt: number;
  currency: string;
  merchantReference: string;
  gatewayStatus: string;
  gatewayResponseMetadata?: Record<string, any>;
  failureReason?: string;
  isPending?: boolean;
}

export interface PaymentProviderVerifier {
  readonly gateway: PaymentMethod;
  getReadinessStatus(): ProviderReadinessStatus;
  getReadinessDetails(): {
    status: ProviderReadinessStatus;
    configured: boolean;
    missingConfigs: string[];
    documentationRef: string;
  };
  verifyPayment(
    payment: PaymentDocument,
    payload: Record<string, any>,
    headers?: Record<string, string>,
  ): Promise<PaymentVerificationResult>;
}
