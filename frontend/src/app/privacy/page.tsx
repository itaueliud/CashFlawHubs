export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-4xl space-y-8 rounded-[2rem] border border-white/10 bg-slate-900/50 p-6 md:p-12">
        <div className="mb-8">
          <h1 className="text-3xl font-black">CASHFLAWHUBS – PRIVACY POLICY</h1>
          <p className="mt-2 text-sm text-slate-400">Last Updated: June 9, 2025</p>
        </div>
        <div className="prose prose-invert max-w-none text-sm text-slate-300 space-y-6">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. WHAT WE COLLECT</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Your phone number, name, and country</li>
              <li>Payment and transaction records</li>
              <li>Device info and IP address (for fraud prevention)</li>
              <li>Activity on the platform (tasks completed, surveys done, referrals)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. WHY WE COLLECT IT</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>To run your account and process payments</li>
              <li>To credit and pay out your earnings</li>
              <li>To detect and prevent fraud</li>
              <li>To send you OTPs and important account notifications</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. WHO WE SHARE IT WITH</h2>
            <p>We do not sell your data. We share only what is necessary:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Payment providers (M-Pesa, MTN, Flutterwave, etc.) to process your withdrawals</li>
              <li>Survey and offerwall partners (CPX Research, AdGate, etc.) to load earning opportunities — they receive your user ID and country only</li>
              <li>Our hosting infrastructure (AWS, MongoDB Atlas, Vercel, Cloudflare)</li>
              <li>Law enforcement if legally required</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. HOW LONG WE KEEP IT</h2>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Account data: until you close your account + 2 years</li>
              <li>Transaction records: 5 years (legal requirement)</li>
              <li>IP and device logs: 12 months</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">5. YOUR RIGHTS</h2>
            <p>You can at any time:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Request a copy of your data</li>
              <li>Ask us to correct inaccurate data</li>
              <li>Request account and data deletion</li>
              <li>Ask for your transaction history in CSV or JSON</li>
            </ul>
            <p className="mt-2">Email: privacy@cashflawhubs.com — we respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">6. SECURITY</h2>
            <p>All data is encrypted in transit. Passwords are hashed. Every postback from survey providers is verified before we credit anything. We use device fingerprinting and IP tracking to protect your account.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">7. CHILDREN</h2>
            <p>The platform is for adults only (18+). We do not knowingly collect data from minors.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">8. CHANGES</h2>
            <p>We'll notify you of major changes via SMS or in-app at least 14 days before they take effect.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">9. CONTACT</h2>
            <p>privacy@cashflawhubs.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
