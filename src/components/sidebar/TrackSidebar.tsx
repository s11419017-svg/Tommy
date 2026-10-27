import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Music,
  Search,
  Users,
  Zap,
} from 'lucide-react';
import { LesMisTrackItem } from '../../data/lesMisTracks';
import { MasteryState } from '../../machines/rehearsalStateMachine';
import { ProgressRecord } from '../../types/rehearsal';

interface TrackSidebarProps {
  tracks: LesMisTrackItem[];
  filteredTracks: LesMisTrackItem[];
  selectedTrackId: string;
  onSelectTrack: (trackId: string) => void;
  isEnsembleMode: boolean;
  onToggleEnsembleMode: (val: boolean) => void;
  onlyMySongsFilter: boolean;
  setOnlyMySongsFilter: (val: boolean | ((prev: boolean) => boolean)) => void;
  onlyCalledTracksFilter: boolean;
  setOnlyCalledTracksFilter: (val: boolean | ((prev: boolean) => boolean)) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  localAudioBlobs: Record<string, { url: string; fileName: string }>;
  progressMap: Record<string, ProgressRecord>;
  calledTrackIds: string[];
}

function splitBilingualTitle(rawTitle: string): {
  mainTitle: string;
  subTitleZh: string;
} {
  const cleaned = rawTitle.replace(/^\d+\.\s*/, '').trim();
  const parenMatch = cleaned.match(/^(.*?)\s*[（(]([^）)]+)[）)]\s*$/);
  if (parenMatch) {
    return {
      mainTitle: parenMatch[1].trim(),
      subTitleZh: parenMatch[2].trim(),
    };
  }
  return { mainTitle: cleaned, subTitleZh: '' };
}

function isTrackForEnsemble(track: LesMisTrackItem): boolean {
  const text = `${track.title} ${track.characters} ${track.dramaticContext}`.toLowerCase();
  return (
    text.includes('ensemble') ||
    text.includes('convict') ||
    text.includes('worker') ||
    text.includes('women') ||
    text.includes('student') ||
    text.includes('crowd') ||
    text.includes('合唱') ||
    text.includes('群演') ||
    text.includes('眾人') ||
    text.includes('百姓')
  );
}

export const TrackSidebar: React.FC<TrackSidebarProps> = React.memo(
  ({
    tracks,
    filteredTracks,
    selectedTrackId,
    onSelectTrack,
    isEnsembleMode,
    onToggleEnsembleMode,
    onlyMySongsFilter,
    setOnlyMySongsFilter,
    onlyCalledTracksFilter,
    setOnlyCalledTracksFilter,
    searchQuery,
    setSearchQuery,
    localAudioBlobs,
    calledTrackIds,
  }) => {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
      return localStorage.getItem('lesmis_sidebar_collapsed') === 'true';
    });
    const [mobileListOpen, setMobileListOpen] = useState<boolean>(false);

    const activeTrackItem = tracks.find((t) => t.trackId === selectedTrackId);

    const toggleCollapsed = () => {
      setIsCollapsed((prev) => {
        const next = !prev;
        localStorage.setItem('lesmis_sidebar_collapsed', String(next));
        return next;
      });
    };

    // Compact Rail (Mini sidebar for widescreen maximum stage focus)
    if (isCollapsed) {
      return (
        <aside className="hidden lg:flex w-14 shrink-0 border-r transition-all border-[var(--border-subtle)] bg-[var(--bg-surface)] flex-col items-center py-3 select-none">
          {/* Expand Toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title="展開側邊曲目清單"
            className="w-9 h-9 flex items-center justify-center border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-3"
          >
            <ChevronRight className="w-4 h-4 text-[var(--accent-gold)]" />
          </button>

          {/* Quick Track Number Rail */}
          <div className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-1.5 px-2">
            {tracks.map((track) => {
              const isSelected = track.trackId === selectedTrackId;
              const isCalled = calledTrackIds.includes(track.trackId);
              const hasLocalAudio = Boolean(localAudioBlobs[track.trackId]);
              const parsed = splitBilingualTitle(track.title);

              return (
                <button
                  key={track.trackId}
                  type="button"
                  onClick={() => onSelectTrack(track.trackId)}
                  title={`${track.order}. ${parsed.mainTitle} (${parsed.subTitleZh || track.subtitle})`}
                  className={`w-9 h-9 flex flex-col items-center justify-center relative text-xs font-mono transition-all border ${
                    isSelected
                      ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-bold'
                      : 'border-transparent hover:border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{String(track.order).padStart(2, '0')}</span>
                  {/* Subtle Status Dots */}
                  <div className="flex items-center gap-0.5 absolute bottom-0.5">
                    {isCalled && (
                      <span className="w-1 h-1 rounded-full bg-amber-400" />
                    )}
                    {hasLocalAudio && (
                      <span className="w-1 h-1 rounded-full bg-[var(--status-ready)]" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      );
    }

    return (
      <aside className="w-full lg:w-80 xl:w-88 2xl:w-96 shrink-0 border-b lg:border-b-0 lg:border-r transition-all border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col h-auto lg:h-full lg:min-h-[500px]">
        {/* Mobile Compact Track Header Bar (lg:hidden) */}
        <div className="lg:hidden p-3 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-bold text-[var(--accent-gold)] shrink-0">
              #{activeTrackItem?.order || '01'}
            </span>
            <span className="text-xs font-bold text-[var(--text-primary)] truncate">
              {activeTrackItem?.title || '選擇排練曲目'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileListOpen((prev) => !prev)}
            className="min-h-[38px] px-2.5 py-1 text-xs border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] bg-[var(--bg-surface)] text-[var(--accent-gold)] font-bold flex items-center gap-1 shrink-0"
          >
            <span>{mobileListOpen ? '收起曲目' : '切換曲目 (21首)'}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${
                mobileListOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* Expandable/Responsive Track List Body */}
        <div className={`${mobileListOpen ? 'flex' : 'hidden lg:flex'} flex-col flex-1`}>
          {/* Perspective Switcher & Search Bar */}
          <div className="p-4 border-b border-[var(--border-subtle)] space-y-3.5">
            {/* Header Row with Collapse Button */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                排練視角 (Perspective)
              </span>
              <button
                type="button"
                onClick={toggleCollapsed}
                title="收起側邊欄以獲得最大舞台空間"
                className="hidden lg:inline-flex text-xs text-[var(--text-muted)] hover:text-[var(--accent-gold)] items-center gap-1 transition-colors px-1.5 py-0.5 border border-transparent hover:border-[var(--border-subtle)]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>收起欄</span>
              </button>
            </div>

          {/* Dual Perspective Slider */}
          <div className="relative grid grid-cols-2 items-center border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-xs overflow-hidden p-0.5">
            <div
              aria-hidden="true"
              className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-sm transition-transform duration-200 ease-out border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-xs ${
                isEnsembleMode
                  ? 'translate-x-[calc(100%+2px)]'
                  : 'translate-x-0'
              }`}
            />
            <button
              type="button"
              onClick={() => onToggleEnsembleMode(false)}
              className={`relative z-10 py-1.5 px-2 text-center transition-colors font-medium ${
                !isEnsembleMode
                  ? 'text-[var(--text-primary)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              主角獨唱視角
            </button>
            <button
              type="button"
              onClick={() => onToggleEnsembleMode(true)}
              className={`relative z-10 py-1.5 px-2 text-center transition-colors font-medium ${
                isEnsembleMode
                  ? 'text-[var(--text-primary)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              群眾合唱視角
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋曲名、角色或關鍵詞..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border-subtle)] focus:border-[var(--accent-gold)] focus:outline-hidden text-[var(--text-primary)] transition-colors"
            />
          </div>

          {/* Filter Toggles */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setOnlyMySongsFilter((p) => !p)}
              className={`px-2 py-1 text-xs border transition-colors inline-flex items-center gap-1 ${
                onlyMySongsFilter
                  ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] font-bold'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-secondary)]'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>僅我唱段</span>
            </button>

            <button
              type="button"
              onClick={() => setOnlyCalledTracksFilter((p) => !p)}
              className={`px-2 py-1 text-xs border transition-colors inline-flex items-center gap-1 ${
                onlyCalledTracksFilter
                  ? 'border-amber-500/70 bg-amber-500/10 text-amber-400 font-bold'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-secondary)]'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>今日通告 ({calledTrackIds.length})</span>
            </button>
          </div>
        </div>

        {/* Track List Container */}
        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {filteredTracks.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)]">
              沒有符合過濾條件的曲目
            </div>
          ) : (
            filteredTracks.map((track) => {
              const isSelected = track.trackId === selectedTrackId;
              const parsed = splitBilingualTitle(track.title);
              const isCalled = calledTrackIds.includes(track.trackId);
              const hasLocalAudio = Boolean(localAudioBlobs[track.trackId]);
              const hasEnsemble = isTrackForEnsemble(track);

              return (
                <button
                  key={track.trackId}
                  type="button"
                  onClick={() => {
                    onSelectTrack(track.trackId);
                    setMobileListOpen(false);
                  }}
                  className={`w-full text-left p-3 sm:px-4 transition-colors flex items-center justify-between gap-2 min-h-[44px] ${
                    isSelected
                      ? 'bg-[var(--accent-gold)]/10 border-l-2 border-l-[var(--accent-gold)]'
                      : 'hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-mono text-[var(--accent-gold)] font-semibold tabular-nums shrink-0">
                        {String(track.order).padStart(2, '0')}
                      </span>
                      <span
                        className={`font-display font-medium truncate ${
                          isSelected
                            ? 'text-[var(--text-primary)] font-bold'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        {parsed.subTitleZh ? (
                          <>
                            <span>{parsed.subTitleZh}</span>
                            <span className="hidden xl:inline text-[var(--text-muted)] font-normal text-[11px] ml-1.5 font-sans">
                              {parsed.mainTitle}
                            </span>
                          </>
                        ) : (
                          parsed.mainTitle
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                      <span className="truncate">{track.act}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {Math.floor(track.durationSec / 60)}:
                        {String(track.durationSec % 60).padStart(2, '0')}
                      </span>
                      {hasEnsemble && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--accent-gold)] font-medium">
                            合唱
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-[10px]">
                    {isCalled && (
                      <span className="text-amber-400 font-medium">
                        通告
                      </span>
                    )}
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasLocalAudio
                          ? 'bg-[var(--status-ready)]'
                          : 'bg-stone-500/60'
                      }`}
                      title={hasLocalAudio ? '已掛載音檔' : '雲端伴奏'}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
    );
  }
);

TrackSidebar.displayName = 'TrackSidebar';
