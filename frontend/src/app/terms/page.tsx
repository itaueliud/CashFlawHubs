export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-4xl space-y-8 rounded-[2rem] border border-white/10 bg-slate-900/50 p-6 md:p-12">
        <div className="mb-8">
          <h1 className="text-3xl font-black">CASHFLAWHUBS – TERMS AND CONDITIONS</h1>
          <p className="mt-2 text-sm text-slate-400">Last Updated: June 9, 2025</p>
        </div>
        <div className="prose prose-invert max-w-none text-sm text-slate-300 space-y-6">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. WHO CAN JOIN</h2>
            <p>You must be 18 or older and a resident of Kenya, Uganda, Tanzania, Ethiopia, Ghana, or Nigeria. One account per person — no exceptions.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. ACTIVATION FEE</h2>
            <p>To start earning, you pay a one-time activation fee:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Kenya: KSh 500</li>
              <li>Uganda: USh 16,650</li>
              <li>Tanzania: TSh 11,500</li>
              <li>Ethiopia: Br 2,250</li>
              <li>Ghana: GH₵ 18</li>
              <li>Nigeria: ₦ 6,500</li>
            </ul>
            <p className="mt-2">This fee is non-refundable. It covers your account setup and is split between the platform and your referrer (if any).</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. HOW YOU EARN</h2>
            <p>You earn through surveys, microtasks, offerwalls, remote jobs, freelance gigs, and referrals. Earning opportunities depend on third-party providers and are not guaranteed. For every person you refer who activates, you earn KSh 200 (or local equivalent).</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. YOUR REWARDS</h2>
            <p>All rewards go to a Pending Balance first. After 48 hours of verification they move to your Available Balance. If a reward is reversed by a provider (e.g. fraud detected), it is removed from your balance. We do not pay out unverified rewards.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. WITHDRAWALS</h2>
            <p>Minimum withdrawal: KSh 200 (or equivalent). Payouts go to the mobile money number you registered with — no third-party accounts. Supported methods: M-Pesa, MTN MoMo, Telebirr, Vodacom, Flutterwave, Paystack.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. WHAT GETS YOU BANNED</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Multiple accounts</li>
              <li>Bots or automated tools</li>
              <li>VPNs or fake locations</li>
              <li>Referral abuse or self-referral</li>
              <li>Fake survey or task completions</li>
              <li>Selling or sharing your account</li>
            </ul>
            <p className="mt-2">Banned accounts forfeit all balances.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. OUR LIABILITY</h2>
            <p>We do not guarantee earnings. The platform is provided as-is. We are not responsible for third-party provider decisions, payment delays, or reward reversals outside our control.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. CHANGES</h2>
            <p>We may update these Terms at any time. Continued use means you accept the changes. Major changes get 14 days notice via SMS or in-app.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">9. CONTACT</h2>
            <p>support@cashflawhubs.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
