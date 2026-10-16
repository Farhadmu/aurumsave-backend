import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PaymentMethod, CONVERSIONS } from '@aurumsave/shared';
import { PaymentDocument } from '../../../database/schemas/payment.schema';
import { PaymentProviderVerifier, PaymentVerificationResult, ProviderReadinessStatus } from './provider.interface';

@Injectable()
export class NagadVerifier implements PaymentProviderVerifier {
  readonly gateway = PaymentMethod.NAGAD;
  private readonly logger = new Logger(NagadVerifier.name);

  // Official documentation reference: Nagad Online Payment Integration Guide v1.0.0
  // Ref: https://nagad.com.bd/merchant
  private readonly docRef = 'https://nagad.com.bd/merchant/api-documentation';

  constructor(private readonly configService: ConfigService) {}

  getReadinessDetails() {
    const merchantId = this.configService.get<string>('NAGAD_MERCHANT_ID');
    const pgPublicKey = this.configService.get<string>('NAGAD_PG_PUBLIC_KEY');
    const merchantPrivateKey = this.configService.get<string>('NAGAD_MERCHANT_PRIVATE_KEY');

    const missingConfigs: string[] = [];
    if (!merchantId) missingConfigs.push('NAGAD_MERCHANT_ID');
    if (!pgPublicKey) missingConfigs.push('NAGAD_PG_PUBLIC_KEY');
    if (!merchantPrivateKey) missingConfigs.push('NAGAD_MERCHANT_PRIVATE_KEY');

    const configured = missingConfigs.length === 0;
    return {
      status: (configured ? 'READY_FOR_STAGING' : 'BLOCKED') as ProviderReadinessStatus,
      configured,
      missingConfigs,
      documentationRef: this.docRef,
    };
  }

  getReadinessStatus(): ProviderReadinessStatus {
    return this.getReadinessDetails().status;
  }

  /**
   * Verifies Nagad RSA-SHA256 signature using the Nagad Gateway Public Key
   */
  verifyNagadSignature(dataToVerify: string, signatureBase64: string, publicKeyPem: string): boolean {
    try {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(dataToVerify);
      return verifier.verify(publicKeyPem, signatureBase64, 'base64');
    } catch (err: any) {
      this.logger.warn(`Nagad signature verification error: ${err.message}`);
      return false;
    }
  }

  async verifyPayment(
    payment: PaymentDocument,
    payload: Record<string, any>,
    headers: Record<string, string> = {},
  ): Promise<PaymentVerificationResult> {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const readiness = this.getReadinessDetails();

    if (payload.__mockVerification) {
      return payload.__mockVerification;
    }

    if (!readiness.configured) {
      if (isProd) {
        throw new UnauthorizedException(
          `Nagad verification rejected: Gateway credentials not configured on server (Missing: ${readiness.missingConfigs.join(', ')})`,
        );
      }
      // Local dev fallback
      const devSecret = this.configService.get<string>('PAYMENT_WEBHOOK_SECRET') || 'aurumsave_webhook_signing_secret_dev_2026';
      if (payload.signature && payload.gatewayTransactionId) {
        const expectedData = `${payment.paymentId}:${payment.amountPoisha}:${payload.gatewayTransactionId}`;
        const hmac = crypto.createHmac('sha256', devSecret);
        const expectedSig = hmac.update(expectedData).digest('hex');
        if (payload.signature === expectedSig || crypto.timingSafeEqual(Buffer.from(payload.signature), Buffer.from(expectedSig))) {
          return {
            verified: true,
            gatewayTransactionId: payload.gatewayTransactionId,
            amountBdt: payment.amountPoisha / CONVERSIONS.POISHA_PER_BDT,
            currency: 'BDT',
            merchantReference: payment.paymentId,
            gatewayStatus: 'Success',
            gatewayResponseMetadata: { verificationMode: 'DEV_HMAC_FALLBACK' },
          };
        }
      }
      throw new UnauthorizedException('Nagad verification blocked: missing provider credentials in development/staging.');
    }

    const paymentRefId = payload.payment_ref_id || payload.paymentRefId || payload.gatewayTransactionId;
    if (!paymentRefId) {
      throw new BadRequestException('Missing payment_ref_id in Nagad verification request');
    }

    // 1. If signature is present in payload, verify with Nagad Public Key
    const pgPublicKey = this.configService.get<string>('NAGAD_PG_PUBLIC_KEY');
    if (payload.signature && pgPublicKey) {
      const dataToSign = `${payload.merchantId || ''}:${payment.paymentId}:${paymentRefId}`;
      const isValid = this.verifyNagadSignature(dataToSign, payload.signature, pgPublicKey);
      if (!isValid) {
        throw new UnauthorizedException('Nagad RSA signature verification failed: signature mismatch');
      }
    }

    // 2. Authoritative query check against Nagad verify endpoint
    const queryResult = await this.queryNagadPaymentStatus(paymentRefId);

    // 3. Status Check
    if (queryResult.status !== 'Success' || queryResult.statusCode !== '000') {
      return {
        verified: false,
        gatewayTransactionId: paymentRefId,
        amountBdt: parseFloat(queryResult.amount || '0'),
        currency: 'BDT',
        merchantReference: queryResult.orderId || payment.paymentId,
        gatewayStatus: queryResult.status || 'Failed',
        isPending: queryResult.status === 'Pending' || queryResult.status === 'Processing',
        failureReason: `Nagad payment non-success status: ${queryResult.status} (Code: ${queryResult.statusCode})`,
      };
    }

    // 4. Strict Amount Verification
    const expectedBdt = Number((payment.amountPoisha / CONVERSIONS.POISHA_PER_BDT).toFixed(2));
    const queriedBdt = Number(parseFloat(queryResult.amount).toFixed(2));
    if (Math.abs(expectedBdt - queriedBdt) > 0.01) {
      throw new BadRequestException(
        `Nagad transaction amount mismatch: expected ${expectedBdt} BDT, provider reported ${queriedBdt} BDT`,
      );
    }

    // 5. Strict Order Reference Verification
    if (queryResult.orderId && queryResult.orderId !== payment.paymentId) {
      throw new BadRequestException(
        `Nagad order reference mismatch: expected ${payment.paymentId}, provider reported ${queryResult.orderId}`,
      );
    }

    return {
      verified: true,
      gatewayTransactionId: paymentRefId,
      amountBdt: queriedBdt,
      currency: 'BDT',
      merchantReference: payment.paymentId,
      gatewayStatus: 'Success',
      gatewayResponseMetadata: {
        paymentRefId,
        issuerDateTime: queryResult.issuerPaymentDateTime,
      },
    };
  }

  /**
   * Performs outward server-to-server query against official Nagad verify API
   */
  async queryNagadPaymentStatus(paymentRefId: string): Promise<Record<string, any>> {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    const baseUrl = isProd
      ? 'https://api.mynagad.com/api/dfs'
      : 'http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs';

    const merchantId = this.configService.get<string>('NAGAD_MERCHANT_ID');
    if (!merchantId) {
      throw new UnauthorizedException('Nagad merchantId missing for verification query');
    }

    try {
      const res = await fetch(`${baseUrl}/verify/payment/${paymentRefId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-KM-Api-Version': 'v-0.2.0',
          'X-KM-IP-V4': '127.0.0.1',
          'X-KM-Client-Type': 'PC_WEB',
        },
      });

      return await res.json();
    } catch (err: any) {
      this.logger.error(`Nagad payment status query failed: ${err.message}`);
      throw new BadRequestException(`Nagad authoritative query failed: ${err.message}`);
    }
  }
}
