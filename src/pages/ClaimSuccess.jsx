import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/api/apiClient';
import StarName from '@/components/claims/StarName';
import { DISCLAIMER } from '@/lib/dedication';

const POLL_MS = 2000;
const MAX_POLLS = 60; // ~2 minutes; Stripe webhooks normally land in seconds.

// Stripe redirects here after payment. The claim exists only once the verified
// webhook has written it, so this page polls the server instead of trusting the redirect.
export default function ClaimSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const [state, setState] = useState(/** @type {any} */ ({ status: 'waiting' }));

  useEffect(() => {
    if (!sessionId) { setState({ status: 'error', message: 'Missing checkout session.' }); return; }
    let polls = 0;
    let timer;
    const poll = () => api.checkout.session(sessionId).then(data => {
      if (data.status === 'pending' && ++polls < MAX_POLLS) { setState({ status: 'waiting', star_name: data.star_name }); timer = setTimeout(poll, POLL_MS); return; }
      setState(data.status === 'pending' ? { status: 'slow', star_name: data.star_name } : data);
    }).catch(err => {
      if (++polls < MAX_POLLS && err.status !== 400) { timer = setTimeout(poll, POLL_MS); return; }
      setState({ status: 'error', message: err.message });
    });
    poll();
    return () => clearTimeout(timer);
  }, [sessionId]);

  return (
    <div className="min-h-screen sky-gradient pb-24 pt-6 px-4">
      <section className="glass-card rounded-2xl p-6 max-w-lg mx-auto" aria-live="polite">
        {state.status === 'paid' && state.star ? <>
          <h1 className="font-space font-bold text-2xl mb-2">Your star is named</h1>
          <StarName as="p" name={state.star.name} owner={state.star.owner_name} className="text-lg mb-4" />
          <p className="text-sm text-muted-foreground mb-4">Everyone using YouNeeK Stars now sees this edition name.</p>
          <Link className="underline" to="/">Find it in the sky</Link>
        </> : state.status === 'refund_pending' || state.status === 'refunded' ? <>
          <h1 className="font-space font-bold text-2xl mb-2">This star was taken first</h1>
          <p className="text-sm">Someone else completed naming {state.star_name || 'this star'} just before you. Your payment is being refunded in full.</p>
          <Link className="underline block mt-4" to="/name-a-star">Choose another star</Link>
        </> : state.status === 'released' ? <>
          <h1 className="font-space font-bold text-2xl mb-2">Checkout expired</h1>
          <p className="text-sm">No claim was created. <Link className="underline" to="/name-a-star">Try again</Link>.</p>
        </> : state.status === 'error' ? <p role="alert" className="text-destructive">{state.message}</p>
          : <>
          <h1 className="font-space font-bold text-2xl mb-2">Confirming your payment…</h1>
          <p className="text-sm text-muted-foreground">{state.status === 'slow' ? 'This is taking longer than usual. Your payment is safe; refresh this page in a minute.' : `Waiting for Stripe to confirm${state.star_name ? ` your naming of ${state.star_name}` : ''}.`}</p>
        </>}
        <p className="text-xs text-muted-foreground mt-6">{DISCLAIMER}</p>
      </section>
    </div>
  );
}
