import Link from 'next/link';
import { ArrowRight, CheckCircle, DollarSign, Globe, Shield, Star, TrendingUp, Users, Zap } from 'lucide-react';

const EARN_METHODS = [
  { icon: 'Ã°Å¸â€œâ€¹', title: 'Paid Surveys', desc: 'Share your opinion and earn up to $3 per survey', color: 'from-blue-500 to-blue-600' },
  { icon: 'Ã¢Å¡Â¡', title: 'Microtasks', desc: 'Quick tasks: labeling, testing, tagging', color: 'from-yellow-500 to-yellow-600' },
  { icon: 'Ã°Å¸â€™Â¼', title: 'Remote Jobs', desc: 'Find legitimate remote jobs across Africa', color: 'from-purple-500 to-purple-600' },
  { icon: 'Ã°Å¸Å½Â¯', title: 'Offerwalls', desc: 'Install apps and complete offers for rewards', color: 'from-pink-500 to-pink-600' },
  { icon: 'Ã°Å¸â€ºÂ Ã¯Â¸Â', title: 'Freelance Gigs', desc: 'Sell your skills to clients globally', color: 'from-orange-500 to-orange-600' },
  { icon: 'Ã°Å¸â€˜Â¥', title: 'Referrals', desc: 'Earn 200 KES for every friend you invite', color: 'from-green-500 to-green-600' },
];

const COUNTRIES = [
  { flag: 'Ã°Å¸â€¡Â°Ã°Å¸â€¡Âª', name: 'Kenya', payment: 'M-Pesa' },
  { flag: 'Ã°Å¸â€¡ÂºÃ°Å¸â€¡Â¬', name: 'Uganda', payment: 'MTN MoMo' },
  { flag: 'Ã°Å¸â€¡Â¹Ã°Å¸â€¡Â¿', name: 'Tanzania', payment: 'Vodacom' },
  { flag: 'Ã°Å¸â€¡ÂªÃ°Å¸â€¡Â¹', name: 'Ethiopia', payment: 'Telebirr' },
  { flag: 'Ã°Å¸â€¡Â¬Ã°Å¸â€¡Â­', name: 'Ghana', payment: 'Flutterwave' },
  { flag: 'Ã°Å¸â€¡Â³Ã°Å¸â€¡Â¬', name: 'Nigeria', payment: 'Flutterwave' },
];

const TESTIMONIALS = [
  { name: 'Mercy W.', location: 'Nairobi, Kenya', text: 'I earned KSh 4,500 in my first week just from surveys and tasks. The M-Pesa withdrawal was instant!', stars: 5 },
  { name: 'David O.', location: 'Kampala, Uganda', text: 'Found a remote writing job through CashFlowHubs. Changed my life completely.', stars: 5 },
  { name: 'Amina S.', location: 'Dar es Salaam, TZ', text: 'The referral system is amazing. I\'ve earned over $50 just by inviting friends.', stars: 5 },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center font-bold text-sm">C</div>
            <span className="font-bold text-lg">CashFlowHubs</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-outline text-sm py-2 px-4">Login</Link>
            <Link href="/register" className="btn-primary text-sm py-2 px-4">Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-20 pb-32 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 via-transparent to-blue-900/10 pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-1.5 text-sm text-green-400 mb-6">
            <Zap size={14} /> Available in 6 African Countries
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            Earn Money Online<br />
            <span className="text-green-400">From Africa</span>
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Surveys Ã‚Â· Tasks Ã‚Â· Remote Jobs Ã‚Â· Offerwalls Ã‚Â· Freelance<br />
            Withdraw via M-Pesa, MTN MoMo, and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary text-lg py-4 px-8 flex items-center gap-2 justify-center">
              Start Earning Free <ArrowRight size={20} />
            </Link>
            <Link href="#how-it-works" className="btn-outline text-lg py-4 px-8">
              How It Works
            </Link>
          </div>
          <p className="text-slate-500 text-sm mt-4">No credit card required Ã‚Â· Withdraw from KSh 200</p>

          <div className="grid grid-cols-3 gap-4 mt-16 max-w-2xl mx-auto">
            {[
              { label: 'Active Earners', value: '12,400+' },
              { label: 'Paid Out', value: '$84,000+' },
              { label: 'Avg. Daily Earn', value: '$1.80' },
            ].map((s) => (
              <div key={s.label} className="card text-center py-4">
                <div className="text-2xl font-black text-green-400">{s.value}</div>
                <div className="text-xs text-slate-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-slate-400 text-center mb-12">3 simple steps to start earning</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Register', desc: 'Sign up with your phone number in 2 minutes. No paperwork.', icon: Users },
              { step: '02', title: 'Complete Tasks', desc: 'Surveys, microtasks, offerwalls, or browse remote jobs.', icon: CheckCircle },
              { step: '03', title: 'Withdraw', desc: 'Cash out via M-Pesa, MTN MoMo, or bank. Minimum KSh 200.', icon: DollarSign },
            ].map((item) => (
              <div key={item.step} className="card text-center relative overflow-hidden">
                <div className="absolute top-3 right-4 text-6xl font-black text-slate-700/50">{item.step}</div>
                <item.icon className="text-green-400 mx-auto mb-3" size={32} />
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Ways to Earn</h2>
          <p className="text-slate-400 text-center mb-12">Multiple income streams, one platform</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {EARN_METHODS.map((m) => (
              <div key={m.title} className="card hover:border-green-500/50 transition-all group cursor-pointer">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                  {m.icon}
                </div>
                <h3 className="font-bold text-lg mb-1">{m.title}</h3>
                <p className="text-slate-400 text-sm">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-slate-900/50">
        <div className="max-w-4xl mx-auto text-center">
          <Globe className="text-green-400 mx-auto mb-4" size={40} />
          <h2 className="text-3xl font-bold mb-4">Available Across Africa</h2>
          <p className="text-slate-400 mb-10">Withdraw in your local currency via your preferred payment method</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {COUNTRIES.map((c) => (
              <div key={c.name} className="card flex items-center gap-3">
                <span className="text-3xl">{c.flag}</span>
                <div className="text-left">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-green-400">{c.payment}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">What Earners Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="card">
                <div className="flex gap-1 mb-3">
                  {Array(t.stars).fill(0).map((_, i) => (
                    <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm mb-4">"{t.text}"</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.location}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 bg-gradient-to-br from-green-900/30 to-slate-900">
        <div className="max-w-2xl mx-auto text-center">
          <TrendingUp className="text-green-400 mx-auto mb-4" size={48} />
          <h2 className="text-4xl font-black mb-4">Ready to Start Earning?</h2>
          <p className="text-slate-400 mb-8">Join 12,000+ Africans already earning on CashFlowHubs</p>
          <Link href="/register" className="btn-primary text-lg py-4 px-10 inline-flex items-center gap-2">
            Create Free Account <ArrowRight size={20} />
          </Link>
          <p className="text-slate-500 text-xs mt-4 flex items-center justify-center gap-2">
            <Shield size={12} /> Secure Ã‚Â· Verified Ã‚Â· Real Payments
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 px-4 text-center text-slate-500 text-sm">
        <p>Ã‚Â© 2025 CashFlowHubs. Built for Africa.</p>
      </footer>
    </div>
  );
}

