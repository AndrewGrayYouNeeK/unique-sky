import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Trophy, Clock, Star, Zap, ChevronRight, Flame } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const MOCK_HUNTS = [
  {
    id: 'hunt-1',
    title: 'Find Polaris',
    description: 'Locate the North Star in the sky and tap it to complete the challenge.',
    target_star: 'Polaris',
    target_constellation: 'Ursa Minor',
    icon: '⭐',
    difficulty: 'easy',
    points: 100,
    hint: 'Look almost exactly north. It barely moves all night.',
    participants: 2841,
    completed: false,
  },
  {
    id: 'hunt-2',
    title: 'Spot the Pleiades',
    description: 'Identify the famous Seven Sisters cluster in Taurus.',
    target_star: 'Pleiades',
    target_constellation: 'Taurus',
    icon: '🌟',
    difficulty: 'medium',
    points: 250,
    hint: 'Look for a tiny tight cluster of stars — they look like a mini dipper.',
    participants: 1203,
    completed: false,
  },
  {
    id: 'hunt-3',
    title: "Orion's Belt",
    description: "Tap all three belt stars — Alnitak, Alnilam, and Mintaka — in order.",
    target_star: 'Alnilam',
    target_constellation: 'Orion',
    icon: '⚔️',
    difficulty: 'medium',
    points: 300,
    hint: 'Three stars in a nearly perfect line in the winter sky.',
    participants: 1876,
    completed: true,
  },
  {
    id: 'hunt-4',
    title: 'Sirius Rising',
    description: 'Find Sirius, the brightest star in the night sky.',
    target_star: 'Sirius',
    target_constellation: 'Canis Major',
    icon: '💎',
    difficulty: 'easy',
    points: 150,
    hint: 'The absolute brightest thing in the night sky. You cannot miss it.',
    participants: 4102,
    completed: false,
  },
  {
    id: 'hunt-5',
    title: 'Summer Triangle',
    description: 'Identify Vega, Deneb, and Altair — the three corners of the Summer Triangle.',
    target_star: 'Vega',
    target_constellation: 'Lyra',
    icon: '🔺',
    difficulty: 'hard',
    points: 500,
    hint: 'A giant triangle overhead in summer evenings. Vega is the brightest.',
    participants: 698,
    completed: false,
  },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'StarHunter_99', points: 4820, badges: 12, country: '🇺🇸' },
  { rank: 2, name: 'CosmicWatcher', points: 4350, badges: 10, country: '🇯🇵' },
  { rank: 3, name: 'NightOwlAstro', points: 3900, badges: 9, country: '🇬🇧' },
  { rank: 4, name: 'GalaxyExplorer', points: 3200, badges: 8, country: '🇩🇪' },
  { rank: 5, name: 'PolarisPro', points: 2800, badges: 7, country: '🇦🇺' },
  { rank: 6, name: 'You', points: 450, badges: 2, country: '🌍', isYou: true },
];

const DIFF_COLORS = {
  easy: 'text-accent bg-accent/10 border-accent/20',
  medium: 'text-star-gold bg-star-gold/10 border-star-gold/20',
  hard: 'text-secondary bg-secondary/10 border-secondary/20',
};

export default function DailyHunts() {
  const [tab, setTab] = useState('hunts');
  const [expandedHunt, setExpandedHunt] = useState(null);

  const completedCount = MOCK_HUNTS.filter(h => h.completed).length;
  const totalPoints = MOCK_HUNTS.filter(h => h.completed).reduce((sum, h) => sum + h.points, 0);

  return (
    <div className="min-h-screen sky-gradient pb-24 pt-6">
      {/* Header */}
      <div className="px-4 mb-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="nebula-text font-space font-bold text-3xl mb-1">Daily Hunts</h1>
          <p className="text-muted-foreground text-sm font-inter">Explore the sky. Complete challenges. Earn your place in the cosmos.</p>
        </motion.div>

        {/* Progress row */}
        <motion.div className="flex gap-3 mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="glass-dark rounded-xl px-4 py-3 flex-1 flex items-center gap-3 border border-border/30">
            <Flame size={20} className="text-star-gold" />
            <div>
              <div className="font-space font-bold text-foreground">{completedCount}/{MOCK_HUNTS.length}</div>
              <div className="text-muted-foreground text-xs">Completed</div>
            </div>
          </div>
          <div className="glass-dark rounded-xl px-4 py-3 flex-1 flex items-center gap-3 border border-border/30">
            <Zap size={20} className="text-accent" />
            <div>
              <div className="font-space font-bold text-foreground">{totalPoints.toLocaleString()}</div>
              <div className="text-muted-foreground text-xs">Points</div>
            </div>
          </div>
          <div className="glass-dark rounded-xl px-4 py-3 flex-1 flex items-center gap-3 border border-border/30">
            <Trophy size={20} className="text-secondary" />
            <div>
              <div className="font-space font-bold text-foreground">#6</div>
              <div className="text-muted-foreground text-xs">Rank</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-4 flex gap-2">
        {['hunts', 'leaderboard'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl font-space text-sm font-semibold transition-all capitalize ${
              tab === t ? 'bg-star-gold/20 text-star-gold border border-star-gold/30' : 'glass-dark text-muted-foreground border border-border/30'
            }`}
          >
            {t === 'hunts' ? '🎯 Challenges' : '🏆 Leaderboard'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 space-y-3">
        {tab === 'hunts' && MOCK_HUNTS.map((hunt, i) => (
          <motion.div
            key={hunt.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <button
              onClick={() => setExpandedHunt(expandedHunt === hunt.id ? null : hunt.id)}
              className={`w-full glass-card rounded-xl p-4 text-left transition-all ${
                hunt.completed ? 'opacity-60' : 'hover:border-star-gold/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{hunt.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-space font-semibold text-foreground text-sm">{hunt.title}</span>
                    {hunt.completed && <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/30">✓ Done</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-space capitalize ${DIFF_COLORS[hunt.difficulty]}`}>
                      {hunt.difficulty}
                    </span>
                    <span className="text-muted-foreground text-xs flex items-center gap-1">
                      <Zap size={10} /> {hunt.points} pts
                    </span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="text-muted-foreground text-xs">{hunt.participants.toLocaleString()} hunters</span>
                  </div>
                </div>
                <ChevronRight size={16} className={`text-muted-foreground transition-transform ${expandedHunt === hunt.id ? 'rotate-90' : ''}`} />
              </div>

              {expandedHunt === hunt.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 pt-3 border-t border-border/30"
                >
                  <p className="text-sm text-foreground/80 font-inter mb-2">{hunt.description}</p>
                  <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                    <Target size={14} className="text-star-gold mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground font-inter"><span className="text-star-gold font-semibold">Hint: </span>{hunt.hint}</p>
                  </div>
                  {!hunt.completed && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-accent font-space">
                      <Star size={12} fill="currentColor" />
                      Open the Sky view and tap {hunt.target_star} to complete
                    </div>
                  )}
                </motion.div>
              )}
            </button>
          </motion.div>
        ))}

        {tab === 'leaderboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {MOCK_LEADERBOARD.map((entry, i) => (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass-card rounded-xl p-4 flex items-center gap-3 ${entry.isYou ? 'border-star-gold/30 bg-star-gold/5' : ''}`}
              >
                {/* Rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-space font-bold text-sm flex-shrink-0 ${
                  entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                  entry.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                  entry.rank === 3 ? 'bg-orange-700/20 text-orange-500' :
                  'bg-muted/50 text-muted-foreground'
                }`}>
                  {entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                </div>

                {/* Country + Name */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{entry.country}</span>
                    <span className={`font-space font-semibold text-sm ${entry.isYou ? 'text-star-gold' : 'text-foreground'}`}>
                      {entry.name} {entry.isYou && '(You)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {Array.from({ length: Math.min(entry.badges, 5) }).map((_, bi) => (
                      <span key={bi} className="text-xs">⭐</span>
                    ))}
                    <span className="text-xs text-muted-foreground">{entry.badges} badges</span>
                  </div>
                </div>

                <div className="text-right">
                  <div className={`font-space font-bold text-sm ${entry.isYou ? 'text-star-gold' : 'text-foreground'}`}>
                    {entry.points.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground text-xs">pts</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}