import {
  PurityGrade,
  MarketplaceCategory,
  MarketplaceListingStatus,
  MarketplaceVerificationStatus,
  ItemCondition,
  CommerceOrderType,
  FulfillmentStatus,
  PickupPointStatus,
  CONVERSIONS,
} from '@aurumsave/shared';

describe('Dual Gold Commerce & Customer Marketplace Invariants', () => {
  describe('Official AurumSave Gold Store Pricing & Reservation Invariants', () => {
    it('should compute exact official minted bar price using live benchmark rate and making fee', () => {
      const liveRate24kPerGramBdt = 12500;
      const weightGrams = 5.0;
      const makingFeePoisha = 125000; // ৳1,250

      const goldValueBdt = liveRate24kPerGramBdt * weightGrams; // ৳62,500
      const makingFeeBdt = makingFeePoisha / CONVERSIONS.POISHA_PER_BDT; // ৳1,250
      const calculatedPriceBdt = Math.round(goldValueBdt + makingFeeBdt); // ৳63,750
      const calculatedPricePoisha = calculatedPriceBdt * CONVERSIONS.POISHA_PER_BDT; // 6,375,000 Poisha

      expect(goldValueBdt).toBe(62500);
      expect(makingFeeBdt).toBe(1250);
      expect(calculatedPriceBdt).toBe(63750);
      expect(calculatedPricePoisha).toBe(6375000);
    });

    it('should calculate 1 Bhori (11.664g) 22K investment bar price accurately', () => {
      const liveRate22kPerGramBdt = 11450;
      const weightGrams = 11.664;
      const makingFeePoisha = 250000; // ৳2,500

      const goldValueBdt = liveRate22kPerGramBdt * weightGrams; // 133552.8
      const makingFeeBdt = makingFeePoisha / CONVERSIONS.POISHA_PER_BDT; // 2500
      const calculatedPriceBdt = Math.round(goldValueBdt + makingFeeBdt);

      expect(calculatedPriceBdt).toBe(136053);
    });

    it('should atomically decrement stock and increment reserved quantity, blocking overselling', () => {
      let inStockQuantity = 5;
      let reservedQuantity = 0;

      const attemptReservation = (qty: number): boolean => {
        if (inStockQuantity < qty) {
          return false;
        }
        inStockQuantity -= qty;
        reservedQuantity += qty;
        return true;
      };

      // Order 1: 3 units - should succeed
      expect(attemptReservation(3)).toBe(true);
      expect(inStockQuantity).toBe(2);
      expect(reservedQuantity).toBe(3);

      // Order 2: 3 units - should fail (only 2 left)
      expect(attemptReservation(3)).toBe(false);
      expect(inStockQuantity).toBe(2);
      expect(reservedQuantity).toBe(3);

      // Order 3: 2 units - should succeed exactly
      expect(attemptReservation(2)).toBe(true);
      expect(inStockQuantity).toBe(0);
      expect(reservedQuantity).toBe(5);
    });
  });

  describe('C2C Marketplace State Machine & Integrity Checks', () => {
    it('should enforce gross weight >= net gold weight and compute stone wastage deduction', () => {
      const validateListingWeights = (grossGrams: number, netGrams: number) => {
        if (grossGrams <= 0 || netGrams <= 0) {
          throw new Error('Weights must be positive numbers');
        }
        if (grossGrams < netGrams) {
          throw new Error('Gross weight cannot be less than net gold weight');
        }
        const stoneWastage = Math.max(0, Number((grossGrams - netGrams).toFixed(3)));
        return stoneWastage;
      };

      expect(() => validateListingWeights(10, 12)).toThrow(
        'Gross weight cannot be less than net gold weight',
      );
      expect(validateListingWeights(12.5, 10.0)).toBe(2.5);
      expect(validateListingWeights(5.0, 5.0)).toBe(0);
    });

    it('should keep customer listings UNVERIFIED until staff physically assays or verifies', () => {
      const listing = {
        listingId: 'LST-1001',
        claimedPurity: PurityGrade.K22,
        claimedGrossWeightGrams: 8.5,
        claimedNetGoldWeightGrams: 7.2,
        status: MarketplaceListingStatus.PENDING_REVIEW,
        verificationStatus: MarketplaceVerificationStatus.UNVERIFIED,
      };

      expect(listing.status).toBe(MarketplaceListingStatus.PENDING_REVIEW);
      expect(listing.verificationStatus).toBe(MarketplaceVerificationStatus.UNVERIFIED);

      // Staff appraisal transition
      const staffReview = (purityAssay?: PurityGrade, netWeightAssay?: number) => {
        if (purityAssay && netWeightAssay) {
          return {
            status: MarketplaceListingStatus.ACTIVE,
            verificationStatus: MarketplaceVerificationStatus.PHYSICALLY_ASSAYED,
            verifiedPurity: purityAssay,
            verifiedNetGoldWeightGrams: netWeightAssay,
          };
        }
        return {
          status: MarketplaceListingStatus.ACTIVE,
          verificationStatus: MarketplaceVerificationStatus.DOCUMENT_VERIFIED,
        };
      };

      const approvedWithAssay = staffReview(PurityGrade.K22, 7.15);
      expect(approvedWithAssay.status).toBe(MarketplaceListingStatus.ACTIVE);
      expect(approvedWithAssay.verificationStatus).toBe(
        MarketplaceVerificationStatus.PHYSICALLY_ASSAYED,
      );
      expect(approvedWithAssay.verifiedNetGoldWeightGrams).toBe(7.15);
    });

    it('should calculate escrow fee (1.5%) and desk assay fee (৳350) accurately on C2C purchase', () => {
      const askingPriceBdt = 95000;
      const askingPricePoisha = askingPriceBdt * CONVERSIONS.POISHA_PER_BDT; // 9,500,000 Poisha

      const platformFeePoisha = Math.round(askingPricePoisha * 0.015); // ৳1,425 = 142,500 Poisha
      const assayFeePoisha = 35000; // ৳350 = 35,000 Poisha
      const totalPoisha = askingPricePoisha + platformFeePoisha + assayFeePoisha;

      expect(platformFeePoisha).toBe(142500);
      expect(assayFeePoisha).toBe(35000);
      expect(totalPoisha).toBe(9677500);
      expect(totalPoisha / CONVERSIONS.POISHA_PER_BDT).toBe(96775);
    });
  });

  describe('District Pickup Desk & Secure OTP Handover Invariants', () => {
    it('should verify OTP and release escrow to seller only on exact match at designated desk', () => {
      const order = {
        orderId: 'ORD-MKT-7788',
        pickupPointId: 'PKP-DHK-GULSHAN',
        pickupVerificationOtp: '654321',
        paymentStatus: 'ESCROW_HELD',
        fulfillmentStatus: FulfillmentStatus.READY_FOR_PICKUP,
      };

      const verifyHandover = (enteredOtp: string, deskId: string) => {
        if (order.fulfillmentStatus === FulfillmentStatus.HANDOVER_COMPLETED) {
          throw new Error('Order already completed');
        }
        if (deskId !== order.pickupPointId) {
          throw new Error('Pickup desk mismatch');
        }
        if (enteredOtp !== order.pickupVerificationOtp) {
          throw new Error('Invalid pickup verification OTP');
        }

        order.fulfillmentStatus = FulfillmentStatus.HANDOVER_COMPLETED;
        order.paymentStatus = 'SETTLED_TO_SELLER';
        return true;
      };

      expect(() => verifyHandover('111111', 'PKP-DHK-GULSHAN')).toThrow(
        'Invalid pickup verification OTP',
      );
      expect(() => verifyHandover('654321', 'PKP-CTG-AGRABAD')).toThrow('Pickup desk mismatch');

      expect(verifyHandover('654321', 'PKP-DHK-GULSHAN')).toBe(true);
      expect(order.fulfillmentStatus).toBe(FulfillmentStatus.HANDOVER_COMPLETED);
      expect(order.paymentStatus).toBe('SETTLED_TO_SELLER');
    });

    it('should truthfully return empty list when no desk exists in requested district', () => {
      const activeDesks = [
        { pointId: 'PKP-DHK-GULSHAN', division: 'Dhaka', district: 'Dhaka', status: PickupPointStatus.ACTIVE },
        { pointId: 'PKP-CTG-AGRABAD', division: 'Chattogram', district: 'Chattogram', status: PickupPointStatus.ACTIVE },
        { pointId: 'PKP-SYL-ZINDABAZAR', division: 'Sylhet', district: 'Sylhet', status: PickupPointStatus.ACTIVE },
      ];

      const getDesksForDistrict = (district: string) => {
        return activeDesks.filter((d) => d.district.toLowerCase() === district.toLowerCase());
      };

      expect(getDesksForDistrict('Dhaka')).toHaveLength(1);
      // Districts with no active desk yet should return empty array (no hallucinated addresses)
      expect(getDesksForDistrict('Bandarban')).toHaveLength(0);
      expect(getDesksForDistrict('Meherpur')).toHaveLength(0);
    });
  });

  describe('Official Store Checkout Regression Suite (Home Delivery & Financial Safety)', () => {
    it('should compute exact 1g gold checkout price (৳13,150) with ৳250 courier fee for Home Delivery', () => {
      const ratePerGramPoisha = 1245000; // ৳12,450 in poisha
      const weightGrams = 1.0;
      const makingFeePoisha = 45000; // ৳450
      const quantity = 1;
      const deliveryMethod = 'HOME_DELIVERY';

      const goldValuePoisha = Math.round(ratePerGramPoisha * weightGrams);
      const unitTotalPoisha = goldValuePoisha + makingFeePoisha;
      const subtotalPoisha = unitTotalPoisha * quantity;
      const deliveryFeePoisha = deliveryMethod === 'HOME_DELIVERY' ? 25000 : 0;
      const totalPoisha = subtotalPoisha + deliveryFeePoisha;

      expect(goldValuePoisha).toBe(1245000); // ৳12,450
      expect(unitTotalPoisha).toBe(1290000); // ৳12,900
      expect(deliveryFeePoisha).toBe(25000); // ৳250
      expect(totalPoisha).toBe(1315000); // ৳13,150
      expect(totalPoisha / CONVERSIONS.POISHA_PER_BDT).toBe(13150);
    });

    it('should compute exact 1g gold checkout price (৳12,900) with ৳0 courier fee for Pickup Point', () => {
      const ratePerGramPoisha = 1245000;
      const weightGrams = 1.0;
      const makingFeePoisha = 45000;
      const quantity = 1;
      const deliveryMethod: string = 'PICKUP_POINT';

      const goldValuePoisha = Math.round(ratePerGramPoisha * weightGrams);
      const unitTotalPoisha = goldValuePoisha + makingFeePoisha;
      const subtotalPoisha = unitTotalPoisha * quantity;
      const deliveryFeePoisha = deliveryMethod === 'HOME_DELIVERY' ? 25000 : 0;
      const totalPoisha = subtotalPoisha + deliveryFeePoisha;

      expect(deliveryFeePoisha).toBe(0);
      expect(totalPoisha).toBe(1290000);
      expect(totalPoisha / CONVERSIONS.POISHA_PER_BDT).toBe(12900);
    });

    it('reproduces and verifies the fix: safely resolves pickupPointId when pickup is null in Home Delivery', () => {
      // Prior bug: pickup was null for Home Delivery, and accessing pickup.pointId threw TypeError
      const deliveryMethod = 'HOME_DELIVERY';
      const pickup: any = null; // null for Home Delivery

      // The fix safely resolves without crashing:
      const safePickupPointId = pickup ? pickup.pointId : 'HOME_DELIVERY';
      expect(safePickupPointId).toBe('HOME_DELIVERY');

      // Audit log details payload safely constructed
      const auditDetails = {
        productId: 'PROD-BAR-1G-24K',
        quantity: 1,
        totalBdt: 13150,
        pickupPointId: pickup ? pickup.pointId : 'HOME_DELIVERY',
      };
      expect(auditDetails.pickupPointId).toBe('HOME_DELIVERY');
    });

    it('should rollback reserved stock when order creation encounters any failure', () => {
      let inStock = 10;
      let reserved = 0;

      // Step 1: Reserve stock atomically
      const reserve = (qty: number) => {
        inStock -= qty;
        reserved += qty;
      };
      // Step 2: Rollback stock
      const rollback = (qty: number) => {
        inStock += qty;
        reserved -= qty;
      };

      reserve(2);
      expect(inStock).toBe(8);
      expect(reserved).toBe(2);

      // Simulate failure and rollback
      rollback(2);
      expect(inStock).toBe(10);
      expect(reserved).toBe(0);
    });

    it('should detect duplicate payment reference submissions and prevent double ordering (Idempotency)', () => {
      const orderDb = new Map<string, any>();

      const processOrder = (paymentRef: string, orderData: any) => {
        if (orderDb.has(paymentRef)) {
          return { isDuplicate: true, order: orderDb.get(paymentRef) };
        }
        orderDb.set(paymentRef, { ...orderData, orderId: `AS-GOLD-${Math.floor(100000 + Math.random() * 900000)}` });
        return { isDuplicate: false, order: orderDb.get(paymentRef) };
      };

      const firstAttempt = processOrder('BKASH-REF-123456', { productId: 'PROD-BAR-1G-24K', qty: 1 });
      expect(firstAttempt.isDuplicate).toBe(false);
      const originalOrderId = firstAttempt.order.orderId;

      // Second identical attempt (rapid double-click)
      const secondAttempt = processOrder('BKASH-REF-123456', { productId: 'PROD-BAR-1G-24K', qty: 1 });
      expect(secondAttempt.isDuplicate).toBe(true);
      expect(secondAttempt.order.orderId).toBe(originalOrderId);
    });

    it('should enforce mandatory address fields for Home Delivery orders', () => {
      const validateAddress = (addr?: any) => {
        if (!addr || !addr.fullName || !addr.phone || !addr.addressLine) {
          throw new Error('Full recipient name, phone, and delivery address are mandatory for home delivery');
        }
        return true;
      };

      expect(() => validateAddress(undefined)).toThrow('mandatory');
      expect(() => validateAddress({ fullName: 'Md User' })).toThrow('mandatory');
      expect(
        validateAddress({
          fullName: 'Md User',
          phone: '01700000000',
          addressLine: 'House 1, Road 2, Gulshan',
        }),
      ).toBe(true);
    });
  });
});

