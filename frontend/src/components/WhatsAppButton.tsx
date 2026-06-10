'use client';

import { useEffect, useState } from 'react';

export function WhatsAppButton({
  phoneNumber,
  message = 'Hi CashFlowHubs, I need help with my account.',
}: {
  phoneNumber: string;
  message?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Chat with CashFlowHubs on WhatsApp"
      className={`fixed bottom-6 right-5 z-50 flex items-center gap-2.5 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-2xl transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
        <path d="M16 3C8.82 3 3 8.82 3 16c0 2.34.63 4.55 1.72 6.46L3 29l6.72-1.7A13 13 0 0 0 16 29c7.18 0 13-5.82 13-13S23.18 3 16 3zm0 23.7a10.7 10.7 0 0 1-5.44-1.48l-.39-.23-4 1.02 1.04-3.88-.25-.4A10.67 10.67 0 0 1 5.3 16c0-5.93 4.77-10.7 10.7-10.7S26.7 10.07 26.7 16 21.93 26.7 16 26.7zm5.87-7.98c-.32-.16-1.9-.94-2.2-1.05-.3-.1-.51-.16-.72.16-.22.32-.84 1.05-1.03 1.27-.19.22-.38.24-.7.08-.32-.16-1.35-.5-2.57-1.59-.95-.85-1.6-1.9-1.78-2.22-.19-.32-.02-.5.14-.66.14-.14.32-.37.48-.55.16-.18.22-.32.32-.53.11-.22.06-.4-.02-.56-.08-.16-.72-1.74-.99-2.38-.26-.63-.52-.54-.72-.55h-.61c-.21 0-.56.08-.85.4-.3.32-1.13 1.1-1.13 2.68s1.16 3.1 1.32 3.32c.16.21 2.28 3.47 5.52 4.87.77.33 1.37.53 1.84.68.77.24 1.48.21 2.03.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.3-.21-.62-.37z" />
      </svg>
      Chat on WhatsApp
    </a>
  );
}
