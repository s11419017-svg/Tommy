import React from 'react';
import { User } from 'firebase/auth';
import {
  Calendar,
  FileAudio,
  Flame,
  LogIn,
  LogOut,
  Moon,
  Sun,
  Users,
} from 'lucide-react';
import { ActiveView, UserProfileDoc } from '../../types/rehearsal';

interface HeaderProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  darkMode: boolean;
  setDarkMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  currentUser: User | null;
  userProfile: UserProfileDoc;
  onOpenProfileModal: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  audioCount: number;
  totalTracks: number;
  calledTracksCount: number;
  streakDays?: number;
  onOpenCompanion?: () => void;
}

export const Header: React.FC<HeaderProps> = React.memo(
  ({
    activeView,
    setActiveView,
    darkMode,
    setDarkMode,
    currentUser,
    userProfile,
    onOpenProfileModal,
    onSignIn,
    onSignOut,
    audioCount,
    totalTracks,
    calledTracksCount,
    streakDays,
    onOpenCompanion,
  }) => {
    return (
      <header className="sticky top-0 z-30 border-b transition-colors border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="max-w-[1760px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 h-14 flex items-center justify-between gap-4">
          {/* Brand & Identity */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setActiveView('portal')}
              className="text-left group flex items-baseline gap-2.5"
            >
              <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-[var(--accent-bordeaux)] group-hover:opacity-90 transition-opacity">
                Les Misérables
              </span>
              <span className="font-editorial italic text-xs sm:text-sm text-[var(--text-muted)] tracking-wide hidden sm:inline">
                劇組排練大廳
              </span>
            </button>

            {/* Quick Status Typography (Zero-Pill) */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-ready)]" />
              <span>
                {audioCount}/{totalTracks} 音檔就緒
              </span>
              {calledTracksCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--accent-gold)] font-medium">
                    {calledTracksCount} 場今日通告
                  </span>
                </>
              )}
            </div>
          </div>

          {/* View Mode Navigation Tabs (Desktop only: lg+) */}
          <nav className="hidden lg:flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setActiveView('portal')}
              className={`px-3 py-1.5 transition-colors whitespace-nowrap ${
                activeView === 'portal'
                  ? 'border-b-2 border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              通告大廳
            </button>
            <button
              type="button"
              onClick={() => setActiveView('rehearsal')}
              className={`px-3 py-1.5 transition-colors whitespace-nowrap ${
                activeView === 'rehearsal'
                  ? 'border-b-2 border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              排練舞台
            </button>
            <button
              type="button"
              onClick={() => setActiveView('tracks')}
              className={`px-3 py-1.5 transition-colors whitespace-nowrap ${
                activeView === 'tracks'
                  ? 'border-b-2 border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              曲目與伴奏
            </button>
            <button
              type="button"
              onClick={() => setActiveView('supervision')}
              className={`px-3 py-1.5 transition-colors whitespace-nowrap ${
                activeView === 'supervision'
                  ? 'border-b-2 border-[var(--accent-gold)] text-[var(--accent-gold)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              劇組進度
            </button>
          </nav>

          {/* User Profile, Theme Switcher & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mascot & Streak Quick Trigger Pill (Zero-Pill Minimalist) */}
            {onOpenCompanion && (
              <button
                type="button"
                onClick={onOpenCompanion}
                className="flex items-center gap-1.5 px-2 py-1 text-xs border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] bg-[var(--bg-elevated)] text-amber-400 font-mono font-bold transition-colors"
                title="點開排練督導與連續排練天數"
              >
                <Flame className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span className="hidden sm:inline">連續</span>
                <span>{streakDays ?? 3}天</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label={darkMode ? '切換至古典劇本淺色模式' : '切換至劇院暗色模式'}
              className="p-2 border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title={darkMode ? '切換至淺色樂譜主題' : '切換至深色劇院主題'}
            >
              {darkMode ? (
                <Sun className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Profile / Auth Button */}
            {currentUser ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenProfileModal}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] text-[var(--text-primary)] transition-colors max-w-[140px] truncate"
                >
                  <Users className="w-3 h-3 text-[var(--accent-gold)] shrink-0" />
                  <span className="truncate">{userProfile.displayName}</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  aria-label="登出"
                  title="登出帳號"
                  className="p-1.5 border border-[var(--border-subtle)] hover:border-red-500/50 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent-bordeaux)] hover:opacity-90 text-white font-medium transition-opacity"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Google 登入同步</span>
                <span className="sm:hidden">登入</span>
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }
);

Header.displayName = 'Header';
