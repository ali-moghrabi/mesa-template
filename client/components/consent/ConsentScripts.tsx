"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";
import { consentSnapshot, subscribeConsent } from "@/lib/consent";

type Props = {
  requireConsent: boolean;
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  metaPixelId?: string;
};

const noConsent = () => null;
const SAFE_ID = /^[A-Za-z0-9-]+$/;

export function ConsentScripts({
  requireConsent,
  googleAnalyticsId,
  googleTagManagerId,
  metaPixelId,
}: Props) {
  const consent = useSyncExternalStore(
    subscribeConsent,
    consentSnapshot,
    noConsent,
  );
  const ga =
    googleAnalyticsId && SAFE_ID.test(googleAnalyticsId)
      ? googleAnalyticsId
      : null;
  const gtm =
    googleTagManagerId && SAFE_ID.test(googleTagManagerId)
      ? googleTagManagerId
      : null;
  const pixel = metaPixelId && /^\d+$/.test(metaPixelId) ? metaPixelId : null;
  if (!ga && !gtm && !pixel) return null;

  const analytics = !requireConsent || consent?.analytics === true;
  const marketing = !requireConsent || consent?.marketing === true;
  const granted = (on: boolean) => (on ? "granted" : "denied");
  const consentMode = JSON.stringify({
    analytics_storage: granted(analytics),
    ad_storage: granted(marketing),
    ad_user_data: granted(marketing),
    ad_personalization: granted(marketing),
  });

  return (
    <>
      {(ga || gtm) && analytics && (
        <Script id="mesa-consent-mode" strategy="lazyOnload">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',${consentMode});`}
        </Script>
      )}

      {ga && analytics && (
        <>
          <Script
            id="mesa-ga"
            src={`https://www.googletagmanager.com/gtag/js?id=${ga}`}
            strategy="lazyOnload"
          />
          <Script id="mesa-ga-init" strategy="lazyOnload">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}',{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {gtm && analytics && (
        <Script id="mesa-gtm" strategy="lazyOnload">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}
        </Script>
      )}

      {pixel && marketing && (
        <Script id="mesa-meta-pixel" strategy="lazyOnload">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}
