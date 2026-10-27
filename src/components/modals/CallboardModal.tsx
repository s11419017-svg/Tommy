import React, { useState } from 'react';
import { Calendar, Trash2, X } from 'lucide-react';
import { LesMisTrackItem } from '../../data/lesMisTracks';
import { ProductionCallboard } from '../../types/rehearsal';

interface CallboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  callboard: ProductionCallboard;
  tracks: LesMisTrackItem[];
  onSaveCallboard: (updated: ProductionCallboard) => void;
}

export const CallboardModal: React.FC<CallboardModalProps> = ({
  isOpen,
  onClose,
  callboard,
  tracks,
  onSaveCallboard,
}) => {
  const [dateIso, setDateIso] = useState(callboard.dateIso);
  const [directorNotice, setDirectorNotice] = useState(
    callboard.directorNotice
  );
  const [calledTrackIds, setCalledTrackIds] = useState<string[]>(
    callboard.calledTrackIds
  );

  if (!isOpen) return null;

  const toggleTrack = (id: string) => {
    setCalledTrackIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCallboard({
      dateIso,
      directorNotice: directorNotice.trim(),
      calledTrackIds,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-ui-fade-in">
      <div className="w-full max-w-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 sm:p-6 space-y-5 shadow-2xl animate-ui-pop max-h-[90dvh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--accent-gold)] shrink-0" />
            <h3 className="font-display text-base sm:text-lg font-bold text-[var(--text-primary)]">
              發布與編輯今日排練通告 (Callboard)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉視窗"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[var(--text-muted)] mb-1">
                通告日期 (YYYY-MM-DD)
              </label>
              <input
                type="text"
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value)}
                className="w-full min-h-[38px] px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                required
              />
            </div>
            <div>
              <label className="block text-[var(--text-muted)] mb-1">
                已選通告曲目數
              </label>
              <div className="py-2 flex items-center justify-between gap-2">
                <span className="text-[var(--accent-gold)] font-bold">
                  {calledTrackIds.length} 首曲目
                </span>
                {calledTrackIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCalledTrackIds([])}
                    className="inline-flex items-center gap-1 text-rose-400 hover:underline text-[11px]"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>清空已選曲目</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[var(--text-muted)]">
                導演指示／今日團練重點
              </label>
              {directorNotice && (
                <button
                  type="button"
                  onClick={() => setDirectorNotice('')}
                  className="inline-flex items-center gap-1 text-rose-400 hover:underline text-[11px]"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>清除文字</span>
                </button>
              )}
            </div>
            <textarea
              rows={3}
              value={directorNotice}
              onChange={(e) => setDirectorNotice(e.target.value)}
              placeholder="例如：今日 14:00 驗收 Act I 苦役犯大合唱與尚萬強獨白走位..."
              className="w-full p-2.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-gold)]"
            />
          </div>

          <div>
            <label className="block text-[var(--text-muted)] mb-2 font-medium">
              點擊勾選今日需排練的場次：
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1.5 border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
              {tracks.map((t) => {
                const checked = calledTrackIds.includes(t.trackId);
                return (
                  <button
                    key={t.trackId}
                    type="button"
                    onClick={() => toggleTrack(t.trackId)}
                    className={`min-h-[38px] p-2 text-left text-xs border transition-colors flex items-center justify-between ${
                      checked
                        ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] font-bold'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span className="truncate">
                      {t.order}. {t.title.split('(')[0]}
                    </span>
                    {checked && <span className="ml-1 text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 border border-[var(--border-subtle)] text-[var(--text-secondary)]"
            >
              取消
            </button>
            <button
              type="submit"
              className="min-h-[40px] px-5 py-2 bg-[var(--accent-gold)] text-black font-bold hover:opacity-90 transition-opacity"
            >
              更新通告發布
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
