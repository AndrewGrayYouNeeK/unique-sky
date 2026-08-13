import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Trophy, Target, Crown, LogOut, Bell, Moon, Download, Shield } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getNamedStars } from '@/api/apiClient';
import { BRIGHT_STARS, getStarColorHex } from '@/lib/starData';
import {
  getCompletedHuntIds,
  getTotalPoints,
  getPlayerName,
  HUNTS,
} from '@/lib/hunts';
import { api } from '@/api/apiClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Profile() {
  const { user, login, logout, updateProfile } = useAuth();
  const [myStars, setMyStars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [rank, setRank] = useState(null);

  const completedHunts = getCompletedHuntIds().length;
  const totalPoints = getTotalPoints();
  const displayName = user?.full_name || getPlayerName();

  useEffect(() => {
    Promise.all([
      getNamedStars().catch(() => []),
      api.leaderboard().catch(() => []),
    ]).then(([stars, leaderboard]) => {
      const identifier = user?.email || user?.full_name || getPlayerName();
      setMyStars(stars.filter(s =>
        s.owner_user_id === identifier ||
        s.owner_name === displayName ||
        s.buyer_email === user?.email
      ));
      const playerRank = leaderboard.findIndex(e => e.name === displayName || e.name === getPlayerName()) + 1;
      setRank(playerRank > 0 ? playerRank : null);
    }).finally(() => setLoading(false));
  }, [user, displayName]);

  useEffect(() => {
    setNameInput(displayName);
    setEmailInput(user?.email || '');
  }, [displayName, user]);

  const handleSaveProfile = () => {
    if (nameInput.trim()) {
      if (user) {
        updateProfile({ full_name: nameInput.trim(), email: emailInput.trim() });
      } else {
        login({ full_name: nameInput.trim(), email: emailInput.trim() });
      }
    }
    setEditMode(false);
  };

  const handleLogout = () => logout();

  if (loading) {
    return (
      <div className="min-h-screen sky-gradient flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-star-gold/30 border-t-star-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen sky-gradient pb-24 pt-6">
      <div className="px-4 mb-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="nebula-text font-space font-bold text-3xl mb-1">Your Universe</h1>
        </motion.div>
      </div>

      <div className="px-4 mb-5">
        <motion.div
          className="glass-card rounded-2xl p-5"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-star-gold/30 to-secondary/30 border border-star-gold/30 flex items-center justify-center">
              <span className="text-2xl font-space font-bold text-star-gold">
                {displayName?.[0]?.toUpperCase() || '★'}
              </span>
            </div>
            <div className="flex-1">
              {editMode ? (
                <div className="space-y-2">
                  <Input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    placeholder="Your name"
                    className="bg-muted/50 border-border/50 font-space text-sm"
                  />
                  <Input
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="Email (optional)"
                    className="bg-muted/50 border-border/50 font-inter text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveProfile} className="bg-star-gold text-background font-space">Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="font-space font-bold text-xl text-foreground">{displayName}</h2>
                  <p className="text-muted-foreground text-sm font-inter">{user?.email || 'Set up your profile'}</p>
                  <button onClick={() => setEditMode(true)} className="text-accent text-xs font-space mt-1 hover:underline">
                    Edit profile
                  </button>
                </>
              )}
              <div className="flex items-center gap-1 mt-1">
                <Crown size={12} className="text-secondary" />
                <span className="text-secondary text-xs font-space">
                  Stargazer Level {Math.max(1, Math.floor(completedHunts / 2) + 1)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Star size={16} className="text-star-gold" />} value={myStars.length} label="Stars Owned" />
            <StatCard icon={<Target size={16} className="text-accent" />} value={completedHunts} label="Hunts Done" />
            <StatCard icon={<Trophy size={16} className="text-secondary" />} value={rank ? `#${rank}` : '—'} label="Global Rank" />
          </div>
        </motion.div>
      </div>

      {myStars.length > 0 && (
        <div className="px-4 mb-5">
          <h3 className="font-space font-semibold text-foreground mb-3 flex items-center gap-2">
            <Star size={16} className="text-star-gold" fill="currentColor" />
            My Stars
          </h3>
          <div className="space-y-2">
            {myStars.map(star => {
              const colorHex = getStarColorHex(star.color || 'white');
              return (
                <div key={star.id} className="glass-card rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${colorHex}20` }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: colorHex }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-space font-semibold text-sm text-foreground">{star.name}</p>
                    <p className="text-muted-foreground text-xs">{star.constellation || 'Named star'}</p>
                  </div>
                  {star.ownership_tier === 'premium' && (
                    <Crown size={14} className="text-secondary" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 mb-5">
        <h3 className="font-space font-semibold text-foreground mb-3">Hunt Progress</h3>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground font-space">{completedHunts} of {HUNTS.length} hunts</span>
            <span className="text-star-gold font-space font-bold">{totalPoints} pts</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-star-gold rounded-full transition-all"
              style={{ width: `${(completedHunts / HUNTS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="px-4 mb-5">
        <h3 className="font-space font-semibold text-foreground mb-3">Settings</h3>
        <div className="glass-card rounded-2xl overflow-hidden divide-y divide-border/30">
          <SettingRow icon={<Bell size={16} />} label="Sky Alerts" sublabel="Daily constellation updates" toggle />
          <SettingRow icon={<Moon size={16} />} label="Red Night Mode" sublabel="Preserve night vision" toggle />
          <SettingRow icon={<Download size={16} />} label="Offline Maps" sublabel="Download star catalog" action="Download" />
          <SettingRow icon={<Shield size={16} />} label="Privacy" sublabel="Data & permissions" />
        </div>
      </div>

      <div className="px-4 mb-5">
        <div className="glass-dark rounded-xl p-4 border border-accent/20">
          <div className="flex items-center gap-2 mb-2">
            <Download size={14} className="text-accent" />
            <span className="font-space font-semibold text-sm text-foreground">Offline Star Catalog</span>
          </div>
          <p className="text-muted-foreground text-xs font-inter leading-relaxed">
            {BRIGHT_STARS.length} bright stars pre-loaded. Full Hipparcos catalog (118,218 stars) available for download. Works without internet connection.
          </p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full" style={{ width: '12%' }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{BRIGHT_STARS.length} / 118,218 stars cached</p>
        </div>
      </div>

      <div className="px-4 mb-5">
        <div className="rounded-xl border border-border/30 p-3">
          <p className="text-xs text-muted-foreground font-inter leading-relaxed text-center">
            Star naming in YouneeK Stars is <strong className="text-foreground">symbolic only</strong> and not recognized by the International Astronomical Union or any official body.
          </p>
        </div>
      </div>

      {user && (
        <div className="px-4">
          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-xl border border-border/50 text-muted-foreground font-space text-sm flex items-center justify-center gap-2 hover:text-destructive hover:border-destructive/30 transition-all"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 text-center">
      <div className="flex justify-center mb-1">{icon}</div>
      <div className="font-space font-bold text-foreground text-lg leading-none">{value}</div>
      <div className="text-muted-foreground text-xs mt-0.5 font-inter">{label}</div>
    </div>
  );
}

function SettingRow({ icon, label, sublabel, toggle, action }) {
  const [enabled, setEnabled] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-space text-foreground">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground font-inter">{sublabel}</p>}
      </div>
      {toggle && (
        <button
          onClick={() => setEnabled(v => !v)}
          className={`w-11 h-6 rounded-full transition-all relative ${enabled ? 'bg-star-gold' : 'bg-muted'}`}
        >
          <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${enabled ? 'left-6' : 'left-1'}`} />
        </button>
      )}
      {action && (
        <button className="text-xs text-accent font-space">{action}</button>
      )}
    </div>
  );
}
