import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiAssistantResponse {
  answer: string;
  citedSources: string[];
  isGrounded: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'UNCERTAIN';
  disclaimer: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // Knowledge base of platform rules, pricing methodology, KYC, and security
  private readonly knowledgeBase = [
    {
      topic: 'GOLD_PURITY_AND_KARAT',
      keywords: ['karat', 'purity', '24k', '22k', '21k', '18k', 'bhori', 'tola', 'gram'],
      answer:
        'AurumSave supports 24K (99.9% fineness), 22K (91.6% hallmarked jewellery standard), 21K (87.5%), and 18K (75.0%). In Bangladesh, 1 Bhori (Tola) equals precisely 11.664 grams (or 16 Annas / 96 Rattis). All gold allocated through AurumSave is physically insured and vault-stored.',
      source: 'AurumSave Gold Purity & Standards Document (Section 2.1)',
    },
    {
      topic: 'PRICING_AND_SPREAD',
      keywords: ['price', 'rate', 'spread', 'fee', 'bajus', 'charge', 'cost', 'how much'],
      answer:
        'AurumSave benchmark rates are updated daily from the Bangladesh Jewellers Association (BAJUS) official rate card. A transparent spread of 2.0% - 2.5% covers physical allocated custody, vault security, assay certification, and liquidity. A 0.5% platform transaction fee applies on buy orders; vault storage is 100% free.',
      source: 'AurumSave Transparent Fee & Spread Policy (Section 4.3)',
    },
    {
      topic: 'KYC_VERIFICATION',
      keywords: ['kyc', 'nid', 'passport', 'verify', 'verification', 'document', 'identity', 'approval'],
      answer:
        'Under Bangladesh Financial Intelligence Unit (BFIU) and anti-money laundering (AML) guidelines, customers must complete KYC verification before purchasing or withdrawing above tier-1 thresholds. Acceptable documents include Smart NID, Old NID (with birth cert), Passport, or Driving License. Submissions are reviewed by human compliance officers within 24 hours.',
      source: 'AurumSave Compliance & AML/KYC Manual (Section 1.4)',
    },
    {
      topic: 'PAYMENTS_AND_WITHDRAWALS',
      keywords: ['payment', 'bkash', 'nagad', 'rocket', 'bank', 'withdraw', 'sell', 'cash out'],
      answer:
        'You can buy digital gold using bKash, Nagad, Rocket, Upay, or direct Bangladeshi bank transfer. When you sell gold from your vault, the proceeds are credited immediately to your Aurum wallet and can be withdrawn to your verified bKash or bank account.',
      source: 'AurumSave Settlement & Payment Guide (Section 3.2)',
    },
    {
      topic: 'VAULT_SAFETY_AND_CUSTODY',
      keywords: ['safe', 'security', 'vault', 'custody', 'loss', 'insurance', 'theft', 'real gold'],
      answer:
        'Every milligram of digital gold purchased on AurumSave represents physically allocated bullion stored in high-security, insured bank-grade vaults. Customers can request physical bar/coin delivery once their cumulative savings reach 1 Bhori (11.664g).',
      source: 'AurumSave Custody & Audit Protocol (Section 5.1)',
    },
  ];

  constructor(private readonly configService: ConfigService) {}

  async askAssistant(query: string): Promise<AiAssistantResponse> {
    const q = query.toLowerCase();

    // Guardrail: Financial modification or advice requests
    if (
      q.includes('guarantee') ||
      q.includes('profit') ||
      q.includes('promise') ||
      q.includes('how much will i earn') ||
      q.includes('crypto')
    ) {
      return {
        answer:
          'Gold is a time-tested store of value and inflation hedge, but its price fluctuates with global and local market dynamics. AurumSave does not guarantee fixed investment returns or provide speculative trading advice.',
        citedSources: ['AurumSave Risk Disclosure & Financial Integrity Policy'],
        isGrounded: true,
        confidence: 'HIGH',
        disclaimer:
          'Informational response only. AurumSave AI is strictly prohibited from forecasting future profits or modifying financial balances.',
      };
    }

    // Match query against approved knowledge base
    let bestMatch = null;
    let highestScore = 0;

    for (const item of this.knowledgeBase) {
      let score = 0;
      for (const kw of item.keywords) {
        if (q.includes(kw)) {
          score += 1;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && highestScore > 0) {
      return {
        answer: bestMatch.answer,
        citedSources: [bestMatch.source],
        isGrounded: true,
        confidence: highestScore >= 2 ? 'HIGH' : 'MEDIUM',
        disclaimer:
          'Answer sourced from verified AurumSave platform documentation. Does not constitute personal financial advice.',
      };
    }

    return {
      answer:
        'I am grounded in AurumSave platform documentation regarding gold purity (24K/22K), BAJUS pricing, KYC verification, and MFS payment methods. For complex account inquiries or transaction disputes, please open a ticket with our support desk.',
      citedSources: ['AurumSave Help Center'],
      isGrounded: true,
      confidence: 'UNCERTAIN',
      disclaimer: 'For specific account assistance, please contact AurumSave human support.',
    };
  }
}
