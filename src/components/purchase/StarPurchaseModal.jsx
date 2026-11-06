import { useEffect, useState } from 'react';
import { X, Star, Crown } from 'lucide-react';
import { api, claimStar } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function StarPurchaseModal({ star, onClose, onSuccess }) {
  const { user } = useAuth();
  const [tier, setTier] = useState('base');
  const [name, setName] = useState(user?.full_name || '');
  const [claimMode, setClaimMode] = useState('loading');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    api.config().then(config => setClaimMode(config.claimMode)).catch(() => { setClaimMode('disabled'); setError('Could not connect to the API.'); });
  }, []);
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape' && !loading) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, loading]);
  if (!star) return null;
  const claim = async event => {
    event.preventDefault();
    setLoading(true); setError('');
    try {
      const result = await claimStar({ star_id: star.hip_id || star.id, buyer_name: name.trim(), tier });
      onSuccess?.(result.star);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  return <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4" onClick={() => !loading && onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="claim-title" className="glass-card rounded-2xl p-6 w-full max-w-lg relative max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <button aria-label="Close claim" disabled={loading} onClick={onClose} className="absolute right-4 top-4"><X size={20} /></button>
      <h2 id="claim-title" className="font-space text-xl text-star-gold mb-2">Name {star.name}</h2>
      <p className="text-sm text-muted-foreground mb-5">A symbolic dedication in the YouNeeK Stars catalog.</p>
      <form onSubmit={claim}>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {['base', 'premium'].map(value => <button key={value} type="button" aria-pressed={tier === value} onClick={() => setTier(value)} className={`p-4 rounded-xl border text-left ${tier === value ? 'border-star-gold bg-star-gold/10' : 'border-border'}`}>
            {value === 'base' ? <Star className="mb-2" /> : <Crown className="mb-2" />}<span className="capitalize">{value}</span><strong className="block text-star-gold">{value === 'base' ? '$10' : '$20'}</strong>
          </button>)}
        </div>
        <label htmlFor="dedication-name" className="block text-sm mb-2">Name shown on your star</label>
        <Input id="dedication-name" autoFocus required maxLength={40} value={name} onChange={e => setName(e.target.value)} />
        <p className="text-sm text-muted-foreground mt-4 mb-4">{claimMode === 'demo' ? 'Local demo only: no payment is collected. The claim is stored in your local development database, not the public sky.' : claimMode === 'loading' ? 'Checking availability…' : 'Paid claims are not enabled yet. No payment will be collected and no public claim will be created.'}</p>
        {error && <p role="alert" className="text-destructive mb-4">{error}</p>}
        <Button type="submit" disabled={loading || claimMode !== 'demo' || !name.trim()} className="w-full bg-star-gold text-background">{loading ? 'Claiming…' : claimMode === 'demo' ? `Create unpaid demo claim (${tier === 'base' ? '$10' : '$20'} tier)` : 'Paid claims unavailable'}</Button>
      </form>
      <p className="text-xs text-muted-foreground mt-4">Star naming in YouneeK Stars is symbolic only and is not recognized by the International Astronomical Union or any official astronomical body.</p>
    </section>
  </div>;
}
