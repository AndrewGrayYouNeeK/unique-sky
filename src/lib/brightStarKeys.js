// Claim keys for the built-in bright-star list.
// Identifiers come from src/lib/starKey.js, which is shared verbatim with
// feat/ar-zoom-density (multi-identifier star model). Andrew's claim rule: claims
// are keyed on gaia:<source_id>, else hip:<n>, else hd:<n>. Objects whose
// strongest ID is anything else (the Pleiades cluster marker -> mel:22, planets
// -> none) are not claimable.
import { LEGACY_STAR_IDS, legacyIdToStarKey } from './starKey.js';

const CLAIMABLE_KEY = /^(gaia|hip|hd):[1-9][0-9]{0,19}$/;
export const isClaimableStarKey = value => typeof value === 'string' && CLAIMABLE_KEY.test(value);

/** Stable claim key for a built-in catalog slug, or null when it is not claimable. */
export function brightStarKey(slug) {
  if (!Object.hasOwn(LEGACY_STAR_IDS, slug)) return null;
  const key = legacyIdToStarKey(slug);
  return isClaimableStarKey(key) ? key : null;
}
