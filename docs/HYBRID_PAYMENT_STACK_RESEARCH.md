# Hybrid Payment Stack Research

Last updated: 2026-04-20

## Purpose

This document records the researched payment architecture for CashFlawHubs and separates:

- what is confirmed from public official documentation,
- what is architecturally recommended for this product,
- and what still requires direct commercial/vendor confirmation before production rollout.

This is important because payment-provider coverage changes over time and public docs do not always expose full commercial availability for every market.

## Executive Summary

Recommended architecture:

1. East Africa core layer:
   - `Jenga API`
   - `Safaricom Daraja API`
2. Pan-Africa scale layer:
   - `Paystack`
3. Specialized local wallet layer:
   - `MTN MoMo`
   - `Telebirr`
   - Tanzania wallet-specific operators as separate integrations

Why this architecture:

- `Daraja` is the strongest direct Kenya M-Pesa route for collection and B2C payouts.
- `Jenga` expands East/Central Africa bank and wallet reach and is useful for disbursement and bank settlement.
- `Paystack` gives the best documented scale layer across its live merchant markets for cards, transfers, and selected local channels.
- `MTN MoMo`, `Telebirr`, and Tanzania wallet APIs are necessary if the product promises truly local wallet deposits and withdrawals.

## Official Research Summary

### 1. Jenga API

Verified from official docs:

- Jenga publicly documents support across East and Central Africa.
- Supported country list in Jenga docs includes:
  - `Kenya`
  - `Uganda`
  - `Tanzania`
  - `Rwanda`
  - `DRC`
  - `South Sudan`
  - `Ethiopia`
- Jenga documents:
  - payment collection via cards, mobile money, and bank transfers
  - send money to mobile wallets and bank accounts
  - RTGS/bank transfer capabilities
  - mobile wallet remittance flows

Implementation meaning for us:

- Use Jenga as the East/Central Africa bank-and-wallet settlement layer.
- Strong fit for:
  - bank routing
  - bulk disbursement support patterns
  - wallet payouts where operator-native rails are unavailable or undesirable

Important caveat:

- Jenga's public docs confirm country/service coverage broadly, but exact production availability depends on merchant onboarding and service enablement.

Official sources:

- https://developer.jengahq.io/
- https://developer.jengahq.io/guides/jenga-api/introduction/supported-entities
- https://developer.jengahq.io/guides/jenga-api/send-money/mobile-wallets
- https://developer.jengahq.io/guides/jenga-api/send-money/rtgs

### 2. Safaricom Daraja

Verified from official docs:

- Safaricom's Daraja portal is the official M-Pesa API platform.
- Daraja is the correct Kenya integration surface for M-Pesa APIs.
- For our architecture, the relevant production patterns are:
  - `STK Push` for deposits
  - `B2C` for withdrawals/disbursements

Implementation meaning for us:

- Kenya deposits should default to `Daraja STK Push`.
- Kenya withdrawals should default to `Daraja B2C`.
- Kenya referral and bulk payout orchestration can still use internal batching, but the payout rail should remain Daraja-first for local wallet delivery.

Official sources:

- https://developer.safaricom.co.ke/
- https://developer.safaricom.co.ke/apis
- https://developer.safaricom.co.ke/apis/GettingStarted

### 3. Paystack

Verified from official docs:

- Paystack officially states its services are available to businesses registered in:
  - `Nigeria`
  - `Ghana`
  - `South Africa`
  - `Kenya`
- Paystack Transfers are officially documented as available for:
  - `Nigeria`
  - `Ghana`
  - `South Africa`
  - `Kenya`
- Paystack mobile money transfer recipients are officially documented for:
  - `Ghana`
  - `Kenya`
- Paystack payment channels officially include:
  - cards
  - bank-based flows in supported markets
  - M-Pesa for Kenya businesses
  - QR/Capitec Pay for South Africa
  - bank transfer checkout for Nigeria and Ghana

Implementation meaning for us:

- Use Paystack as the pan-African scale engine where Paystack is officially live for our merchant entity.
- Safe first-wave production countries:
  - `NG`
  - `GH`
  - `ZA`
  - `KE`
- Do not assume direct production support in Côte d'Ivoire, Senegal, Egypt, Cameroon, Zambia, or Mozambique purely from expansion pages or marketing footprint.

Important caveat:

- Public official docs do **not** confirm full merchant availability for all countries listed in the product vision.
- Those markets require direct Paystack commercial confirmation before we promise them in UI.

Official sources:

- https://paystack.com/docs
- https://support.paystack.com/en/articles/2130562
- https://paystack.com/docs/transfers/
- https://paystack.com/docs/transfers/creating-transfer-recipients/
- https://paystack.com/docs/payments/payment-channels/
- https://support.paystack.com/en/articles/2128642

### 4. MTN MoMo

Verified from official docs:

- MTN MoMo's official developer portal documents:
  - `Request Payment`
  - `Transfer`
  - callbacks/status polling
  - collection and disbursement product families
- The portal clearly supports merchant-requested collection and payout patterns.

Implementation meaning for us:

- MTN MoMo should be used for:
  - `Uganda` deposits via request-to-pay
  - `Uganda` withdrawals via transfer/disbursement
  - `Ghana` deposits/withdrawals where local MoMo UX is required
  - `Cameroon` and `Zambia` only after market-specific onboarding/confirmation

Important caveat:

- The public docs confirm the API product model, but country-by-country production access is market-dependent.
- We should treat `Uganda` and `Ghana` as target integrations, but only mark each as production-ready after sandbox/prod onboarding succeeds.

Official sources:

- https://momodeveloper.mtn.com/
- https://momodeveloper.mtn.com/apis
- https://momodeveloper.mtn.com/content/html_widgets/sefqs.html

### 5. Telebirr

Verified from public sources:

- Telebirr publicly documents the wallet product and consumer/business payment capability.
- Public developer-grade API docs are not clearly exposed in the same way as Daraja, Jenga, Paystack, or MTN MoMo.

Implementation meaning for us:

- Ethiopia should be modeled as `Telebirr-first` for local wallet UX.
- However, production integration must be treated as:
  - partner-onboarding dependent
  - commercial confirmation required
  - likely custom integration / non-self-serve onboarding

Official sources:

- https://telebirr.ethiotelecom.et/

## Country-by-Country Architecture

### Deposits

- `Kenya`: `Daraja STK Push` first, `Jenga` fallback, `Paystack M-Pesa` optional secondary route
- `Uganda`: `MTN MoMo Request to Pay` first, `Jenga` bank route fallback
- `Ghana`: `MTN MoMo prompt/request-to-pay` first, `Paystack` secondary
- `Tanzania`: wallet-prompt / USSD operator integrations first, `Jenga` bank routing fallback
- `Ethiopia`: `Telebirr` app approval first
- `Nigeria`: `Paystack` card / bank transfer / USSD
- `South Africa`: `Paystack` card / QR / supported local channels

### Withdrawals

- `Kenya`: `Daraja B2C` first, `Jenga` wallet/bank fallback
- `Uganda`: `MTN MoMo transfer` first, `Jenga` fallback, `Paystack` only if commercially valid for payout path
- `Tanzania`: operator wallet payout integrations first, `Jenga` fallback where possible
- `Ghana`: `MTN MoMo` first for local-wallet UX, `Paystack mobile money` secondary
- `Ethiopia`: `Telebirr` first
- `Nigeria`: `Paystack bank transfer`
- `South Africa`: `Paystack bank transfer`

## Product Guidance for CashFlawHubs

### What the UI can safely promise now

If we stay aligned with public-doc evidence and current codebase maturity, the safest messaging is:

- `Kenya`: Daraja + Paystack + Jenga architecture
- `Nigeria`: Paystack
- `Ghana`: Paystack plus planned MTN MoMo
- `Uganda`: planned MTN MoMo plus Jenga
- `Ethiopia`: planned Telebirr
- `Tanzania`: planned operator wallet integrations plus Jenga

### What should not be hard-promised yet

Until commercial/API onboarding is verified:

- `Cameroon`
- `Zambia`
- `Mozambique`
- `Senegal`
- `Egypt`
- `Ivory Coast`
- `South Sudan`
- `Rwanda`

These can appear in internal architecture plans, but not as guaranteed customer-facing withdrawal methods yet.

## Implementation Plan

### Phase 1: Production-ready core

- Kenya deposits: Daraja STK Push
- Kenya withdrawals: Daraja B2C
- Nigeria deposits/withdrawals: Paystack
- Ghana deposits/withdrawals: Paystack first
- Shared ledger and transaction orchestration

### Phase 2: Local wallet completion

- Uganda: MTN MoMo collection + disbursement
- Ghana: MTN MoMo collection + wallet payout
- Ethiopia: Telebirr onboarding/integration
- Tanzania: operator-specific wallet integrations

### Phase 3: East/Central bank settlement expansion

- Jenga bank rails for:
  - Uganda
  - Tanzania
  - Rwanda
  - South Sudan
  - DRC
  - Ethiopia

## Current Repo Status

As of this document:

- `Paystack` is partially implemented in code.
- `Daraja` is partially implemented in code.
- `Jenga`, `MTN MoMo`, `Telebirr`, and Tanzania-specific wallet integrations are **not fully implemented yet**.
- Config scaffolding has been added to model this hybrid architecture.

## Recommended Next Build Steps

1. Create `payment orchestration service` with country-and-operation routing
2. Split flows into:
   - `deposit`
   - `withdrawal`
   - `bulk payout`
3. Implement adapters:
   - `darajaAdapter`
   - `paystackAdapter`
   - `jengaAdapter`
   - `mtnMomoAdapter`
   - `telebirrAdapter`
4. Add provider capability flags to admin config
5. Only expose payment methods in UI if:
   - provider is enabled
   - merchant credentials exist
   - market is commercially approved

## Decision

For CashFlawHubs, the best architecture is:

- `Daraja + Jenga` for East Africa core rails
- `Paystack` for scale markets where officially supported
- `MTN MoMo + Telebirr + Tanzania operator APIs` for true local-wallet coverage

This is the cleanest path to balancing:

- user trust,
- local payout UX,
- operational fallback,
- and realistic production rollout.
