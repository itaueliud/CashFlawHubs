import AdsNetworkClient from './AdsNetworkClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
        popunderZoneId: resolveEnv('NEXT_PUBLIC_ADS_POPUNDER_ZONE_ID'),
        popunderScriptSrc: resolveEnv('NEXT_PUBLIC_ADS_POPUNDER_SCRIPT_SRC'),
        inpageZoneId: resolveEnv('NEXT_PUBLIC_ADS_INPAGE_ZONE_ID'),
        inpageScriptSrc: resolveEnv('NEXT_PUBLIC_ADS_INPAGE_SCRIPT_SRC'),
      }}
    />
  );
}
