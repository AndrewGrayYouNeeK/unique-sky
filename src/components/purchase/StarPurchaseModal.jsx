import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Crown, Mic, Check, Lock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { getStarColorHex } from '@/lib/starData';

const TIERS = [
  {
    id: 'base',
    name: 'Star Claim',
    price: 10,
    priceLabel: '$10',
    icon: <Star size={20} />,
    color: 'text-star-gold',
    bgColor: 'bg-star-gold/10',
    borderColor: 'border-star-gold/30',
    features: [
      'Your name in AR for all users',
      'Exclusive ownership badge',
      'Star certificate (PDF)',
      'Visible on global sky map',
    ],
  },
  {
    id: 'premium',
    name: 'Premium Legend',
    price: 20,
    priceLabel: '$20',
    icon: <Crown size={20} />,
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
    borderColor: 'border-secondary/30',
    features: [
      'Everything in Star Claim',
      'Custom myth / story overlay',
      'Voice narration by AI',
      'Scarcity badge on map',
      'Priority global visibility',
    ],
    popular: true,
  },
];

export default function StarPurchaseModal({ star, onClose, onSuccess }) {
  const [selectedTier, setSelectedTier] = useState('premium');
  const [step, setStep] = useState('select'); // select | details | payment | success
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [customMyth, setCustomMyth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!star) return null;
  const colorHex = getStarColorHex(star.color || 'white');
  const tier = TIERS.find(t => t.id === selectedTier);

  const handlePurchase = async () => {
    if (!buyerName.trim() || !buyerEmail.trim()) {
      setError('Please fill in your name and email.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Claim star via backend function
      const res = await base44.functions.invoke('claimStar', {
        star_id: star.id,
        star_name: star.name,
        buyer_name: buyerName.trim(),
        buyer_email: buyerEmail.trim(),
        tier: selectedTier,
        custom_myth: selectedTier === 'premium' ? customMyth : '',
        amount_cents: tier.price * 100,
      });

      if (res.data?.success) {
        setStep('success');
        if (onSuccess) onSuccess({ ...star, owner_name: buyerName, is_named: true, ownership_tier: selectedTier });
      } else {
        setError(res.data?.error || 'This star has already been claimed. Please choose another.');
      }
    } catch (err) {
      setError('Purchase failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

        <motion.div
          className="relative w-full max-w-lg glass-card rounded-2xl overflow-hidden z-10"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 pb-4">
            <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at 30% 50%, ${colorHex}, transparent 70%)` }} />
            <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full" style={{ background: `radial-gradient(circle, ${colorHex}40 0%, transparent 70%)`, border: `1px solid ${colorHex}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="w-3 h-3 rounded-full" style={{ background: colorHex }} />
              </div>
              <div>
                <h2 className="font-space font-bold text-lg">Claim {star.name}</h2>
                <p className="text-muted-foreground text-sm">{star.constellation} · First come, first served</p>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            {step === 'select' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-sm text-muted-foreground mb-4 font-inter">
                  Your name will appear <span className="text-star-gold font-semibold">in AR for all users worldwide</span> who point their phone at this star. Forever.
                </p>

                {/* Tier cards */}
                <div className="space-y-3 mb-5">
                  {TIERS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTier(t.id)}
                      className={`w-full rounded-xl p-4 border text-left transition-all relative ${
                        selectedTier === t.id ? `${t.bgColor} ${t.borderColor}` : 'bg-muted/30 border-border/50 hover:border-border'
                      }`}
                    >
                      {t.popular && (
                        <span className="absolute top-3 right-3 text-xs bg-secondary/20 text-secondary border border-secondary/30 px-2 py-0.5 rounded-full font-space">
                          Most Popular
                        </span>
                      )}
                      <div className="flex items-center gap-3 mb-2">
                        <span className={t.color}>{t.icon}</span>
                        <span className="font-space font-semibold text-foreground">{t.name}</span>
                        <span className={`ml-auto font-space font-bold text-lg ${t.color}`}>{t.priceLabel}</span>
                      </div>
                      <ul className="space-y-1">
                        {t.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Check size={10} className={t.color} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>

                <Button
                  onClick={() => setStep('details')}
                  className="w-full bg-star-gold hover:bg-star-gold/90 text-background font-space font-semibold rounded-xl h-12 glow-gold"
                >
                  Continue with {tier.priceLabel}
                </Button>
              </motion.div>
            )}

            {step === 'details' && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <div>
                  <label className="text-xs font-space uppercase tracking-widest text-muted-foreground mb-2 block">Your Name (shown in AR)</label>
                  <Input
                    value={buyerName}
                    onChange={e => setBuyerName(e.target.value)}
                    placeholder="e.g. Andrew Chen"
                    className="bg-muted/50 border-border/50 font-space"
                    maxLength={40}
                  />
                </div>
                <div>
                  <label className="text-xs font-space uppercase tracking-widest text-muted-foreground mb-2 block">Email</label>
                  <Input
                    type="email"
                    value={buyerEmail}
                    onChange={e => setBuyerEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="bg-muted/50 border-border/50 font-inter"
                  />
                </div>

                {selectedTier === 'premium' && (
                  <div>
                    <label className="text-xs font-space uppercase tracking-widest text-muted-foreground mb-2 block flex items-center gap-1.5">
                      <Mic size={10} /> Your Star's Story (optional)
                    </label>
                    <Textarea
                      value={customMyth}
                      onChange={e => setCustomMyth(e.target.value)}
                      placeholder="Write a personal myth or story for this star... It will be narrated to anyone who taps it."
                      className="bg-muted/50 border-border/50 font-inter text-sm resize-none h-24"
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground mt-1 text-right">{customMyth.length}/500</p>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-3">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => setStep('select')} className="flex-1 border-border/50">Back</Button>
                  <Button
                    onClick={handlePurchase}
                    disabled={loading}
                    className="flex-1 bg-star-gold hover:bg-star-gold/90 text-background font-space font-semibold glow-gold"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                    ) : (
                      `Pay ${tier.priceLabel}`
                    )}
                  </Button>
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  Symbolic ownership · Not official astronomical naming · No refunds after claim
                </p>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-star-gold/20 border border-star-gold/40 flex items-center justify-center mb-4 glow-gold">
                  <Star size={36} className="text-star-gold" fill="currentColor" />
                </div>
                <h3 className="text-xl font-space font-bold text-foreground mb-2">
                  {star.name} is Yours!
                </h3>
                <p className="text-muted-foreground text-sm font-inter mb-1">
                  Your star is now claimed. Every user worldwide will see
                </p>
                <p className="text-star-gold font-space font-semibold text-base mb-5">
                  ★ Owned by {buyerName}
                </p>
                <div className="flex items-center justify-center gap-2 mb-4 text-xs text-muted-foreground">
                  <Lock size={12} /> <span>Permanently locked — no one else can claim it</span>
                </div>
                <Button onClick={onClose} className="bg-star-gold text-background font-space font-semibold rounded-xl px-8">
                  View in Sky
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}