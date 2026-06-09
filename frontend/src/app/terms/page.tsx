export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-4">
            Legal
          </div>
          <h1 className="text-3xl font-black">Terms and Conditions</h1>
          <p className="mt-2 text-sm text-slate-400">Last Updated: June 9, 2025</p>
        </div>
        <div className="space-y-8 text-sm leading-7 text-slate-300">

          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Who Can Join</h2>
            <p>You must be at least 18 years old and a resident of Kenya, Uganda, Tanzania, Ethiopia, Ghana, or Nigeria. One account per person — no exceptions.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. Activation Fee</h2>
            <p>To start earning, you pay a one-time non-refundable activation fee:</p>
            <ul className="mt-2 space-y-1 text-slate-400 list-none">
              <li>Kenya: <span className="text-white">KSh 500</span> via M-Pesa</li>
              <li>Uganda: <span className="text-white">USh 16,650</span> via MTN MoMo</li>
              <li>Tanzania: <span className="text-white">TSh 11,500</span> via Vodacom M-Pesa</li>
              <li>Ethiopia: <span className="text-white">Br 2,250</span> via Telebirr</li>
              <li>Ghana: <span className="text-white">GH₵ 18</span> via Flutterwave</li>
              <li>Nigeria: <span className="text-white">₦ 6,500</span> via Flutterwave / Paystack</li>
            </ul>
            <p className="mt-2">This fee covers your account setup and is split between the platform and your referrer. It is not a deposit and is not refundable.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. How You Earn</h2>
            <p>You earn through surveys, microtasks, offerwalls, remote jobs, freelance gigs, and referrals. Earning opportunities depend on third-party providers and are not guaranteed. For every person you refer who activates, you earn KSh 200 or local equivalent.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Your Rewards</h2>
            <p>All rewards go to a Pending Balance first. After 48 hours of verification they move to your Available Balance. If a reward is reversed by a provider, it is removed from your balance. We do not pay out unverified rewards.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">5. Withdrawals</h2>
            <p>Minimum withdrawal is KSh 200 or local equivalent. Payouts go to the mobile money number you registered with — no third-party accounts. Supported: M-Pesa, MTN MoMo, Telebirr, Vodacom, Flutterwave, Paystack.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">6. What Gets You Banned</h2>
            <ul className="space-y-1 text-slate-400">
              <li>• Multiple accounts</li>
              <li>• Bots or automated tools</li>
              <li>• VPNs or fake locations</li>
              <li>• Referral abuse or self-referral</li>
              <li>• Fake survey or task completions</li>
              <li>• Selling or sharing your account</li>
            </ul>
            <p className="mt-2">Banned accounts forfeit all balances.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">7. Our Liability</h2>
            <p>We do not guarantee earnings. The platform is provided as-is. We are not responsible for third-party provider decisions, payment delays, or reward reversals outside our control.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">8. Changes</h2>
            <p>We may update these Terms at any time. Continued use means you accept the changes. Major changes get 14 days notice via SMS or in-app.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">9. Contact</h2>
            <p className="text-slate-400">support@cashflawhubs.com</p>
          </section>

        </div>
      </div>
    </div>
  );
}
