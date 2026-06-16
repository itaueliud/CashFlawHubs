import AdsNetworkClient from './AdsNetworkClient';

const resolveEnv = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
};

export default function AdsNetworkPage() {
  return (
    <AdsNetworkClient
      scriptUrls={{
        popunder: resolveEnv('NEXT_PUBLIC_ADSTERRA_POPUNDER_URL', 'VITE_ADSTERRA_POPUNDER_URL'),
        smartlink: resolveEnv('NEXT_PUBLIC_ADSTERRA_SMARTLINK_URL', 'VITE_ADSTERRA_SMARTLINK_URL'),
        socialBar: resolveEnv('NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_URL', 'VITE_ADSTERRA_SOCIAL_BAR_URL'),
      }}
    />
  );
}
