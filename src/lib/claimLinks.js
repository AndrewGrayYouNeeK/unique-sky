import { PUBLIC_SITE } from './dedication.js';

// Naming is always bought on the website (Stripe Checkout), never through
// StoreKit / in-app purchase. Inside a wrapped app (capacitor://, file://) the
// link opens stars.youneek.xyz in the system browser instead.
export function claimUrl(ref) {
  const path = `/claim?star=${encodeURIComponent(ref)}`;
  const onWeb = typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol);
  return onWeb ? `${window.location.origin}${path}` : `${PUBLIC_SITE}${path}`;
}

export function openClaimPage(star) {
  const ref = star?.star_key || star?.hip_id || star?.id;
  if (!ref) return;
  const url = claimUrl(ref);
  if (url.startsWith(window.location.origin)) window.location.assign(url);
  else window.open(url, '_blank', 'noopener');
}
