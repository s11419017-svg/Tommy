import React, { useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  Calendar,
  ChevronRight,
  Clock,
  Compass,
  Edit3,
  FileAudio,
  Flame,
  Headphones,
  Music,
  Play,
  Sliders,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { LesMisTrackItem } from '../../data/lesMisTracks';
import {
  ActiveView,
  ProductionCallboard,
  ProgressRecord,
  UserProfileDoc,
} from '../../types/rehearsal';
import {
  MASTERY_STATE_META,
  MasteryState,
} from '../../machines/rehearsalStateMachine';
import heroStageImage from '../../assets/images/hero_les_mis_stage_1792423791822.jpg';

interface PortalViewProps {
  tracks: LesMisTrackItem[];
  callboard: ProductionCallboard;
  calledTracks: LesMisTrackItem[];
  userProfile: UserProfileDoc;
  currentUser: User | null;
  localAudioBlobs: Record<string, { url: string; fileName: string }>;
  progressMap: Record<string, ProgressRecord>;
  onSelectTrackAndEnterStudio: (trackId: string) => void;
  onNavigateView: (view: ActiveView) => void;
  onOpenCallboardEditor: () => void;
  isDirectorAdmin: boolean;
  onOpenCompanion?: () => void;
}

export const PortalView: React.FC<PortalViewProps> = React.memo(
  ({
    tracks,
    callboard,
    calledTracks,
    userProfile,
    currentUser,
    localAudioBlobs,
    progressMap,
    onSelectTrackAndEnterStudio,
    onNavigateView,
    onOpenCallboardEditor,
    isDirectorAdmin,
    onOpenCompanion,
  }) => {
    // Calculate personal stats
    const myStats = useMemo(() => {
      let practicedSongs = 0;
      let totalPracticeSec = 0;
      let masteredSongs = 0;

      Object.values(progressMap).forEach((rec) => {
        if (rec.totalPracticeSeconds > 0) {
          practicedSongs += 1;
          totalPracticeSec += rec.totalPracticeSeconds;
        }
        if (rec.masteryState === MasteryState.STAGE_READY) {
          masteredSongs += 1;
        }
      });

      const hours = (totalPracticeSec / 3600).toFixed(1);
      return { practicedSongs, totalHours: hours, masteredSongs };
    }, [progressMap]);

    const audioReadyCount = Object.keys(localAudioBlobs).length;

    return (
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 xl:px-12 py-4 sm:py-8 pb-24 lg:pb-12 space-y-6 sm:space-y-10 animate-ui-fade-in">
        {/* Hero Banner: Theatrical Portal Presentation */}
        <section className="relative overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="relative h-56 sm:h-72 md:h-80 w-full overflow-hidden">
            <img
              src={heroStageImage}
              alt="Les Misérables Stage Backdrop"
              className="w-full h-full object-cover object-center filter brightness-60 contrast-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-black/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

            <div className="absolute inset-0 p-4 sm:p-8 flex flex-col justify-end">
              <div className="max-w-3xl space-y-1.5 sm:space-y-2">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-[var(--accent-gold)] tracking-wide">
                  <span>劇組排練總部</span>
                  <span aria-hidden="true" className="text-[var(--text-muted)]">·</span>
                  <span className="uppercase text-[10px] text-stone-300 font-mono">Theatrical Rehearsal Hub</span>
                </div>
                <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white drop-shadow-md">
                  Les Misérables
                </h1>
                <p className="text-xs sm:text-base text-stone-200 font-serif-editorial italic line-clamp-2 max-w-2xl drop-shadow-xs">
                  「無論長夜如何漫漫，黎明終將破曉。」
                  歡迎回到排練大廳，今日準備好唱出心中的旋律了嗎？
                </p>
              </div>
            </div>
          </div>

          {/* Today's Callboard Banner */}
          <div className="p-4 sm:p-6 bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-none bg-[var(--accent-gold)]/10 border border-[var(--accent-gold)] flex items-center justify-center shrink-0 text-[var(--accent-gold)]">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="font-bold text-[var(--accent-gold)] tracking-wide">
                    今日通告日誌
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{callboard.dateIso}</span>
                </div>
                <p className="text-xs sm:text-base text-[var(--text-primary)] font-serif-editorial italic leading-relaxed">
                  {callboard.directorNotice || '今日各聲部自主複習，請留意音樂總監指示與換氣點。'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              {isDirectorAdmin && (
                <button
                  type="button"
                  onClick={onOpenCallboardEditor}
                  className="min-h-[44px] sm:min-h-0 px-3.5 py-2 border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span>編輯今日通告</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateView('rehearsal')}
                className="min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:py-2 bg-[var(--accent-gold)] hover:opacity-90 text-black text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-opacity shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>直接進入排練舞台</span>
              </button>
            </div>
          </div>
        </section>

        {/* In-Flow Duolingo-style Streak & Motivation Strip (Never obscures content) */}
        <section
          aria-label="連續排練士氣與督導進度"
          className="p-3.5 sm:p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
              <Flame className="w-4 h-4 fill-amber-400" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--accent-gold)] font-mono">
                  連續排練 3 天連勝
                </span>
                <span className="text-[10px] text-stone-400 font-mono">· 每日 3 分鐘守住火苗</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] italic truncate">
                「無論長夜如何漫漫，黎明終將破曉。」舞台監督在排練場等待您的起音。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {onOpenCompanion && (
              <button
                type="button"
                onClick={onOpenCompanion}
                className="min-h-[40px] px-3.5 py-1.5 border border-[var(--accent-gold-border)] bg-[var(--bg-elevated)] hover:border-[var(--accent-gold)] text-[var(--accent-gold)] text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <span>督導日誌與告急提醒</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </section>

        {/* Section: Today's Called Songs (今日指定召集曲目) */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                今日排練曲目
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-0.5">
                導演指定今日重點走位與合唱場次 ({calledTracks.length} 首)
              </p>
            </div>
            {calledTracks.length > 0 && (
              <span className="text-xs text-[var(--text-muted)] font-mono">
                點選曲目卡片即可立即開唱
              </span>
            )}
          </div>

          {calledTracks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {calledTracks.map((track) => {
                const hasLocalAudio = Boolean(localAudioBlobs[track.trackId]);
                const progress = progressMap[track.trackId];
                const masteryState = progress?.masteryState || 'NOT_STARTED';
                const meta = MASTERY_STATE_META[masteryState];

                return (
                  <div
                    key={track.trackId}
                    className="group border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] bg-[var(--bg-surface)] p-5 transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                        <span className="font-mono font-medium text-[var(--accent-gold)]">
                          {track.act} · 第 {track.order} 首
                        </span>
                        <span>{track.bpm} BPM</span>
                      </div>

                      <div>
                        <h3 className="font-display text-lg font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-gold)] transition-colors">
                          {track.title}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] font-serif-editorial italic mt-0.5">
                          {track.subtitle}
                        </p>
                      </div>

                      <div className="space-y-1 text-xs text-[var(--text-muted)]">
                        <p className="line-clamp-1">
                          <strong className="text-[var(--text-secondary)]">
                            登場角色：
                          </strong>{' '}
                          {track.characters}
                        </p>
                        <p className="line-clamp-2 italic text-[11px]">
                          {track.dramaticContext}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            hasLocalAudio
                              ? 'bg-[var(--status-ready)]'
                              : 'bg-stone-500'
                          }`}
                        />
                        <span>{hasLocalAudio ? '音檔快取' : '雲端伴奏'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[var(--text-secondary)]">
                          {meta?.shortLabel || '尚未開始'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectTrackAndEnterStudio(track.trackId)}
                        className="px-3 py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--accent-gold)] text-[var(--text-primary)] hover:text-black border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] font-bold text-xs inline-flex items-center gap-1 transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>排練</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)] space-y-3">
              <Compass className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-60" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  今日暫未設定特定召集曲目
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  劇組同學可自由瀏覽全劇 21 首曲目或針對個人唱段進行自主溫習。
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateView('tracks')}
                className="px-4 py-2 border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors"
              >
                <Music className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                <span>前往曲目總表庫</span>
              </button>
            </div>
          )}
        </section>

        {/* Section: Personal Dossier & Quick Hub (個人排練檔案與快速捷徑) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1 & 2: Quick Jump Hub */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-3">
              劇組排練工作分區
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => onNavigateView('rehearsal')}
                className="text-left border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] bg-[var(--bg-surface)] p-5 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-[var(--accent-bordeaux)]/15 border border-[var(--accent-bordeaux)]/30 text-[var(--accent-gold)] flex items-center justify-center">
                    <Headphones className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-gold)] transition-colors">
                      排練工作台 (Studio)
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      波形音訊 · A-B 循環 · 提詞走位
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  進入沉浸式音訊排練室，支援逐句跟唱、聲部抽屜分軌等化與即時歌詞滾動。
                </p>
              </button>

              <button
                type="button"
                onClick={() => onNavigateView('tracks')}
                className="text-left border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] bg-[var(--bg-surface)] p-5 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-emerald-950/20 border border-emerald-600/30 text-emerald-400 flex items-center justify-center">
                    <FileAudio className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-gold)] transition-colors">
                      曲目與伴奏總庫 (Catalog)
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      {audioReadyCount} / {tracks.length} 首就緒
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  全劇 21 首曲目一覽，支援音檔批次匯入、目錄自動配對與金庫持久快取。
                </p>
              </button>

              <button
                type="button"
                onClick={() => onNavigateView('supervision')}
                className="text-left border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] bg-[var(--bg-surface)] p-5 transition-all group sm:col-span-2"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 bg-amber-950/20 border border-amber-600/30 text-amber-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-gold)] transition-colors">
                      劇組進度與督導看板 (Supervision)
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      全體聲部練習時數 · 熟練度達成率
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                  音樂總監與排練指導可隨時檢閱各聲部及角色簽到紀錄，並針對走位填寫導演評語。
                </p>
              </button>
            </div>
          </div>

          {/* Col 3: My Rehearsal Dossier */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-3">
              我的排練檔案
            </h2>

            <div className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                  <span>登入演員</span>
                  <span className="text-[var(--accent-gold)]">
                    {userProfile.sectionGroup}
                  </span>
                </div>
                <p className="text-base font-bold text-[var(--text-primary)]">
                  {userProfile.displayName}
                </p>
                <p className="text-xs text-[var(--text-secondary)] font-serif-editorial italic">
                  角色：{userProfile.characterRole}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--border-subtle)] text-center">
                <div className="p-2.5 bg-[var(--bg-subtle)]">
                  <p className="text-lg font-bold font-mono text-[var(--text-primary)]">
                    {myStats.practicedSongs}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">練習曲數</p>
                </div>
                <div className="p-2.5 bg-[var(--bg-subtle)]">
                  <p className="text-lg font-bold font-mono text-[var(--accent-gold)]">
                    {myStats.totalHours}h
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">累計時數</p>
                </div>
                <div className="p-2.5 bg-[var(--bg-subtle)]">
                  <p className="text-lg font-bold font-mono text-emerald-400">
                    {myStats.masteredSongs}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">精通完練</p>
                </div>
              </div>

              <div className="pt-2 text-xs text-[var(--text-muted)]">
                {currentUser ? (
                  <p className="text-emerald-400/90 text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    已連結 Google 帳號，進度即時雲端同步
                  </p>
                ) : (
                  <p className="text-amber-400/80 text-[11px]">
                    目前使用本機離線模式，可登入 Google 同步雲端進度。
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PortalView.displayName = 'PortalView';
