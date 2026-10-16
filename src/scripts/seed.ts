import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Role, KycStatus, PurityGrade, CONVERSIONS } from '@aurumsave/shared';
import { AppModule } from '../app.module';
import { User, UserDocument } from '../database/schemas/user.schema';
import { GoldHolding, GoldHoldingDocument } from '../database/schemas/gold-holding.schema';
import { CustomerProfile, CustomerProfileDocument } from '../database/schemas/customer-profile.schema';

async function seed() {
  console.log('--- Initializing AurumSave Safe Seed Runner ---');
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    console.error('FATAL: Seed runner aborted. Seeding is prohibited in production without ALLOW_PRODUCTION_SEED=true.');
    process.exit(1);
  }
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const holdingModel = app.get<Model<GoldHoldingDocument>>(getModelToken(GoldHolding.name));
  const profileModel = app.get<Model<CustomerProfileDocument>>(getModelToken(CustomerProfile.name));

  const salt = await bcrypt.genSalt(10);

  const seedUsers = [
    {
      email: 'superadmin@aurumsave.com',
      password: 'Aurum#SuperAdmin2026!',
      fullName: 'Chief Executive Administrator',
      phone: '+8801700000001',
      role: Role.SUPER_ADMIN,
      kycStatus: KycStatus.APPROVED,
    },
    {
      email: 'compliance@aurumsave.com',
      password: 'Aurum#Compliance2026!',
      fullName: 'Tariqul Islam (Compliance Head)',
      phone: '+8801700000002',
      role: Role.KYC_OFFICER,
      kycStatus: KycStatus.APPROVED,
    },
    {
      email: 'finance@aurumsave.com',
      password: 'Aurum#Finance2026!',
      fullName: 'Nazia Rahman (Treasury Operations)',
      phone: '+8801700000003',
      role: Role.FINANCE_OFFICER,
      kycStatus: KycStatus.APPROVED,
    },
    {
      email: 'support@aurumsave.com',
      password: 'Aurum#Support2026!',
      fullName: 'Sadia Ahmed (Customer Care Lead)',
      phone: '+8801700000004',
      role: Role.SUPPORT_AGENT,
      kycStatus: KycStatus.APPROVED,
    },
    {
      email: 'auditor@aurumsave.com',
      password: 'Aurum#Auditor2026!',
      fullName: 'External Risk & Security Auditor',
      phone: '+8801700000005',
      role: Role.AUDITOR,
      kycStatus: KycStatus.APPROVED,
    },
    {
      email: 'customer@aurumsave.com',
      password: 'Aurum#Customer2026!',
      fullName: 'Mohammad Farhan Chowdhury',
      phone: '+8801712345678',
      role: Role.CUSTOMER,
      kycStatus: KycStatus.APPROVED,
    },
  ];

  for (const item of seedUsers) {
    const existing = await userModel.findOne({ email: item.email });
    if (!existing) {
      const passwordHash = await bcrypt.hash(item.password, salt);
      const user = await userModel.create({
        email: item.email,
        passwordHash,
        fullName: item.fullName,
        phone: item.phone,
        role: item.role,
        kycStatus: item.kycStatus,
        isActive: true,
        isEmailVerified: true,
      });

      if (user.role === Role.CUSTOMER) {
        await profileModel.create({
          userId: user._id,
          nidNumber: '19922692015000123',
          occupation: 'Private Service',
          address: {
            addressLine1: 'Road 11, Banani',
            city: 'Dhaka',
            district: 'Dhaka',
            division: 'Dhaka',
            postalCode: '1213',
          },
        });

        // Seed 10 grams of 24K gold and 5 grams of 22K gold for the demo customer
        const k24Grams = 10;
        const k22Grams = 5;

        await holdingModel.create([
          {
            userId: user._id,
            purity: PurityGrade.K24,
            weightMilligramsAvailable: k24Grams * CONVERSIONS.MILLIGRAMS_PER_GRAM,
            weightMilligramsPending: 0,
            totalCostPoisha: k24Grams * 12450 * CONVERSIONS.POISHA_PER_BDT,
            averageCostPerMilligramPoisha: Math.round((12450 * CONVERSIONS.POISHA_PER_BDT) / 1000),
          },
          {
            userId: user._id,
            purity: PurityGrade.K22,
            weightMilligramsAvailable: k22Grams * CONVERSIONS.MILLIGRAMS_PER_GRAM,
            weightMilligramsPending: 0,
            totalCostPoisha: k22Grams * 11412 * CONVERSIONS.POISHA_PER_BDT,
            averageCostPerMilligramPoisha: Math.round((11412 * CONVERSIONS.POISHA_PER_BDT) / 1000),
          },
          {
            userId: user._id,
            purity: PurityGrade.K21,
            weightMilligramsAvailable: 0,
            weightMilligramsPending: 0,
            totalCostPoisha: 0,
            averageCostPerMilligramPoisha: 0,
          },
          {
            userId: user._id,
            purity: PurityGrade.K18,
            weightMilligramsAvailable: 0,
            weightMilligramsPending: 0,
            totalCostPoisha: 0,
            averageCostPerMilligramPoisha: 0,
          },
        ]);
      }

      console.log(`[SEED] Created account for ${item.email} (${item.role})`);
    } else {
      console.log(`[SEED] User ${item.email} already exists. Skipping.`);
    }
  }

  console.log('--- Seed completed successfully. Closing context. ---');
  await app.close();
}

seed().catch((err) => {
  console.error('Seed execution error:', err);
  process.exit(1);
});
