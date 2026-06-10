'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useNonce } from './NonceProvider';

type TurnstileRenderOptions = {
  sitekey: string;
  theme: 'light' | 'dark' | 'auto';
  size: 'normal' | 'compact' | 'invisible';
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
  retry: 'auto' | 'never';
  'retry-interval': number;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: TurnstileRenderOptions) => string;
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

// Renders nothing on the server, only mounts on the client — eliminates all hydration mismatches
function TurnstileWidgetInner({ siteKey, onToken, onExpire, onError, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const renderedWidgetId = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const nonce = useNonce();

  // Keep callbacks in refs so the render effect doesn't re-run on every parent render
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onTokenRef.current = onToken;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
  }, [onToken, onExpire, onError]);

  useEffect(() => {
    isMountedRef.current = true;
    // If the script was loaded in a previous render cycle, mark ready immediately
    if (window.turnstile) setScriptReady(true);
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!scriptReady || !siteKey || !containerRef.current || !window.turnstile || renderedWidgetId.current) {
      return;
    }

    const renderWidget = () => {
      if (!isMountedRef.current || !containerRef.current || !window.turnstile || renderedWidgetId.current) return;
      try {
        renderedWidgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          size: 'normal',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onExpireRef.current?.(),
          'error-callback': () => {
            onErrorRef.current?.();
            setRenderError(true);
          },
          retry: 'auto',
          'retry-interval': 8000,
        });
        setRenderError(false);
        retryCountRef.current = 0;
      } catch (error) {
        console.error('Turnstile render error:', error);
        setRenderError(true);
        if (retryCountRef.current < 3) {
          retryCountRef.current++;
          retryTimeoutRef.current = setTimeout(renderWidget, Math.pow(2, retryCountRef.current) * 1000);
        }
      }
    };

    renderWidget();

    return () => {
      if (renderedWidgetId.current && window.turnstile?.remove) {
        try { window.turnstile.remove(renderedWidgetId.current); } catch {}
      }
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      renderedWidgetId.current = null;
    };
  }, [scriptReady, siteKey]);

  return (
    <div className={className}>
      <Script
        id="cloudflare-turnstile-api"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
        nonce={nonce || undefined}
        onLoad={() => setScriptReady(true)}
        onError={() => setRenderError(true)}
      />
      {renderError && (
        <p className="text-red-400 text-xs text-center py-1">
          Verification failed to load. Retrying…
        </p>
      )}
      {/* Use ref-based rendering only — no id= attribute to avoid SSR/client mismatch */}
      <div ref={containerRef} />
    </div>
  );
}

// Hard client-only gate: renders null on server, mounts widget only after hydration
export function TurnstileWidget(props: TurnstileWidgetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!props.siteKey || !mounted) return null;

  return <TurnstileWidgetInner {...props} />;
}
