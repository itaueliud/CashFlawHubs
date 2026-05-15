'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: Record<string, any>) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
};

export function TurnstileWidget({ siteKey, onToken, onExpire, onError, className }: TurnstileWidgetProps) {
  const widgetId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderedWidgetId = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!scriptReady || !siteKey || !containerRef.current || !window.turnstile || renderedWidgetId.current) {
      return;
    }

    renderedWidgetId.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: 'dark',
      size: 'normal',
      callback: (token: string) => onToken(token),
      'expired-callback': () => {
        onExpire?.();
      },
      'error-callback': () => {
        onError?.();
      },
    });

    return () => {
      if (renderedWidgetId.current && window.turnstile?.remove) {
        window.turnstile.remove(renderedWidgetId.current);
      }
      renderedWidgetId.current = null;
    };
  }, [onError, onExpire, onToken, scriptReady, siteKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className={className}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div id={widgetId} ref={containerRef} />
    </div>
  );
}