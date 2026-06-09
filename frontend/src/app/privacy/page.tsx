export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-4xl space-y-8 rounded-[2rem] border border-white/10 bg-slate-900/50 p-6 md:p-12">
        <div className="mb-8">
          <h1 className="text-3xl font-black">CASHFLAWHUBS – PRIVACY POLICY</h1>
          <p className="mt-2 text-sm text-slate-400">Last Updated: June 9, 2025</p>
        </div>
        <div className="prose prose-invert max-w-none text-sm text-slate-300">
          <p>CashFlawHubs values your privacy. This policy outlines how we handle your data:</p>
          <ul className="list-disc space-y-2 pl-4">
            <li><strong>Data Collection:</strong> We collect necessary data (name, email, phone, location) for account creation and payment processing.</li>
            <li><strong>Data Usage:</strong> We use your data to match you with opportunities and facilitate withdrawals. We do not sell your personal data to third parties.</li>
            <li><strong>Security:</strong> All sensitive data is encrypted using industry-standard protocols.</li>
            <li><strong>Cookies:</strong> We use cookies to keep you logged in and track referral links.</li>
            <li><strong>Data Deletion:</strong> You may request account deletion at any time by contacting support.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
