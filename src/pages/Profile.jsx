import { useState, useEffect } from 'react';
import { Star, Trophy, Target } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/api/apiClient';
import { HUNTS } from '@/lib/hunts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import StarName from '@/components/claims/StarName';
import { DISCLAIMER } from '@/lib/dedication';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.profile.get().then(value => { setProfile(value); setName(value.name); })
      .catch(err => setError(err.message));
  }, [user]);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try { await updateProfile({ full_name: name.trim() }); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="min-h-screen sky-gradient pb-24 pt-6 px-4 max-w-3xl mx-auto">
      <h1 className="nebula-text font-space font-bold text-3xl mb-4">Your Universe</h1>
      {error && <p role="alert" className="text-destructive mb-4">{error}</p>}
      {!profile && !error && <p>Loading your profile…</p>}
      {profile && <>
        <section className="glass-card rounded-2xl p-5 mb-5">
          <h2 className="font-space text-xl mb-3">{profile.name}</h2>
          <form onSubmit={save} className="flex gap-2 mb-4">
            <Input aria-label="Profile name" value={name} onChange={e => setName(e.target.value)} maxLength={40} required />
            <Button disabled={saving || !name.trim()} type="submit">{saving ? 'Saving…' : 'Save name'}</Button>
          </form>
          <p className="text-sm text-muted-foreground mb-4">This profile belongs to this browser. Keep its cookies to retain your stars and progress. This is not a signed-in account.</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat icon={<Star />} value={profile.stars.length} label="Symbolic claims" />
            <Stat icon={<Target />} value={`${profile.completions.length}/${HUNTS.length}`} label="Today's hunts" />
            <Stat icon={<Trophy />} value={profile.rank ? `#${profile.rank}` : '—'} label="Leaderboard rank" />
          </div>
        </section>
        <section className="glass-card rounded-2xl p-5 mb-5">
          <h2 className="font-space font-semibold mb-2">Hunt Progress</h2>
          <p className="text-star-gold">{profile.points} all-time points</p>
          <p className="text-sm text-muted-foreground">{profile.completions.length} of {HUNTS.length} completed today. Daily challenges reset at 6 PM CST / 7 PM CDT (midnight UTC).</p>
          <div className="h-2 bg-muted rounded-full mt-3 overflow-hidden"><div className="h-full bg-star-gold" style={{ width: `${profile.completions.length / HUNTS.length * 100}%` }} /></div>
        </section>
        <section className="glass-card rounded-2xl p-5 mb-5">
          <h2 className="font-space font-semibold mb-3">My Stars</h2>
          {profile.stars.length === 0 ? <p className="text-muted-foreground text-sm">No symbolic claims yet. Explore the catalog in Name a Star.</p> :
            profile.stars.map(star => <div key={star.id} className="py-3 border-b border-border/30"><StarName as="strong" name={star.name} owner={star.owner_name} className="text-foreground" /><p className="text-sm text-muted-foreground">{star.constellation} · {star.ownership_tier}</p></div>)}
        </section>
      </>}
      <p className="text-xs text-muted-foreground leading-relaxed">{DISCLAIMER}</p>
    </div>
  );
}
function Stat({ icon, value, label }) {
  return <div className="bg-muted/40 rounded-xl p-3"><div className="flex justify-center text-star-gold mb-2">{icon}</div><div className="font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}
