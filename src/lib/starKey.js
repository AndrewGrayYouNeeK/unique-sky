// Multi-identifier star model + stable star keys. Standalone (no app imports) so the
// checkout/claims branch (feat/web-checkout-claims) can import it without pulling in the sky view.
//
// Every star may carry: gaia_source_id (preferred), hip, hd, tycho, hr, bayer, flamsteed,
// iau_name, common_name. The stable key is derived from the strongest catalog id present:
//   gaia:<source_id>  >  hip:<n>  >  tyc:<a-b-c>  >  hd:<n>  >  hr:<n>  >  hyg:<n>
// Non-stellar targets (the Pleiades marker) use their own catalog: mel:<n> / m:<n>.
// The real/official name (iau_name/common_name) is immutable; a claim only adds an edition
// name on top of it and never replaces it.

const positiveInt = v => (v === null || v === undefined || v === '' ? null : (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null));

export function starKey(ids = {}) {
  if (ids.gaia_source_id) return `gaia:${String(ids.gaia_source_id)}`;
  const hip = positiveInt(ids.hip); if (hip) return `hip:${hip}`;
  if (ids.tycho) return `tyc:${String(ids.tycho)}`;
  const hd = positiveInt(ids.hd); if (hd) return `hd:${hd}`;
  const hr = positiveInt(ids.hr); if (hr) return `hr:${hr}`;
  const mel = positiveInt(ids.mel); if (mel) return `mel:${mel}`;
  const messier = positiveInt(ids.messier); if (messier) return `m:${messier}`;
  const hyg = positiveInt(ids.hyg); if (hyg) return `hyg:${hyg}`;
  return null;
}

export function parseStarKey(key) {
  const m = /^(gaia|hip|tyc|hd|hr|mel|m|hyg):(.+)$/.exec(key || '');
  return m ? { catalog: m[1], id: m[2] } : null;
}

// Identifiers for the original curated star ids. Claims and hunts in D1 / localStorage still use
// these legacy ids today; LEGACY_STAR_IDS maps them onto stable keys for the rekey migration
// (see docs/star-keys.md). Values verified against HYG v4.1 by name, RA/Dec and magnitude.
export const LEGACY_STAR_IDS = {
  pleiades: { kind: "cluster", mel: 22, messier: 45, common_name: "Pleiades", iau_name: null },
  sirius: { hip: 32349, hd: 48915, hr: 2491, bayer: "α CMa", flamsteed: "9 CMa", iau_name: "Sirius" },
  canopus: { hip: 30438, hd: 45348, hr: 2326, bayer: "α Car", flamsteed: null, iau_name: "Canopus" },
  arcturus: { hip: 69673, hd: 124897, hr: 5340, bayer: "α Boo", flamsteed: "16 Boo", iau_name: "Arcturus" },
  vega: { hip: 91262, hd: 172167, hr: 7001, bayer: "α Lyr", flamsteed: "3 Lyr", iau_name: "Vega" },
  capella: { hip: 24608, hd: 34029, hr: 1708, bayer: "α Aur", flamsteed: "13 Aur", iau_name: "Capella" },
  rigel: { hip: 24436, hd: 34085, hr: 1713, bayer: "β Ori", flamsteed: "19 Ori", iau_name: "Rigel" },
  procyon: { hip: 37279, hd: 61421, hr: 2943, bayer: "α CMi", flamsteed: "10 CMi", iau_name: "Procyon" },
  betelgeuse: { hip: 27989, hd: 39801, hr: 2061, bayer: "α Ori", flamsteed: "58 Ori", iau_name: "Betelgeuse" },
  altair: { hip: 97649, hd: 187642, hr: 7557, bayer: "α Aql", flamsteed: "53 Aql", iau_name: "Altair" },
  aldebaran: { hip: 21421, hd: 29139, hr: 1457, bayer: "α Tau", flamsteed: "87 Tau", iau_name: "Aldebaran" },
  spica: { hip: 65474, hd: 116658, hr: 5056, bayer: "α Vir", flamsteed: "67 Vir", iau_name: "Spica" },
  antares: { hip: 80763, hd: 148478, hr: 6134, bayer: "α Sco", flamsteed: "21 Sco", iau_name: "Antares" },
  pollux: { hip: 37826, hd: 62509, hr: 2990, bayer: "β Gem", flamsteed: "78 Gem", iau_name: "Pollux" },
  fomalhaut: { hip: 113368, hd: 216956, hr: 8728, bayer: "α PsA", flamsteed: "24 PsA", iau_name: "Fomalhaut" },
  deneb: { hip: 102098, hd: 197345, hr: 7924, bayer: "α Cyg", flamsteed: "50 Cyg", iau_name: "Deneb" },
  regulus: { hip: 49669, hd: 87901, hr: 3982, bayer: "α Leo", flamsteed: "32 Leo", iau_name: "Regulus" },
  polaris: { hip: 11767, hd: 8890, hr: 424, bayer: "α UMi", flamsteed: "1 UMi", iau_name: "Polaris" },
  castor: { hip: 36850, hd: 60179, hr: 2891, bayer: "α Gem", flamsteed: "66 Gem", iau_name: "Castor" },
  bellatrix: { hip: 25336, hd: 35468, hr: 1790, bayer: "γ Ori", flamsteed: "24 Ori", iau_name: "Bellatrix" },
  elnath: { hip: 25428, hd: 35497, hr: 1791, bayer: "β Tau", flamsteed: "112 Tau", iau_name: "Elnath" },
  miaplacidus: { hip: 45238, hd: 80007, hr: 3685, bayer: "β Car", flamsteed: null, iau_name: "Miaplacidus" },
  alnilam: { hip: 26311, hd: 37128, hr: 1903, bayer: "ε Ori", flamsteed: "46 Ori", iau_name: "Alnilam" },
  alnitak: { hip: 26727, hd: 37742, hr: 1948, bayer: "ζ Ori", flamsteed: "50 Ori", iau_name: "Alnitak" },
  alioth: { hip: 62956, hd: 112185, hr: 4905, bayer: "ε UMa", flamsteed: "77 UMa", iau_name: "Alioth" },
  dubhe: { hip: 54061, hd: 95689, hr: 4301, bayer: "α UMa", flamsteed: "50 UMa", iau_name: "Dubhe" },
  mirfak: { hip: 15863, hd: 20902, hr: 1017, bayer: "α Per", flamsteed: "33 Per", iau_name: "Mirfak" },
  wezen: { hip: 34444, hd: 54605, hr: 2693, bayer: "δ CMa", flamsteed: "25 CMa", iau_name: "Wezen" },
  "kaus-australis": { hip: 90185, hd: 169022, hr: 6879, bayer: "ε Sgr", flamsteed: "20 Sgr", iau_name: "Kaus Australis" },
  avior: { hip: 41037, hd: 71129, hr: 3307, bayer: "ε Car", flamsteed: null, iau_name: "Avior" },
  alkaid: { hip: 67301, hd: 120315, hr: 5191, bayer: "η UMa", flamsteed: "85 UMa", iau_name: "Alkaid" },
};

export function legacyIdToStarKey(legacyId) {
  const ids = LEGACY_STAR_IDS[legacyId];
  return ids ? starKey(ids) : null;
}

export const STAR_KEY_TO_LEGACY_ID = Object.fromEntries(
  Object.keys(LEGACY_STAR_IDS).map(id => [legacyIdToStarKey(id), id]),
);

// Display name: the real name always wins; the claim's edition name is shown alongside, never instead.
export function displayNames(star = {}, claim = null) {
  const real = star.iau_name || star.common_name || star.name || star.bayer || star.flamsteed
    || (star.hip ? `HIP ${star.hip}` : star.hd ? `HD ${star.hd}` : 'Unnamed star');
  return { real, edition: claim?.edition_name || claim?.owner_name || null };
}
<<<<<<< HEAD

// Claimable keys for website checkout (gaia|hip|hd only). Wider catalog keys still exist above.
const CLAIMABLE_KEY_PATTERN = /^(gaia|hip|hd):[1-9][0-9]{0,19}$/;
export const isStarKey = value => typeof value === 'string' && CLAIMABLE_KEY_PATTERN.test(value);
=======
>>>>>>> 442ed65 (Share starKey.js verbatim with feat/ar-zoom-density; claim keys limited to gaia/hip/hd)
