'use client';

import { createContext, useContext } from 'react';

const NonceContext = createContext<string | null>(null);

type NonceProviderProps = {
  nonce?: string | null;
  children: React.ReactNode;
};

export function NonceProvider({ nonce, children }: NonceProviderProps) {
  return <NonceContext.Provider value={nonce ?? null}>{children}</NonceContext.Provider>;
}

export function useNonce() {
  return useContext(NonceContext);
}