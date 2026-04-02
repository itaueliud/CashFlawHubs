import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CashflowConnect — Earn Money Online in Africa',
  description: 'Complete surveys, microtasks, and find remote jobs. Withdraw via M-Pesa, MTN MoMo, and more.',
  keywords: 'earn money online Kenya, paid surveys Africa, remote jobs Kenya, microtasks',
  openGraph: {
    title: 'CashflowConnect — Earn Money Online in Africa',
    description: 'Surveys, tasks, remote jobs. Withdraw via M-Pesa.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-950 text-white antialiased`}>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' },
              success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
