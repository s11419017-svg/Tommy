import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Save,
  Trash2,
} from 'lucide-react';
import { LesMisTrackItem } from '../../data/lesMisTracks';
import {
  MASTERY_STATE_META,
  MasteryState,
} from '../../machines/rehearsalStateMachine';
import {
  ProgressRecord,
  UserProfileDoc,
} from '../../types/rehearsal';

interface SupervisionViewProps {
  tracks: LesMisTrackItem[];
  progressMap: Record<string, ProgressRecord>;
  castRoster: UserProfileDoc[];
  currentUser: User | null;
  isDirectorAdmin: boolean;
  onUpdateFeedback: (progressId: string, feedback: string) => void;
  onSelectTrackForRehearsal: (trackId: string) => void;
}

export const SupervisionView: React.FC<SupervisionViewProps> = React.memo(
  ({
    tracks,
    progressMap,
    currentUser,
    isDirectorAdmin,
    onUpdateFeedback,
    onSelectTrackForRehearsal,
  }) => {
    const [selectedTrackFilter, setSelectedTrackFilter] = useState<string>('all');
    const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>(
      {}
    );

    const allProgressRecords = useMemo(() => {
      return Object.values(progressMap);
    }, [progressMap]);

    const filteredRecords = useMemo(() => {
      if (selectedTrackFilter === 'all') return allProgressRecords;
      return allProgressRecords.filter((r) => r.trackId === selectedTrackFilter);
    }, [allProgressRecords, selectedTrackFilter]);

    const overallStats = useMemo(() => {
      let totalPracticeCount = 0;
      let totalSecs = 0;
      let stageReadyCount = 0;

      allProgressRecords.forEach((r) => {
        totalPracticeCount += r.practiceCount || 0;
        totalSecs += r.totalPracticeSeconds || 0;
        if (r.masteryState === MasteryState.STAGE_READY) {
          stageReadyCount++;
        }
      });

      return {
        totalPracticeCount,
        totalHours: (totalSecs / 3600).toFixed(1),
        stageReadyCount,
        activeRecordsCount: allProgressRecords.length,
      };
    }, [allProgressRecords]);

    const handleSaveFeedback = (progressId: string) => {
      const draft = feedbackDrafts[progressId];
      if (draft !== undefined) {
        onUpdateFeedback(progressId, draft);
      }
    };

    const handleClearFeedback = (progressId: string) => {
      setFeedbackDrafts((prev) => ({
        ...prev,
        [progressId]: '',
      }));
      onUpdateFeedback(progressId, '');
    };

    return (
      <div className="max-w-[1760px] 2xl:max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-5 sm:py-8 pb-24 lg:pb-12 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="border-b border-[var(--border-subtle)] pb-5 sm:pb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-[var(--accent-gold)] uppercase tracking-wider block">
              Stage Management &amp; Production Progress
            </span>
            <h1 className="font-display text-xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
              劇組排練進度與團練加強登記表
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 max-w-2xl">
              {currentUser
                ? `已連結 Google 帳號（${currentUser.email}）。可查閱全劇組演員各曲目熟練度及需加強段落。`
                : '登入 Google 帳號即可與劇組即時同步排練進度與導演指導指示。'}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="w-full sm:w-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs">
            <div className="p-3 border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <span className="text-[var(--text-muted)] block">累計練唱次數</span>
              <span className="font-display text-lg font-bold text-[var(--text-primary)] tabular-nums">
                {overallStats.totalPracticeCount} 次
              </span>
            </div>
            <div className="p-3 border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <span className="text-[var(--text-muted)] block">總排練時數</span>
              <span className="font-display text-lg font-bold text-[var(--accent-gold)] tabular-nums">
                {overallStats.totalHours} 小時
              </span>
            </div>
            <div className="p-3 border border-[var(--border-subtle)] bg-[var(--bg-surface)] col-span-2 sm:col-span-1">
              <span className="text-[var(--text-muted)] block">通過總彩驗收</span>
              <span className="font-display text-lg font-bold text-emerald-400 tabular-nums">
                {overallStats.stageReadyCount} 項
              </span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="text-[var(--text-muted)] shrink-0">依場次篩選：</label>
            <select
              value={selectedTrackFilter}
              onChange={(e) => setSelectedTrackFilter(e.target.value)}
              className="min-h-[38px] w-full sm:w-auto px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            >
              <option value="all">全劇所有曲目 ({tracks.length} 首)</option>
              {tracks.map((t) => (
                <option key={t.trackId} value={t.trackId}>
                  {t.order}. {t.title.split('(')[0]}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[var(--text-muted)] font-mono">
            共登記 {filteredRecords.length} 筆排練紀錄
          </span>
        </div>

        {/* MOBILE SUPERVISION CARD LIST (< md) */}
        <div className="md:hidden space-y-3">
          {filteredRecords.length === 0 ? (
            <div className="p-8 border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center text-xs text-[var(--text-muted)]">
              尚無此曲目的排練回報紀錄。演員在排練工作台點選練習後將自動顯示於此。
            </div>
          ) : (
            filteredRecords.map((rec) => {
              const meta = MASTERY_STATE_META[rec.masteryState];
              const feedbackVal =
                feedbackDrafts[rec.progressId] !== undefined
                  ? feedbackDrafts[rec.progressId]
                  : rec.directorFeedback || '';

              return (
                <div
                  key={rec.progressId}
                  className="p-3.5 border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-[var(--text-primary)]">
                        {rec.userName || '劇組成員'}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        角色：{rec.characterRole || '演員'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[11px] font-medium border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] shrink-0">
                      {meta?.shortLabel || rec.masteryState}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => onSelectTrackForRehearsal(rec.trackId)}
                      className="text-[var(--accent-gold)] font-semibold hover:underline text-left truncate"
                    >
                      {rec.trackTitle}
                    </button>
                    <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums shrink-0">
                      {rec.practiceCount} 次 · {Math.round(rec.totalPracticeSeconds / 60)} 分
                    </span>
                  </div>

                  {rec.personalNotes && (
                    <div className="p-2 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--status-notice)]">
                      筆記：{rec.personalNotes}
                    </div>
                  )}

                  <div className="pt-1">
                    {isDirectorAdmin ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={feedbackVal}
                          onChange={(e) =>
                            setFeedbackDrafts((prev) => ({
                              ...prev,
                              [rec.progressId]: e.target.value,
                            }))
                          }
                          placeholder="輸入導演／音樂指導評語..."
                          className="min-h-[36px] flex-1 px-2.5 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveFeedback(rec.progressId)}
                          className="min-h-[36px] px-2.5 py-1.5 bg-[var(--accent-gold)] text-black font-semibold inline-flex items-center gap-1 shrink-0"
                          title="儲存評語"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>儲存</span>
                        </button>
                        {(rec.directorFeedback || feedbackVal) && (
                          <button
                            type="button"
                            onClick={() => handleClearFeedback(rec.progressId)}
                            className="min-h-[36px] px-2 py-1.5 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 inline-flex items-center shrink-0"
                            title="清除評語"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[var(--text-muted)]">
                        指導評語：{rec.directorFeedback || '暫無指導評語'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP Progress Records Table (>= md) */}
        <div className="hidden md:block border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--bg-subtle)]">
                <th className="py-3 px-4">演員／成員</th>
                <th className="py-3 px-4">負責角色</th>
                <th className="py-3 px-4">曲目場次</th>
                <th className="py-3 px-4">目前熟練度</th>
                <th className="py-3 px-4">練習次數</th>
                <th className="py-3 px-4">登記加強項目／個人筆記</th>
                <th className="py-3 px-4">導演／音樂指導評語</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-[var(--text-muted)]"
                  >
                    尚無此曲目的排練回報紀錄。演員在排練工作台點選練習後將自動顯示於此。
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const meta = MASTERY_STATE_META[rec.masteryState];
                  const feedbackVal =
                    feedbackDrafts[rec.progressId] !== undefined
                      ? feedbackDrafts[rec.progressId]
                      : rec.directorFeedback || '';

                  return (
                    <tr
                      key={rec.progressId}
                      className="hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-[var(--text-primary)] whitespace-nowrap">
                        {rec.userName || '劇組成員'}
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)] whitespace-nowrap">
                        {rec.characterRole || '演員'}
                      </td>
                      <td className="py-3 px-4 text-[var(--accent-gold)] font-medium">
                        <button
                          type="button"
                          onClick={() => onSelectTrackForRehearsal(rec.trackId)}
                          className="hover:underline text-left"
                        >
                          {rec.trackTitle}
                        </button>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-[11px] font-medium border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)]">
                          {meta?.shortLabel || rec.masteryState}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap text-[var(--text-muted)]">
                        {rec.practiceCount} 次 ·{' '}
                        {Math.round(rec.totalPracticeSeconds / 60)} 分
                      </td>
                      <td className="py-3 px-4 text-[var(--text-secondary)] max-w-xs">
                        {rec.personalNotes ? (
                          <span className="text-[var(--status-notice)]">
                            {rec.personalNotes}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 min-w-[220px]">
                        {isDirectorAdmin ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={feedbackVal}
                              onChange={(e) =>
                                setFeedbackDrafts((prev) => ({
                                  ...prev,
                                  [rec.progressId]: e.target.value,
                                }))
                              }
                              placeholder="輸入指導筆記..."
                              className="w-full px-2 py-1 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs"
                            />
                            {feedbackDrafts[rec.progressId] !== undefined && (
                              <button
                                type="button"
                                onClick={() => handleSaveFeedback(rec.progressId)}
                                className="p-1 text-[var(--accent-gold)] hover:opacity-80"
                                title="儲存評語"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(rec.directorFeedback || feedbackVal) && (
                              <button
                                type="button"
                                onClick={() => handleClearFeedback(rec.progressId)}
                                className="p-1 text-rose-400 hover:opacity-80"
                                title="清除評語"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)]">
                            {rec.directorFeedback || '暫無指導評語'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

SupervisionView.displayName = 'SupervisionView';
