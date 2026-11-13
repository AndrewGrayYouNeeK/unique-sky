import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Star, Crown, Lock, ExternalLink } from 'lucide-react';
import { api, claimStar } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StarName from '@/components/claims/StarName';
import { DISCLAIMER, MYTH_MAX, OWNER_NAME_MAX, TIERS, validateDedication } from '@/lib/dedication';

// Web claim page: https://stars.youneek.xyz/claim?star=<stable key or slug>.
// Payment happens on Stripe Checkout (never in-app purchase); the claim is only
// created by the verified webhook.
export default function Claim() {
  const [params] = useSearchParams();
  const ref = params.get('star') || '';
  const [star, setStar] = useState(null);
  const [mode, setMode] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [tier, setTier] = useState('base');
  const [ownerName, setOwnerName] = useState('');
  const [myth, setMyth] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ref) { setLoadError('Choose a star to name.'); return; }
    let live = true;
    Promise.all([api.config(), api.stars.get(ref)])
      .then(([config, data]) => { if (live) { setMode(config.claimMode); setStar(data); } })
      .catch(err => live && setLoadError(err.status === 404 ? 'That star is not in the catalog.' : err.message));
    return () => { live = false; };
  }, [ref]);

  const check = useMemo(() => validateDedication({ tier, owner_name: ownerName, custom_myth: myth }), [tier, ownerName, myth]);
  const showErrors = touched || ownerName.length > 0;

  const submit = async event => {
    event.preventDefault();
    setTouched(true); setSubmitError('');
    if (!check.ok || !star) return;
    setBusy(true);
    try {
      if (mode === 'stripe') {
        const { url } = await api.checkout.start({ star: star.star_key, ...check.value });
        window.location.assign(url); // Stripe-hosted Checkout
        return;
      }
      if (mode === 'demo') {
        const result = await claimStar({ star_id: star.star_key, buyer_name: check.value.owner_name, tier, custom_myth: check.value.custom_myth });
        setStar({ ...result.star, available: false });
      }
    } catch (err) { setSubmitError(err.message); }
    setBusy(false);
  };

  if (loadError) return <Shell><p role="alert" className="text-destructive">{loadError}</p><Link className="underline" to="/name-a-star">Browse stars</Link></Shell>;
  if (!star) return <Shell><div className="w-8 h-8 border-2 border-star-gold/30 border-t-star-gold rounded-full animate-spin" /></Shell>;

  const named = star.is_named && star.owner_name;
  return (
    <Shell>
      <p className="text-xs font-space uppercase tracking-widest text-muted-foreground mb-1">Name a Star</p>
      <StarName as="h1" name={star.name} owner={named ? star.owner_name : null} className="font-space font-bold text-2xl text-foreground block mb-1" />
      <p className="text-sm text-muted-foreground mb-5">{star.constellation} · mag {star.magnitude?.toFixed(2)}{star.star_key ? ` · ${star.star_key.toUpperCase().replace(':', ' ')}` : ''}</p>

      {named ? (
        <div className="rounded-xl bg-muted/50 border border-border p-4 flex items-center gap-2 text-sm">
          <Lock size={14} className="text-star-gold" /> This star has already been named. Each star has one edition name, shared by everyone.
        </div>
      ) : !star.claimable ? (
        <p className="text-sm">This sky object has no stable star catalog ID, so it cannot be named.</p>
      ) : star.checkout_pending ? (
        <p className="text-sm">Someone is checking out this star right now. Try again in about 30 minutes or choose another star.</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <fieldset className="grid grid-cols-2 gap-3 mb-5">
            <legend className="sr-only">Tier</legend>
            {Object.entries(TIERS).map(([value, info]) => (
              <button key={value} type="button" aria-pressed={tier === value} onClick={() => setTier(value)}
                className={`p-4 rounded-xl border text-left ${tier === value ? 'border-star-gold bg-star-gold/10' : 'border-border'}`}>
                {value === 'base' ? <Star className="mb-2" /> : <Crown className="mb-2" />}
                <span>{info.label}</span><strong className="block text-star-gold">{info.price}</strong>
                <span className="text-xs text-muted-foreground">{value === 'base' ? 'Edition name' : 'Edition name + your story'}</span>
              </button>
            ))}
          </fieldset>

          <label htmlFor="owner-name" className="block text-sm mb-2">Edition name (shown as “Named by …”)</label>
          <Input id="owner-name" required maxLength={OWNER_NAME_MAX} value={ownerName} onChange={e => setOwnerName(e.target.value)} onBlur={() => setTouched(true)}
            aria-invalid={showErrors && Boolean(check.errors.owner_name)} aria-describedby="owner-name-error" />
          <p id="owner-name-error" className="text-xs text-destructive min-h-4 mt-1">{showErrors ? check.errors.owner_name : ''}</p>

          {tier === 'premium' && <>
            <label htmlFor="custom-myth" className="block text-sm mt-3 mb-2">Your story (optional, {MYTH_MAX} characters max)</label>
            <textarea id="custom-myth" maxLength={MYTH_MAX} value={myth} onChange={e => setMyth(e.target.value)} rows={4}
              className="w-full rounded-md border border-input bg-transparent p-3 text-sm" aria-describedby="custom-myth-error" />
            <p id="custom-myth-error" className="text-xs text-destructive min-h-4 mt-1">{check.errors.custom_myth || ''}</p>
          </>}

          {check.ok && <p className="text-sm mt-3">Preview: <StarName name={star.name} owner={check.value.owner_name} /></p>}
          <p className="text-xs text-muted-foreground mt-3">The real name “{star.name}” never changes. One edition name per star, visible to everyone.</p>
          {mode === 'demo' && <p className="text-sm text-muted-foreground mt-3">Local demo only: no payment is collected.</p>}
          {mode === 'disabled' && <p className="text-sm text-muted-foreground mt-3">Paid naming is not open yet. No payment will be taken.</p>}
          {submitError && <p role="alert" className="text-destructive mt-3">{submitError}</p>}
          <Button type="submit" disabled={busy || mode === 'disabled' || mode === 'loading'} className="w-full mt-4 bg-star-gold text-background">
            {busy ? 'Opening checkout…' : mode === 'stripe' ? <>Continue to secure checkout · {TIERS[tier].price} <ExternalLink size={14} className="ml-2" /></>
              : mode === 'demo' ? `Create unpaid demo claim (${TIERS[tier].price} tier)` : 'Paid naming not open yet'}
          </Button>
        </form>
      )}
      <p className="text-xs text-muted-foreground mt-6" data-disclaimer>{DISCLAIMER}</p>
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen sky-gradient pb-24 pt-6 px-4"><section className="glass-card rounded-2xl p-6 max-w-lg mx-auto">{children}</section></div>;
}
