// Catalog cross-identifications for the built-in bright-star list (Hipparcos +
// Henry Draper numbers, checked against HYG v4.1 proper names). Bright stars are
// mostly saturated in Gaia, so these use hip: keys. Planets and the Pleiades
// cluster marker have no stable star ID and are deliberately not claimable.
import { starKey } from './starKey.js';

export const BRIGHT_STAR_IDS = {
  'sirius': { hip: 32349, hd: 48915 },
  'canopus': { hip: 30438, hd: 45348 },
  'arcturus': { hip: 69673, hd: 124897 },
  'vega': { hip: 91262, hd: 172167 },
  'capella': { hip: 24608, hd: 34029 },
  'rigel': { hip: 24436, hd: 34085 },
  'procyon': { hip: 37279, hd: 61421 },
  'betelgeuse': { hip: 27989, hd: 39801 },
  'altair': { hip: 97649, hd: 187642 },
  'aldebaran': { hip: 21421, hd: 29139 },
  'spica': { hip: 65474, hd: 116658 },
  'antares': { hip: 80763, hd: 148478 },
  'pollux': { hip: 37826, hd: 62509 },
  'fomalhaut': { hip: 113368, hd: 216956 },
  'deneb': { hip: 102098, hd: 197345 },
  'regulus': { hip: 49669, hd: 87901 },
  'polaris': { hip: 11767, hd: 8890 },
  'castor': { hip: 36850, hd: 60179 },
  'bellatrix': { hip: 25336, hd: 35468 },
  'elnath': { hip: 25428, hd: 35497 },
  'miaplacidus': { hip: 45238, hd: 80007 },
  'alnilam': { hip: 26311, hd: 37128 },
  'alnitak': { hip: 26727, hd: 37742 },
  'alioth': { hip: 62956, hd: 112185 },
  'dubhe': { hip: 54061, hd: 95689 },
  'mirfak': { hip: 15863, hd: 20902 },
  'wezen': { hip: 34444, hd: 54605 },
  'kaus-australis': { hip: 90185, hd: 169022 },
  'avior': { hip: 41037, hd: 71129 },
  'alkaid': { hip: 67301, hd: 120315 },
};

/** Stable key for a built-in catalog slug, or null when it is not claimable. */
export const brightStarKey = slug => (Object.hasOwn(BRIGHT_STAR_IDS, slug) ? starKey(BRIGHT_STAR_IDS[slug]) : null);
