// Minimal Stripe REST client + webhook signature check for Workers (no Node SDK).
const STRIPE_API = 'https://api.stripe.com/v1';
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export class StripeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Form-encode nested params the way Stripe expects: a[b][0][c]=v. */
export function formEncode(params: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === 'object') out.push(...formEncode(value as Record<string, unknown>, name));
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
  }
  return out;
}

export async function stripePost<T = Record<string, unknown>>(secretKey: string, path: string, params: Record<string, unknown>, idempotencyKey: string): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': idempotencyKey,
      'Stripe-Version': '2025-03-31.basil',
    },
    body: formEncode(params).join('&'),
  });
  const data = await response.json().catch(() => ({})) as { error?: { message?: string } } & T;
  // Never log or return the request body/secret; only the status and Stripe's error type.
  if (!response.ok) throw new StripeError(response.status, `Stripe request failed (HTTP ${response.status})`);
  return data;
}

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a Stripe-Signature header (t=<unix>,v1=<hex hmac>[,v1=...]).
 * HMAC-SHA256 over `${t}.${rawBody}` keyed with the endpoint secret (whsec_...).
 */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string,
  nowSeconds = Math.floor(Date.now() / 1000), tolerance = SIGNATURE_TOLERANCE_SECONDS): Promise<boolean> {
  if (!header || !secret) return false;
  let timestamp = '';
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2).map(s => s?.trim());
    if (k === 't') timestamp = v || '';
    else if (k === 'v1' && v) signatures.push(v.toLowerCase());
  }
  if (!/^\d{1,12}$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > tolerance) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  return signatures.some(sig => timingSafeEqual(sig, expected));
}
