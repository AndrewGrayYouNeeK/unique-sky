import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Trophy, Zap, ChevronRight, Flame, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  HUNTS,
  getLocalHuntProgress,
  isHuntCompleted,
  getTotalPoints,
  getPlayerName,
  setActiveHuntTarget,
} from '@/lib/hunts';
import { api } from '@/api/apiClient';

const DIFF_COLORS = {
  easy: 'text-accent bg-accent/10 border-accent/20',
  medium: 'text-star-gold bg-star-gold/10 border-star-gold/20',
  hard: 'text-secondary bg-secondary/10 border-secondary/20',
};

export default function DailyHunts() {
  const [tab, setTab] = useState('hunts');
  const [expandedHunt, setExpandedHunt] = useState(null);
  const [progress, setProgress] = useState(getLocalHuntProgress());
  const [leaderboard, setLeaderboard] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.leaderboard()
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]));
  }, [progress]);

  const startHunt = (hunt) => {
    setActiveHuntTarget(hunt.target_star);
    navigate('/');
  };

  const completedCount = HUNTS.filter(h => isHuntCompleted(h.id, progress)).length;
  const totalPoints = getTotalPoints(progress);
  const playerName = getPlayerName();
  const playerRank = leaderboard.findIndex(e => e.name === playerName) + 1;

  const displayLeaderboard = (() => {
    const playerInBoard = leaderboard.some(e => e.name === playerName);
    const base = [...leaderboard];

    if (!playerInBoard && totalPoints > 0) {
      base.push({ name: playerName, points: totalPoints, badges: completedCount, rank: base.length + 1, isYou: true });
    }

    return base.slice(0, 10).map((entry, i) => ({
      ...entry,
      rank: entry.rank || i + 1,
      isYou: entry.name === playerName,
    }));
  })();

  return (
    <div className="min-h-screen sky-gradient pb-24 pt-6">
      <div className="px-4 mb-5">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="nebula-text font-space font-bold text-3xl mb-1">Daily Hunts</h1>
          <p className="text-muted-foreground text-sm font-inter">Explore the sky. Complete challenges. Earn your place in the cosmos.</p>
        </motion.div>

        <motion.div className="flex gap-3 mt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="glass-dark rounded-xl px-4 py-3 flex-1 flex items-center gap-3 border border-border/30">
            <Flame size={20} className="text-star-gold" />
            <div>
              <div className="font-space font-bold text-foreground">{completedCount}/{HUNTS.length}</div>
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
              <div className="font-space font-bold text-foreground">{playerRank > 0 ? `#${playerRank}` : '—'}</div>
              <div className="text-muted-foreground text-xs">Rank</div>
            </div>
          </div>
        </motion.div>
      </div>

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

      <div className="px-4 space-y-3">
        {tab === 'hunts' && HUNTS.map((hunt, i) => {
          const completed = isHuntCompleted(hunt.id, progress);
          return (
            <motion.div
              key={hunt.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <button
                onClick={() => setExpandedHunt(expandedHunt === hunt.id ? null : hunt.id)}
                className={`w-full glass-card rounded-xl p-4 text-left transition-all ${
                  completed ? 'opacity-60' : 'hover:border-star-gold/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{hunt.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-space font-semibold text-foreground text-sm">{hunt.title}</span>
                      {completed && <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/30">✓ Done</span>}
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
                    {!completed && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); startHunt(hunt); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 text-accent border border-accent/30 text-xs font-space hover:bg-accent/30 transition-all"
                        >
                          <Navigation size={11} /> Hunt in AR Sky
                        </button>
                        <span className="text-xs text-muted-foreground font-inter">Tap {hunt.target_star} to complete</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </button>
            </motion.div>
          );
        })}

        {tab === 'leaderboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {displayLeaderboard.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Complete a hunt to appear on the leaderboard!</p>
            ) : displayLeaderboard.map((entry, i) => (
              <motion.div
                key={`${entry.name}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`glass-card rounded-xl p-4 flex items-center gap-3 ${entry.isYou ? 'border-star-gold/30 bg-star-gold/5' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-space font-bold text-sm flex-shrink-0 ${
                  entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                  entry.rank === 2 ? 'bg-gray-400/20 text-gray-300' :
                  entry.rank === 3 ? 'bg-orange-700/20 text-orange-500' :
                  'bg-muted/50 text-muted-foreground'
                }`}>
                  {entry.rank === 1 ? '👑' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                </div>

                <div className="flex-1">
                  <span className={`font-space font-semibold text-sm ${entry.isYou ? 'text-star-gold' : 'text-foreground'}`}>
                    {entry.name} {entry.isYou && '(You)'}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {Array.from({ length: Math.min(entry.badges || 0, 5) }).map((_, bi) => (
                      <span key={bi} className="text-xs">⭐</span>
                    ))}
                    <span className="text-xs text-muted-foreground">{entry.badges || 0} badges</span>
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
