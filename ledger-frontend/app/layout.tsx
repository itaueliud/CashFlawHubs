import './globals.css';
import React from 'react';
import { Toaster } from 'react-hot-toast';

export const metadata = { title: 'CashFlowHubs Ledger', robots: 'noindex, nofollow' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body
        className="dashboard-shell ledger-app"
        style={{
          margin: 0,
          minHeight: '100vh',
          color: '#e2e8f0',
          fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial',
        }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
