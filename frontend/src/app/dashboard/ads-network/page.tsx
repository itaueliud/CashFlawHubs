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
        adsterraPopunderScriptSrc: resolveEnv(
          'NEXT_PUBLIC_ADSTERRA_POPUNDER_URL',
          'VITE_ADSTERRA_POPUNDER_URL'
        ),
        adsterraSmartlinkScriptSrc: resolveEnv(
          'NEXT_PUBLIC_ADSTERRA_SMARTLINK_URL',
          'VITE_ADSTERRA_SMARTLINK_URL'
        ),
        adsterraSocialBarScriptSrc: resolveEnv(
          'NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_URL',
          'VITE_ADSTERRA_SOCIAL_BAR_URL'
        ),
        monetagOnclickZoneId: resolveEnv('NEXT_PUBLIC_ADS_POPUNDER_ZONE_ID'),
        monetagOnclickScriptSrc: resolveEnv('NEXT_PUBLIC_ADS_POPUNDER_SCRIPT_SRC'),
        monetagInpageZoneId: resolveEnv('NEXT_PUBLIC_ADS_INPAGE_ZONE_ID'),
        monetagInpageScriptSrc: resolveEnv('NEXT_PUBLIC_ADS_INPAGE_SCRIPT_SRC'),
      }}
    />
  );
}
