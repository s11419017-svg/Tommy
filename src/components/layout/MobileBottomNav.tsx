import React from 'react';
import { Calendar, Headphones, Music, Users } from 'lucide-react';
import { ActiveView } from '../../types/rehearsal';

interface MobileBottomNavProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  calledTracksCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = React.memo(
  ({ activeView, setActiveView, calledTracksCount = 0 }) => {
    const navItems: Array<{
      view: ActiveView;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number | string;
    }> = [
      {
        view: 'portal',
        label: '通告大廳',
        icon: Calendar,
        badge: calledTracksCount > 0 ? `${calledTracksCount}` : undefined,
      },
      {
        view: 'rehearsal',
        label: '排練舞台',
        icon: Headphones,
      },
      {
        view: 'tracks',
        label: '曲目伴奏',
        icon: Music,
      },
      {
        view: 'supervision',
        label: '劇組進度',
        icon: Users,
      },
    ];

    return (
      <nav
        aria-label="手機端主要導航"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] shadow-lg select-none"
      >
        <div className="grid grid-cols-4 items-center h-15 max-w-md mx-auto px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => setActiveView(item.view)}
                className={`min-h-[44px] flex flex-col items-center justify-center py-1 transition-colors relative ${
                  isActive
                    ? 'text-[var(--accent-gold)] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-[var(--accent-bordeaux)] text-[9px] font-mono text-white leading-none">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] tracking-tight mt-1 leading-none">
                  {item.label}
                </span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 w-8 h-0.5 bg-[var(--accent-gold)] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }
);

MobileBottomNav.displayName = 'MobileBottomNav';
