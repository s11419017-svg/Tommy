import React, { useState } from 'react';
import { Check, FileAudio, Play, Trash2, X } from 'lucide-react';
import { LesMisTrackItem } from '../../data/lesMisTracks';

export interface UnmatchedFileItem {
  id: string;
  file: File;
  objectUrl: string;
}

interface UnmatchedAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  unmatchedFiles: UnmatchedFileItem[];
  tracks: LesMisTrackItem[];
  onAssignFileToTrack: (trackId: string, file: File) => Promise<void>;
  onAssignAllSequentially: (startOrder: number) => Promise<void>;
}

export const UnmatchedAudioModal: React.FC<UnmatchedAudioModalProps> = ({
  isOpen,
  onClose,
  unmatchedFiles,
  tracks,
  onAssignFileToTrack,
  onAssignAllSequentially,
}) => {
  const [selectedTrackMap, setSelectedTrackMap] = useState<Record<string, string>>({});
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});

  const visibleFiles = unmatchedFiles.filter((item) => !dismissedIds[item.id]);

  if (!isOpen || visibleFiles.length === 0) return null;

  const handleAssignSingle = async (item: UnmatchedFileItem) => {
    const targetTrackId = selectedTrackMap[item.id] || tracks[0]?.trackId;
    if (!targetTrackId) return;
    setAssigningId(item.id);
    await onAssignFileToTrack(targetTrackId, item.file);
    setAssigningId(null);
  };

  const handleDismissItem = (id: string) => {
    setDismissedIds((prev) => {
      const next = { ...prev, [id]: true };
      const remaining = unmatchedFiles.filter((f) => !next[f.id]);
      if (remaining.length === 0) {
        onClose();
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--accent-gold-border)] shadow-2xl flex flex-col max-h-[88dvh]">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] shrink-0">
              <FileAudio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base sm:text-lg font-bold text-[var(--text-primary)]">
                音檔手動指派對照
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                偵測到 {visibleFiles.length} 個音檔檔名無明確曲目編號，請指派對應曲目或略過：
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉視窗"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Batch Action Bar */}
        <div className="px-4 sm:px-6 py-3 bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <span className="text-[var(--text-secondary)]">
            不想一首首選？可依序連續填入各曲目：
          </span>
          <button
            type="button"
            onClick={() => onAssignAllSequentially(1)}
            className="min-h-[36px] px-3 py-1.5 bg-[var(--accent-gold)] text-black font-bold hover:opacity-90 transition-opacity"
          >
            依序由第 1 首開始自動填滿 →
          </button>
        </div>

        {/* Files List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 flex-1 divide-y divide-[var(--border-subtle)]">
          {visibleFiles.map((item) => {
            const currentSelected = selectedTrackMap[item.id] || tracks[0]?.trackId;
            const isPlayingThis = previewAudioUrl === item.objectUrl;

            return (
              <div
                key={item.id}
                className="pt-3.5 first:pt-0 flex flex-col gap-2.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="min-w-0 flex items-center gap-2.5 flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (isPlayingThis) {
                          setPreviewAudioUrl(null);
                        } else {
                          setPreviewAudioUrl(item.objectUrl);
                        }
                      }}
                      className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 border transition-colors shrink-0 ${
                        isPlayingThis
                          ? 'border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[var(--accent-gold)]/10 font-bold'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                      }`}
                      title="試聽這首音檔"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--text-primary)] break-all sm:truncate">
                        {item.file.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">
                        {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDismissItem(item.id)}
                    className="ui-instant min-h-[32px] px-2.5 py-1 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 inline-flex items-center gap-1 shrink-0"
                    title="略過並移除此檔案"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>移除</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={currentSelected}
                    onChange={(e) =>
                      setSelectedTrackMap((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    className="min-h-[38px] w-full sm:flex-1 px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs truncate"
                  >
                    {tracks.map((t) => (
                      <option key={t.trackId} value={t.trackId}>
                        {t.order}. {t.title.replace(/^\d+[\s.-]+/, '')}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={assigningId === item.id}
                    onClick={() => handleAssignSingle(item)}
                    className="min-h-[38px] px-4 py-1.5 bg-[var(--accent-bordeaux)] hover:opacity-90 text-white font-medium transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-1 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{assigningId === item.id ? '掛載中...' : '確認掛載'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hidden Preview Audio */}
        {previewAudioUrl && (
          <audio
            src={previewAudioUrl}
            autoPlay
            onEnded={() => setPreviewAudioUrl(null)}
            className="hidden"
          />
        )}

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 py-2 border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            完成並關閉
          </button>
        </div>
      </div>
    </div>
  );
};
