// Shared by the claim page and the Worker so client hints and server rules match.
// The server is authoritative; the client only uses this to show errors early.

export const DISCLAIMER = 'Star naming is symbolic only and is not recognized by the IAU or any official astronomical body.';
export const TIERS = {
  base: { label: 'Base', amount_cents: 1000, price: '$10' },
  premium: { label: 'Premium', amount_cents: 2000, price: '$20' },
};
export const OWNER_NAME_MAX = 40;
export const MYTH_MAX = 500;
export const PUBLIC_SITE = 'https://stars.youneek.xyz';

/** Edition label shown after the real name, which is never changed. */
export const editionLabel = owner => `Named by ${owner} – “Forever”`;
/** Full label: 'Sirius ★ Named by Alex – “Forever”'. */
export const starLabel = (realName, owner) => (owner ? `${realName} ★ ${editionLabel(owner)}` : realName);

// C0/C1 controls, zero-width, bidi overrides and BOM.
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;
const URLISH = /(https?:\/\/|www\.|[a-z0-9-]\.(com|net|org|io|xyz|dev|co|app|ly|gg|me|info|biz|ru|cn|tk|link|shop|site|online)\b|[^\s@]+@[^\s@]+\.[a-z]{2,})/i;
// Basic moderation only: slurs/obscenities as whole words (after light leetspeak folding).
const BLOCKED = new Set(['fuck', 'fucker', 'fucking', 'shit', 'cunt', 'nigger', 'nigga', 'faggot', 'bitch', 'whore', 'slut', 'rape', 'rapist', 'nazi', 'hitler', 'kike', 'spic', 'chink', 'retard', 'tranny', 'pussy', 'porn']);
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's', '!': 'i' };

export function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
}

function blocked(text) {
  const folded = text.toLowerCase().replace(/[0134578@$!]/g, c => LEET[c] || c);
  return folded.split(/[^a-z]+/).some(word => word && (BLOCKED.has(word) || BLOCKED.has(word.replace(/(s|es|ed|ing)$/, ''))));
}

function checkField(raw, label, max, required) {
  const value = cleanText(raw);
  if (!value) return required ? { value, error: `Enter a ${label}.` } : { value };
  if (value.length > max) return { value, error: `${label[0].toUpperCase()}${label.slice(1)} must be ${max} characters or fewer.` };
  if (URLISH.test(value)) return { value, error: `Links, emails and web addresses are not allowed in the ${label}.` };
  if (blocked(value)) return { value, error: `Please choose a different ${label}.` };
  return { value };
}

/**
 * @param {{tier?: unknown, owner_name?: unknown, custom_myth?: unknown}} input
 * @returns {{ok: boolean, errors: Record<string, string>, value: {tier: 'base'|'premium', owner_name: string, custom_myth: string}}}
 */
export function validateDedication(input = {}) {
  /** @type {Record<string, string>} */
  const errors = {};
  const tier = /** @type {'base'|'premium'} */ (input.tier === 'premium' ? 'premium' : 'base');
  if (input.tier !== 'base' && input.tier !== 'premium') errors.tier = 'Choose Base or Premium.';
  const owner = checkField(input.owner_name, 'name', OWNER_NAME_MAX, true);
  if (owner.error) errors.owner_name = owner.error;
  // Stories are a premium feature; a base claim never stores one.
  const myth = tier === 'premium' ? checkField(input.custom_myth ?? '', 'story', MYTH_MAX, false) : { value: '' };
  if (myth.error) errors.custom_myth = myth.error;
  return { ok: Object.keys(errors).length === 0, errors, value: { tier, owner_name: owner.value, custom_myth: myth.value } };
}
