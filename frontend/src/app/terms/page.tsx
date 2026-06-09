export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-4xl space-y-8 rounded-[2rem] border border-white/10 bg-slate-900/50 p-6 md:p-12">
        <div className="mb-8">
          <h1 className="text-3xl font-black">CASHFLAWHUBS – TERMS AND CONDITIONS</h1>
          <p className="mt-2 text-sm text-slate-400">Last Updated: June 9, 2025</p>
        </div>
        <div className="prose prose-invert max-w-none text-sm text-slate-300">
          <p>By using CashFlawHubs ("the Platform"), you agree to the following terms:</p>
          <ul className="list-disc space-y-2 pl-4">
            <li><strong>Eligibility:</strong> You must be at least 18 years old to register.</li>
            <li><strong>Accurate Information:</strong> You must provide truthful details during registration. Using VPNs or proxies to falsify location is prohibited.</li>
            <li><strong>Account Security:</strong> You are responsible for keeping your credentials safe.</li>
            <li><strong>Earnings and Withdrawals:</strong> Minimum withdrawal is 200 KES (or equivalent). Payments are processed via supported local methods (e.g., M-Pesa).</li>
            <li><strong>Prohibited Activity:</strong> Fraud, multi-accounting, and abuse of the referral system will result in a permanent ban and forfeiture of earnings.</li>
            <li><strong>Modifications:</strong> We reserve the right to update these terms at any time.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
