# AurumSave — Backend REST API Engine

> **AurumSave** is a sovereign digital gold micro-savings and physical bullion custody fintech platform engineered for Bangladesh. This repository contains the NestJS REST API, double-entry financial ledger, BAJUS live price adapter, and authentication services.

## 🏛️ System Architecture

- **NestJS v10 Architecture:** Modular dependency injection with Passport JWT guards and RBAC role decorators.
- **Double-Entry Ledger:** Immutable accounting journal for all gold allocations (milligrams) and transactions (poisha minor units).
- **BAJUS Live Price Engine:** Real-time benchmark rates for 24K, 22K, 21K, and 18K gold with 5-minute guaranteed quote locks.
- **Embedded Database Fallback:** Automatic MongoMemoryServer initialization if no external MongoDB instance is supplied.
- **OpenAPI / Swagger:** Interactive API documentation hosted at `/api/v1/docs`.

---

## 🛠️ Quickstart Guide

### Prerequisites
- Node.js 18+ or 20+
- npm 9+
- Optional: MongoDB 7.0+ (If omitted, automatic embedded MongoMemoryServer boots up)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/Farhadmu/aurumsave-backend.git
cd aurumsave-backend

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
```

### Seeding Test Data

```bash
# Seed standard test users, accounts, and initial rates
npm run seed
```

### Running Locally

```bash
# Start development server with live reload
npm run dev

# Or start in debug mode
npm run start:debug
```

- **Health Endpoint:** [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)
- **Swagger Documentation:** [http://localhost:4000/api/v1/docs](http://localhost:4000/api/v1/docs)

---

## 🧪 Testing

```bash
# Run unit & integration test suites
npm run test

# Run test coverage report
npm run test:cov
```

---

## 🐳 Docker Deployment

```bash
# Build Docker image
docker build -t aurumsave-backend .

# Run container
docker run -p 4000:4000 -e PORT=4000 -e NODE_ENV=production aurumsave-backend
```

---

## 📜 Default Seeded Accounts

| Role | Email Address | Password |
| :--- | :--- | :--- |
| **Demo Customer** | `customer@aurumsave.com` | `Aurum#Customer2026!` |
| **Super Administrator** | `superadmin@aurumsave.com` | `Aurum#SuperAdmin2026!` |
| **KYC / Compliance Officer** | `compliance@aurumsave.com` | `Aurum#Compliance2026!` |
| **Finance / Operations Officer**| `finance@aurumsave.com` | `Aurum#Finance2026!` |
| **Customer Support Agent** | `support@aurumsave.com` | `Aurum#Support2026!` |
| **External Auditor (Read-Only)**| `auditor@aurumsave.com` | `Aurum#Auditor2026!` |
