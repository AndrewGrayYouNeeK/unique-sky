import { Link, useLocation } from 'react-router-dom';
import { Telescope, Star, Target, Map, User } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', icon: Telescope, label: 'Sky' },
  { path: '/name-a-star', icon: Star, label: 'Name' },
  { path: '/hunts', icon: Target, label: 'Hunts' },
  { path: '/star-map', icon: Map, label: 'Map' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-dark border-t border-border/30 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2 max-w-md mx-auto">
        {NAV_ITEMS.map(({ path, icon: NavIcon, label }) => {
          const Icon = NavIcon;
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-star-gold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon
                size={20}
                className={`transition-all duration-200 ${isActive ? 'drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]' : ''}`}
                fill={isActive ? 'currentColor' : 'none'}
              />
              <span className="text-[10px] font-space font-medium">{label}</span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-star-gold" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}