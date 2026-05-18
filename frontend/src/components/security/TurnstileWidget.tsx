'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Script from 'next/script';
import { useNonce } from './NonceProvider';

type TurnstileRenderOptions = {
  sitekey: string;
  theme: 'light' | 'dark' | 'auto';
  size: 'normal' | 'compact' | 'invisible';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
  'retry': 'auto' | 'never';
  'retry-interval': number;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      isReady?: boolean;
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
  const [renderError, setRenderError] = useState(false);
  const nonce = useNonce();
  const retryCountRef = useRef(0);
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onTokenRef.current = onToken;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
  }, [onError, onExpire, onToken]);

  useEffect(() => {
    if (!scriptReady || !siteKey || !containerRef.current || !window.turnstile || renderedWidgetId.current) {
      return;
    }

    try {
      renderedWidgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        size: 'normal',
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => {
          onExpireRef.current?.();
        },
        'error-callback': () => {
          onErrorRef.current?.();
        },
        'retry': 'auto',
        'retry-interval': 8000,
      });
      setRenderError(false);
      retryCountRef.current = 0;
    } catch (error) {
      console.error('Turnstile render error:', error);
      setRenderError(true);
      
      // Retry logic for transient errors
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        const retryDelay = Math.pow(2, retryCountRef.current) * 1000;
        setTimeout(() => {
          if (containerRef.current && window.turnstile) {
            try {
              renderedWidgetId.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                theme: 'dark',
                size: 'normal',
                callback: (token: string) => onTokenRef.current(token),
                'expired-callback': () => onExpireRef.current?.(),
                'error-callback': () => onErrorRef.current?.(),
                'retry': 'auto',
                'retry-interval': 8000,
              });
              setRenderError(false);
            } catch (retryError) {
              console.error(`Turnstile retry ${retryCountRef.current} failed:`, retryError);
            }
          }
        }, retryDelay);
      }
    }

    return () => {
      if (renderedWidgetId.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(renderedWidgetId.current);
        } catch (e) {
          console.warn('Error removing Turnstile widget:', e);
        }
      }
      renderedWidgetId.current = null;
    };
  }, [scriptReady, siteKey]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className={className}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        nonce={nonce || undefined}
        onLoad={() => setScriptReady(true)}
        onError={() => setRenderError(true)}
      />
      {renderError && (
        <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
          Error loading verification. Attempting to retry...
        </div>
      )}
      <div id={widgetId} ref={containerRef} />
    </div>
  );
}