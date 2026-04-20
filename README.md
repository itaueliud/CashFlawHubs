# CashFlawHubs - African Remote Earning Platform

A full-stack platform where users across East & West Africa earn money through surveys, microtasks, remote jobs, offerwalls, freelance gigs, and referrals — with M-Pesa, MTN MoMo, Flutterwave payouts.

## Project Structure

```
earnhub/
├── backend/          # Node.js + Express API
├── frontend/         # Next.js 14 Web App
└── .github/          # CI/CD workflows
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) |
| Backend | Node.js + Express |
| Database | MongoDB Atlas |
| Cache | Redis |
| Queue | RabbitMQ / Redis Queue |
| Payments | Flutterwave + M-Pesa Daraja |
| Auth | JWT + OTP (phone) |
| Hosting | AWS EC2 (backend) + Vercel (frontend) |

## Supported Countries

| Country | Currency | Payment |
|---------|----------|---------|
| Kenya | KES | M-Pesa Daraja |
| Uganda | UGX | MTN MoMo |
| Tanzania | TZS | Vodacom M-Pesa |
| Ethiopia | ETB | Telebirr |
| Ghana | GHS | Flutterwave |
| Nigeria | NGN | Flutterwave/Paystack |

## Quick Start

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in your environment variables
npm run dev
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in your environment variables
npm run dev
```

## Architecture Docs

- Hybrid payment research and rollout plan: [docs/HYBRID_PAYMENT_STACK_RESEARCH.md](docs/HYBRID_PAYMENT_STACK_RESEARCH.md)

## Earning Modules

1. **Remote Jobs** — Remotive + Jobicy APIs, updated every 6h
2. **Paid Surveys** — CPX Research + BitLabs offerwalls
3. **Microtasks** — Microworkers + Toloka APIs
4. **Offerwalls** — Ayет Studios + AdGate
5. **Freelance Gigs** — Internal marketplace
6. **Referral System** — 200 KES per activated referral
7. **Daily Challenges** — Gamified streaks & badges

## Business Logic

- Activation fee: **500 KES** (or local equivalent)
- Platform share: **300 KES**
- Referrer reward: **200 KES**
- Minimum withdrawal: **KSh 200**
- All balances stored internally in **USD**, converted at withdrawal
