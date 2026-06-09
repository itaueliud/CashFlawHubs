export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-4">
            Legal
          </div>
          <h1 className="text-3xl font-black">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-400">Last Updated: June 9, 2025</p>
        </div>
        <div className="space-y-8 text-sm leading-7 text-slate-300">

          <section>
            <h2 className="text-base font-bold text-white mb-2">1. What We Collect</h2>
            <ul className="space-y-1 text-slate-400">
              <li>• Your phone number, name, and country</li>
              <li>• Payment and transaction records</li>
              <li>• Device info and IP address (for fraud prevention)</li>
              <li>• Activity on the platform (tasks completed, surveys done, referrals)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. Why We Collect It</h2>
            <ul className="space-y-1 text-slate-400">
              <li>• To run your account and process payments</li>
              <li>• To credit and pay out your earnings</li>
              <li>• To detect and prevent fraud</li>
              <li>• To send you OTPs and important account notifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. Who We Share It With</h2>
            <p>We do not sell your data. We share only what is necessary:</p>
            <ul className="mt-2 space-y-1 text-slate-400">
              <li>• Payment providers (M-Pesa, MTN, Flutterwave, etc.) to process withdrawals</li>
              <li>• Survey and offerwall partners (CPX Research, AdGate, etc.) — they receive your user ID and country only</li>
              <li>• Our hosting infrastructure (AWS, MongoDB Atlas, Vercel, Cloudflare)</li>
              <li>• Law enforcement if legally required</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. How Long We Keep It</h2>
            <ul className="space-y-1 text-slate-400">
              <li>• Account data: until you close your account + 2 years</li>
              <li>• Transaction records: 5 years (legal requirement)</li>
              <li>• IP and device logs: 12 months</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">5. Your Rights</h2>
            <p>You can at any time request a copy of your data, ask us to correct inaccurate data, request account deletion, or ask for your transaction history in CSV or JSON.</p>
            <p className="mt-2 text-slate-400">Email: privacy@cashflawhubs.com — we respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">6. Security</h2>
            <p>All data is encrypted in transit. Passwords are hashed. Every postback from survey providers is verified before we credit anything. We use device fingerprinting and IP tracking to protect your account.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">7. Children</h2>
            <p>The platform is for adults only (18+). We do not knowingly collect data from minors.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">8. Changes</h2>
            <p>We will notify you of major changes via SMS or in-app at least 14 days before they take effect.</p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">9. Contact</h2>
            <p className="text-slate-400">privacy@cashflawhubs.com</p>
          </section>

        </div>
      </div>
    </div>
  );
}
