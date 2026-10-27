import React from 'react';
import { Calendar, Edit3, Volume2 } from 'lucide-react';
import { LesMisTrackItem } from '../../data/lesMisTracks';
import { ProductionCallboard } from '../../types/rehearsal';

interface CallboardProps {
  callboard: ProductionCallboard;
  calledTracks: LesMisTrackItem[];
  selectedTrackId: string;
  onSelectTrack: (trackId: string) => void;
  onOpenCallboardEditor: () => void;
  isDirectorAdmin: boolean;
}

export const Callboard: React.FC<CallboardProps> = React.memo(
  ({
    callboard,
    calledTracks,
    selectedTrackId,
    onSelectTrack,
    onOpenCallboardEditor,
    isDirectorAdmin,
  }) => {
    return (
      <div className="border-b transition-colors border-[var(--border-subtle)] bg-[var(--bg-subtle)] py-2 px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="max-w-[1760px] 2xl:max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Today's Notice */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="inline-flex items-center gap-1 text-[var(--accent-gold)] font-bold shrink-0">
              <Calendar className="w-3.5 h-3.5" />
              <span>今日通告</span>
            </span>
            <span className="text-[var(--text-muted)] shrink-0">
              {callboard.dateIso}
            </span>
            <span className="text-[var(--text-muted)] hidden sm:inline shrink-0">
              |
            </span>
            <span className="text-[var(--text-secondary)] truncate font-serif-editorial italic">
              {callboard.directorNotice}
            </span>
            {isDirectorAdmin && (
              <button
                type="button"
                onClick={onOpenCallboardEditor}
                className="text-[var(--accent-gold)] hover:underline inline-flex items-center gap-1 ml-1 shrink-0"
              >
                <Edit3 className="w-3 h-3" />
                <span>編輯通告</span>
              </button>
            )}
          </div>

          {/* Called Tracks Quick Jump Pills */}
          {calledTracks.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
              <span className="text-[var(--text-muted)] shrink-0 hidden sm:inline">
                今日排練場次：
              </span>
              {calledTracks.map((track) => {
                const isSelected = track.trackId === selectedTrackId;
                return (
                  <button
                    key={track.trackId}
                    type="button"
                    onClick={() => onSelectTrack(track.trackId)}
                    className={`px-2 py-0.5 text-xs whitespace-nowrap transition-colors border ${
                      isSelected
                        ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] font-bold'
                        : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {track.order}. {track.title.split('(')[0].replace(/^\d+\.\s*/, '')}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
);

Callboard.displayName = 'Callboard';
