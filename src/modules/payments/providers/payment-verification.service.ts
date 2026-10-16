import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PaymentMethod } from '@aurumsave/shared';
import { PaymentDocument } from '../../../database/schemas/payment.schema';
import { BkashVerifier } from './bkash.verifier';
import { NagadVerifier } from './nagad.verifier';
import { SslCommerzVerifier } from './sslcommerz.verifier';
import { PaymentProviderVerifier, PaymentVerificationResult, ProviderReadinessStatus } from './provider.interface';

@Injectable()
export class PaymentVerificationService {
  private readonly logger = new Logger(PaymentVerificationService.name);
  private readonly verifiers: Map<PaymentMethod, PaymentProviderVerifier> = new Map();

  constructor(
    private readonly bkashVerifier: BkashVerifier,
    private readonly nagadVerifier: NagadVerifier,
    private readonly sslCommerzVerifier: SslCommerzVerifier,
  ) {
    this.verifiers.set(PaymentMethod.BKASH, this.bkashVerifier);
    this.verifiers.set(PaymentMethod.NAGAD, this.nagadVerifier);
    this.verifiers.set(PaymentMethod.SSLCOMMERZ, this.sslCommerzVerifier);
  }

  /**
   * Reports readiness status and diagnostic details for all supported payment providers
   */
  getProvidersStatus(): Record<string, {
    gateway: string;
    status: ProviderReadinessStatus;
    configured: boolean;
    missingConfigs: string[];
    documentationRef: string;
  }> {
    const statuses: Record<string, any> = {};
    for (const [gateway, verifier] of this.verifiers.entries()) {
      statuses[gateway] = {
        gateway,
        ...verifier.getReadinessDetails(),
      };
    }
    return statuses;
  }

  /**
   * Executes secure, provider-specific payment verification.
   * Performs cryptographic signature validation and/or server-to-server status query.
   * Rejects unverified, mismatched, pending, or tampered payments.
   */
  async verifyGatewayPayment(
    payment: PaymentDocument,
    payload: Record<string, any>,
    headers: Record<string, string> = {},
  ): Promise<PaymentVerificationResult> {
    const verifier = this.verifiers.get(payment.gateway);
    if (!verifier) {
      throw new BadRequestException(`No security verifier implemented for payment gateway: ${payment.gateway}`);
    }

    this.logger.log(`Initiating provider-specific verification for Payment #${payment.paymentId} via ${payment.gateway}`);

    const result = await verifier.verifyPayment(payment, payload, headers);

    if (result.isPending) {
      throw new BadRequestException(
        `Payment ${payment.paymentId} cannot be settled: Provider transaction is currently in pending status (${result.gatewayStatus})`,
      );
    }

    if (!result.verified) {
      throw new UnauthorizedException(
        `Payment verification failed for ${payment.paymentId}: ${result.failureReason || 'Verification check rejected'}`,
      );
    }

    this.logger.log(
      `Payment #${payment.paymentId} successfully verified by ${payment.gateway}. Provider Txn: ${result.gatewayTransactionId}`,
    );

    return result;
  }
}
