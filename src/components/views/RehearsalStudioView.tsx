import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Edit3,
  HelpCircle,
  List,
  Maximize2,
  Minimize2,
  Music,
  Play,
  Plus,
  Repeat,
  Save,
  ScrollText,
  Sliders,
  Sparkles,
  Trash2,
  Users,
  Volume2,
} from 'lucide-react';
import {
  CAST_ROLES,
  LesMisTrackItem,
  RehearsalCuePoint,
} from '../../data/lesMisTracks';
import {
  canTransitionMastery,
  MASTERY_ORDER,
  MASTERY_STATE_META,
  MasteryState,
} from '../../machines/rehearsalStateMachine';
import {
  CueSpanInfo,
  ProgressRecord,
  TrackStemFiles,
  UserProfileDoc,
} from '../../types/rehearsal';
import { WaveformStudioDeck } from '../WaveformStudioDeck';
import { SmartLyricsSyncModal } from '../SmartLyricsSyncModal';
import { AmateurVocalCoachDeck } from '../AmateurVocalCoachDeck';
import { playReferenceTone } from '../../utils/vocalAudioHelper';

interface RehearsalStudioViewProps {
  selectedTrack: LesMisTrackItem;
  activeAudioSource: {
    type: 'LOCAL_FILE' | 'REMOTE_URL' | 'SILENT_TIMELINE';
    url: string;
    label: string;
  };
  trackStemsMap: Record<string, TrackStemFiles>;
  isEnsembleMode: boolean;
  darkMode: boolean;
  userProfile: UserProfileDoc;
  isDirectorAdmin: boolean;
  currentTrackProgress: ProgressRecord;
  onUpdateTrackProgress: (data: Partial<ProgressRecord>) => void;
  onUpdateTrackCues: (
    nextCues: RehearsalCuePoint[],
    detectedDur?: number
  ) => void;
  onUploadSingleFile: (file: File | null) => void;
  onUpdateTrackStem: (
    targetTrackId: string,
    stemType: 'backing' | 'vocal' | 'drumBass',
    file: File | null
  ) => void;
  onRemoveTrackAudio?: (targetTrackId: string, slot: 'main' | 'backing' | 'vocal' | 'drumBass') => void;
  onTogglePureInstrumentalFlag?: () => void;
  onToggleTrackInTodayCall: (trackId: string) => void;
  isCalledInTodayCall: boolean;
  onShowBanner: (msg: string, type?: 'success' | 'warning') => void;
  autoAdvanceNextTrack: boolean;
  onToggleAutoAdvance: () => void;
  onTrackCompleted: () => void;
  onCacheRemoteTrack?: (trackId: string, remoteUrl: string, label?: string) => void;
  isCachingRemoteTrack?: boolean;
}

import heroStageImage from '../../assets/images/hero_les_mis_stage_1792423791822.jpg';

function getSceneLightingClass(track: LesMisTrackItem): string {
  const titleLower = track.title.toLowerCase();
  if (
    titleLower.includes('barricade') ||
    titleLower.includes('people sing') ||
    titleLower.includes('one day more') ||
    titleLower.includes('red and black') ||
    titleLower.includes('街壘') ||
    titleLower.includes('人民')
  ) {
    return 'from-red-950/80 via-black/75 to-amber-950/40';
  }
  if (
    titleLower.includes('soliloquy') ||
    titleLower.includes('who am i') ||
    titleLower.includes('bring him home') ||
    titleLower.includes('stars') ||
    titleLower.includes('empty chairs') ||
    titleLower.includes('獨白') ||
    titleLower.includes('獨唱')
  ) {
    return 'from-amber-950/70 via-black/85 to-indigo-950/50';
  }
  if (track.act === 'Act II') {
    return 'from-slate-950/80 via-black/80 to-stone-900/40';
  }
  return 'from-zinc-950/80 via-black/80 to-zinc-900/40';
}

function formatSeconds(sec: number): string {
  const safe = Math.max(0, Math.floor(sec || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function isCueForEnsemble(characterFocus: string, sectionTitle: string): boolean {
  const text = `${characterFocus} ${sectionTitle}`.toLowerCase();
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
    text.includes('大家')
  );
}

function doesCueMatchUserRole(
  cue: RehearsalCuePoint,
  isEnsembleMode: boolean,
  userRole: string
): boolean {
  if (isEnsembleMode) {
    return isCueForEnsemble(cue.characterFocus, cue.sectionTitle);
  }
  if (!userRole) return false;
  const roleKeyword = userRole.split('(')[0].trim().toLowerCase();
  return (
    cue.characterFocus.toLowerCase().includes(roleKeyword) ||
    cue.sectionTitle.toLowerCase().includes(roleKeyword)
  );
}

/**
 * Parses stage location keywords from acting tips (e.g. SL, SR, CS, 前緣, 左翼, 右翼)
 * to highlight a visual 3x3 theater blocking grid.
 */
function parseStagePosition(tip: string): { row: number; col: number; label: string } {
  const t = tip.toLowerCase();
  let col = 1; // 0: Left (SL), 1: Center (CS), 2: Right (SR)
  let row = 1; // 0: Upstage, 1: Center Stage, 2: Downstage

  if (t.includes('sl') || t.includes('左') || t.includes('left')) col = 0;
  else if (t.includes('sr') || t.includes('右') || t.includes('right')) col = 2;
  else col = 1;

  if (t.includes('us') || t.includes('後') || t.includes('上舞台') || t.includes('upstage')) row = 0;
  else if (t.includes('ds') || t.includes('前') || t.includes('前緣') || t.includes('下舞台') || t.includes('downstage')) row = 2;
  else row = 1;

  const colNames = ['舞台左翼 (SL)', '舞台中央 (CS)', '舞台右翼 (SR)'];
  const rowNames = ['後舞台 (US)', '中舞台 (MS)', '前台台前 (DS)'];

  return { row, col, label: `${rowNames[row]} · ${colNames[col]}` };
}

export const RehearsalStudioView: React.FC<RehearsalStudioViewProps> =
  React.memo(
    ({
      selectedTrack,
      activeAudioSource,
      trackStemsMap,
      isEnsembleMode,
      darkMode,
      userProfile,
      isDirectorAdmin,
      currentTrackProgress,
      onUpdateTrackProgress,
      onUpdateTrackCues,
      onUploadSingleFile,
      onUpdateTrackStem,
      onRemoveTrackAudio,
      onTogglePureInstrumentalFlag,
      onToggleTrackInTodayCall,
      isCalledInTodayCall,
      onShowBanner,
      autoAdvanceNextTrack,
      onToggleAutoAdvance,
      onTrackCompleted,
      onCacheRemoteTrack,
      isCachingRemoteTrack = false,
    }) => {
      // Focus mode for ultra-distraction-free rehearsal
      const [isFocusMode, setIsFocusMode] = useState<boolean>(() => {
        return localStorage.getItem('lesmis_focus_mode') === 'true';
      });

      const toggleFocusMode = () => {
        setIsFocusMode((prev) => {
          const next = !prev;
          localStorage.setItem('lesmis_focus_mode', String(next));
          return next;
        });
      };

      // Sub-view toggles within the Grid zones
      const [lyricsViewMode, setLyricsViewMode] = useState<'prompter' | 'sheet'>('prompter');
      const [guidanceTab, setGuidanceTab] = useState<'vocal_coach' | 'live' | 'context' | 'notes'>('vocal_coach');

      const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
      const [externalSeekRequest, setExternalSeekRequest] = useState<{
        timeSec: number;
        loopEndSec?: number;
        loopLabel?: string;
        autoPlay: boolean;
        seq: number;
      } | null>(null);

      const [editingCueIdx, setEditingCueIdx] = useState<number | null>(null);
      const [cueEditDraft, setCueEditDraft] = useState<RehearsalCuePoint | null>(null);

      const [newCueDraft, setNewCueDraft] = useState<{
        timeFormatted: string;
        sectionTitle: string;
        characterFocus: string;
        actingTip: string;
        vocalTip: string;
      }>({
        timeFormatted: '00:00',
        sectionTitle: '',
        characterFocus: 'Full Cast Ensemble · 群演合唱',
        actingTip: '',
        vocalTip: '',
      });
      const [showAddCueForm, setShowAddCueForm] = useState(false);
      const [showSmartLyricsModal, setShowSmartLyricsModal] = useState(false);

      const cues = selectedTrack.cues || [];
      const totalDur = Math.max(1, selectedTrack.durationSec || 180);

      const cueSpans: CueSpanInfo[] = useMemo(() => {
        return cues.map((cue, idx) => {
          const startSec = cue.timeSec;
          const endSec = idx + 1 < cues.length ? cues[idx + 1].timeSec : totalDur;
          const isMine = doesCueMatchUserRole(
            cue,
            isEnsembleMode,
            userProfile.characterRole
          );
          return {
            cue,
            idx,
            startSec,
            endSec,
            durationSec: Math.max(5, endSec - startSec),
            leftPct: Math.min(98, (startSec / totalDur) * 100),
            widthPct: Math.max(2, ((endSec - startSec) / totalDur) * 100),
            isMine,
          };
        });
      }, [cues, totalDur, isEnsembleMode, userProfile.characterRole]);

      // Currently active cue span matching currentTimeSec
      const activeCueSpan = useMemo(() => {
        if (cueSpans.length === 0) return null;
        const found = cueSpans.find(
          (s) => currentTimeSec >= s.startSec && currentTimeSec < s.endSec
        );
        if (found) return found;
        if (currentTimeSec < cueSpans[0].startSec) return cueSpans[0];
        return cueSpans[cueSpans.length - 1];
      }, [cueSpans, currentTimeSec]);

      // Next upcoming cue span
      const nextCueSpan = useMemo(() => {
        return cueSpans.find((s) => s.startSec > currentTimeSec) || null;
      }, [cueSpans, currentTimeSec]);

      // Progress percentage within the current cue span
      const activeSpanProgressPct = useMemo(() => {
        if (!activeCueSpan) return 0;
        const elapsed = currentTimeSec - activeCueSpan.startSec;
        return Math.min(100, Math.max(0, (elapsed / activeCueSpan.durationSec) * 100));
      }, [activeCueSpan, currentTimeSec]);

      // Stage position parsed for the active cue
      const activeStagePosition = useMemo(() => {
        if (!activeCueSpan?.cue?.actingTip) {
          return { row: 1, col: 1, label: '中舞台 (CS) · 依總體調度' };
        }
        return parseStagePosition(activeCueSpan.cue.actingTip);
      }, [activeCueSpan]);

      // Auto-scrolling teleprompter ref
      const prompterContainerRef = useRef<HTMLDivElement>(null);
      const activeLyricCardRef = useRef<HTMLDivElement>(null);

      useEffect(() => {
        if (lyricsViewMode === 'prompter' && activeLyricCardRef.current && prompterContainerRef.current) {
          activeLyricCardRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, [activeCueSpan?.idx, lyricsViewMode]);

      const myTotalSingSeconds = useMemo(() => {
        return cueSpans
          .filter((s) => s.isMine)
          .reduce((acc, s) => acc + s.durationSec, 0);
      }, [cueSpans]);

      const handleJumpToMyNextPart = () => {
        const mySpans = cueSpans.filter((s) => s.isMine);
        if (mySpans.length === 0) {
          setExternalSeekRequest({ timeSec: 0, autoPlay: true, seq: Date.now() });
          return;
        }
        const nextSpan =
          mySpans.find((s) => s.startSec > currentTimeSec + 2) || mySpans[0];
        setExternalSeekRequest({
          timeSec: nextSpan.startSec,
          autoPlay: true,
          seq: Date.now(),
        });
        onShowBanner(
          `已跳至負責進場段落：「${nextSpan.cue.sectionTitle}」(${formatSeconds(
            nextSpan.startSec
          )})`
        );
      };

      const handleMasteryStateChange = (targetState: MasteryState) => {
        const check = canTransitionMastery(
          currentTrackProgress.masteryState,
          targetState,
          isDirectorAdmin
        );
        if (!check.allowed) {
          if (check.reason) onShowBanner(check.reason, 'warning');
          return;
        }
        onUpdateTrackProgress({ masteryState: targetState });
      };

      const handleQuickSosTag = (sosLabel: string) => {
        const existing = currentTrackProgress.personalNotes || '';
        const nextNote = existing.includes(sosLabel)
          ? existing
          : existing
          ? `${existing} · ${sosLabel}`
          : sosLabel;
        onUpdateTrackProgress({ personalNotes: nextNote });
        onShowBanner(`已登記排練備註：「${sosLabel}」，已同步至進度表。`);
      };

      const handleStartEditCue = (idx: number, cue: RehearsalCuePoint) => {
        setEditingCueIdx(idx);
        setCueEditDraft({ ...cue });
      };

      const handleSaveCueEdit = () => {
        if (editingCueIdx === null || !cueEditDraft) return;
        const parts = (cueEditDraft.timeFormatted || '00:00').split(':');
        let parsedSec = cueEditDraft.timeSec;
        if (parts.length === 2) {
          parsedSec =
            (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
        } else if (parts.length === 1 && parts[0].trim() !== '') {
          parsedSec = parseInt(parts[0], 10) || 0;
        }
        const updatedCue: RehearsalCuePoint = {
          ...cueEditDraft,
          timeSec: Math.max(0, parsedSec),
          timeFormatted: formatSeconds(Math.max(0, parsedSec)),
        };
        const nextCues = [...cues];
        nextCues[editingCueIdx] = updatedCue;
        nextCues.sort((a, b) => a.timeSec - b.timeSec);
        onUpdateTrackCues(nextCues);
        setEditingCueIdx(null);
        setCueEditDraft(null);
        onShowBanner('已儲存時間軸段落與走位資訊。');
      };

      const handleDeleteCue = (idx: number) => {
        const nextCues = cues.filter((_, i) => i !== idx);
        onUpdateTrackCues(nextCues);
        if (editingCueIdx === idx) {
          setEditingCueIdx(null);
          setCueEditDraft(null);
        }
        onShowBanner('已刪除段落標記。');
      };

      const handleAddNewCue = (e: React.FormEvent) => {
        e.preventDefault();
        const parts = newCueDraft.timeFormatted.split(':');
        let sec = 0;
        if (parts.length === 2) {
          sec = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
        } else {
          sec = parseInt(parts[0], 10) || 0;
        }

        const newCue: RehearsalCuePoint = {
          timeSec: sec,
          timeFormatted: formatSeconds(sec),
          sectionTitle: newCueDraft.sectionTitle.trim() || '自訂段落',
          characterFocus: newCueDraft.characterFocus,
          actingTip: newCueDraft.actingTip.trim(),
          vocalTip: newCueDraft.vocalTip.trim(),
        };

        const next = [...cues, newCue].sort((a, b) => a.timeSec - b.timeSec);
        onUpdateTrackCues(next);
        setShowAddCueForm(false);
        setNewCueDraft({
          timeFormatted: formatSeconds(sec + 30),
          sectionTitle: '',
          characterFocus: 'Full Cast Ensemble · 群演合唱',
          actingTip: '',
          vocalTip: '',
        });
        onShowBanner('已新增時間軸段落標記。');
      };

      const lightingClass = getSceneLightingClass(selectedTrack);

      return (
        <div className="flex-1 min-w-0 p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-4 sm:space-y-6">
          {/* ====================================================================
              UPPER STAGE HEADER (Marquee Backdrop or Compact Bar in Focus Mode)
             ==================================================================== */}
          {isFocusMode ? (
            <div className="border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-[var(--accent-gold)] font-bold shrink-0">
                  {selectedTrack.act} · 第 {selectedTrack.order} 首
                </span>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="font-display font-bold text-sm sm:text-base text-[var(--text-primary)] truncate">
                  {selectedTrack.title}
                </span>
                <span className="text-[var(--text-muted)] font-serif-editorial italic hidden md:inline truncate">
                  {selectedTrack.subtitle}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleJumpToMyNextPart}
                  className="ui-btn px-2.5 py-1 bg-[var(--accent-gold)] text-black font-bold inline-flex items-center gap-1 text-xs"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>跳至唱段 ({formatSeconds(myTotalSingSeconds)})</span>
                </button>

                <button
                  type="button"
                  onClick={toggleFocusMode}
                  className="ui-btn px-2.5 py-1 border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 text-xs transition-colors"
                  title="退出專注模式"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span>退出專注</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="relative rounded-sm overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <div className="relative h-28 sm:h-32 w-full overflow-hidden">
                <img
                  src={heroStageImage}
                  alt="Stage backdrop"
                  className="w-full h-full object-cover object-center opacity-30"
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${lightingClass} opacity-60 mix-blend-multiply`}
                />
                <div
                  className={`absolute inset-0 ${
                    darkMode
                      ? 'bg-gradient-to-t from-[var(--bg-canvas)] via-[var(--bg-canvas)]/85 to-black/45'
                      : 'bg-gradient-to-t from-[var(--bg-surface)] via-[var(--bg-surface)]/90 to-transparent'
                  }`}
                />
                <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-end">
                  <div className="flex flex-wrap items-center gap-2 mb-1 text-xs">
                    <span className="px-2 py-0.5 bg-[var(--accent-bordeaux)] text-white font-bold">
                      {selectedTrack.act}
                    </span>
                    <span className="text-[var(--accent-gold)] font-mono">
                      {selectedTrack.bpm} BPM
                    </span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <span className="text-[var(--text-secondary)]">
                      {selectedTrack.subtitle}
                    </span>
                  </div>
                  <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
                    {selectedTrack.title}
                  </h1>
                </div>
              </div>

              {/* Quick Action Toolbar underneath the Hero */}
              <div className="p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-xs">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={handleJumpToMyNextPart}
                    className="ui-btn min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent-gold)] text-black font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                    <span>跳至我負責的唱段 ({formatSeconds(myTotalSingSeconds)})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleTrackInTodayCall(selectedTrack.trackId)}
                    className={`ui-btn min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 border transition-colors whitespace-nowrap ${
                      isCalledInTodayCall
                        ? 'border-amber-500/70 text-amber-400 bg-amber-500/10 font-bold'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {isCalledInTodayCall ? '已在今日通告' : '設為今日通告'}
                    </span>
                  </button>

                  {/* Remote Cloud Audio Direct Cache Action */}
                  {activeAudioSource.type === 'REMOTE_URL' && onCacheRemoteTrack && (
                    <button
                      type="button"
                      onClick={() =>
                        onCacheRemoteTrack(
                          selectedTrack.trackId,
                          activeAudioSource.url,
                          selectedTrack.audioLabel || selectedTrack.title
                        )
                      }
                      disabled={isCachingRemoteTrack}
                      className="ui-btn min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/70 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-bold transition-colors whitespace-nowrap"
                    >
                      <span>
                        {isCachingRemoteTrack ? '快取下載中...' : '快取至本機金庫'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleFocusMode}
                    className="ui-btn min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
                    title="專注排練模式"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    <span>專注排練</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 text-[var(--text-muted)] font-mono tabular-nums">
                  <span>
                    段落：{cues.length} 個 · 演唱：{cueSpans.filter((s) => s.isMine).length} 段
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================================
              2026 THEATRICAL STUDIO CSS GRID STAGE
              分區架構：
              1. 音訊波形主控區 (col-span-12)
              2. 字幕導唱區 (col-span-12 lg:col-span-7 固定視窗高，即時跟唱提詞)
              3. 戲劇指引區 (col-span-12 lg:col-span-5 固定視窗高，即時走位與導演提示)
             ==================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* ------------------------------------------------------------------
                ZONE 1: 音訊波形與主控座 (Audio Waveform & Transport Console)
               ------------------------------------------------------------------ */}
            <section className="col-span-12 border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
              <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-gold)] animate-pulse" />
                  <span className="font-bold text-[var(--text-primary)] tracking-wide">
                    音訊波形主控座
                  </span>
                  <span className="text-[var(--text-muted)] font-mono hidden sm:inline">
                    · {activeAudioSource.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums">
                  <span className="text-[var(--accent-gold)] font-bold">
                    {formatSeconds(currentTimeSec)}
                  </span>
                  <span className="text-[var(--text-muted)]">/</span>
                  <span className="text-[var(--text-muted)]">
                    {formatSeconds(totalDur)}
                  </span>
                </div>
              </div>

              {/* Core WaveSurfer Studio Deck */}
              <WaveformStudioDeck
                trackId={selectedTrack.trackId}
                trackTitle={selectedTrack.title}
                durationSec={selectedTrack.durationSec}
                bpm={selectedTrack.bpm}
                audioUrl={activeAudioSource.url}
                audioLabel={activeAudioSource.label}
                isCustomAudio={activeAudioSource.type === 'LOCAL_FILE'}
                darkMode={darkMode}
                isEnsembleMode={isEnsembleMode}
                cues={cues}
                stems={trackStemsMap[selectedTrack.trackId]}
                autoAdvanceNextTrack={autoAdvanceNextTrack}
                onToggleAutoAdvance={onToggleAutoAdvance}
                onUpdateStems={(stemType, file) =>
                  onUpdateTrackStem(selectedTrack.trackId, stemType, file)
                }
                onRemoveTrackAudio={
                  onRemoveTrackAudio
                    ? (slot) => {
                        if (slot && slot !== 'all') {
                          onRemoveTrackAudio(selectedTrack.trackId, slot);
                        } else {
                          onRemoveTrackAudio(selectedTrack.trackId, 'main');
                        }
                      }
                    : undefined
                }
                onTogglePureInstrumentalFlag={onTogglePureInstrumentalFlag}
                onCuesChange={onUpdateTrackCues}
                onUploadSingleFile={onUploadSingleFile}
                onTrackCompleted={onTrackCompleted}
                onShowBanner={onShowBanner}
                externalSeekRequest={externalSeekRequest}
                onTimeUpdate={setCurrentTimeSec}
              />
            </section>

            {/* ------------------------------------------------------------------
                ZONE 2: 字幕導唱區 (Live Subtitles & Karaoke Teleprompter)
                - 固定高度容器，依當前播放秒數自動置中滾動高亮當前歌詞
                - 支援切換為段落總表進行批次標記或編輯
               ------------------------------------------------------------------ */}
            <section className="col-span-12 lg:col-span-7 border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col h-[520px] xl:h-[560px] overflow-hidden shadow-xs">
              {/* Header Toolbar */}
              <div className="p-3 sm:px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-[var(--accent-gold)]" />
                  <span className="font-bold text-[var(--text-primary)]">
                    字幕導唱區
                  </span>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--accent-gold)]">
                    {cues.length} 段唱詞
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="inline-flex items-center border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                    <button
                      type="button"
                      onClick={() => setLyricsViewMode('prompter')}
                      className={`ui-instant px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1 ${
                        lyricsViewMode === 'prompter'
                          ? 'bg-[var(--accent-gold)] text-black font-bold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      title="跟隨音樂播放置中自動滾動"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>滾動導唱</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLyricsViewMode('sheet')}
                      className={`ui-instant px-2.5 py-1 text-xs font-medium inline-flex items-center gap-1 ${
                        lyricsViewMode === 'sheet'
                          ? 'bg-[var(--accent-gold)] text-black font-bold'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      title="總表模式可編輯時間碼與歌詞"
                    >
                      <List className="w-3 h-3" />
                      <span>段落總表</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSmartLyricsModal(true)}
                    className="ui-btn px-2.5 py-1 bg-[var(--accent-gold)] text-black hover:brightness-110 text-xs inline-flex items-center gap-1 font-bold whitespace-nowrap shadow-sm"
                    title="免逐句輸入！支援貼上劇本文字自動識別角色、一鍵均分或跟唱空白鍵打點"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>智慧歌詞 / 打點</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddCueForm((prev) => !prev)}
                    className="ui-btn px-2.5 py-1 border border-[var(--accent-gold-border)] bg-[var(--bg-surface)] text-[var(--accent-gold)] hover:bg-[var(--bg-highlight)] text-xs inline-flex items-center gap-1 font-medium whitespace-nowrap"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{showAddCueForm ? '收起' : '單句新增'}</span>
                  </button>
                </div>
              </div>

              {/* Add New Cue Form Drawer */}
              {showAddCueForm && (
                <form
                  onSubmit={handleAddNewCue}
                  className="p-3 sm:p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-2.5 text-xs shrink-0"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[var(--text-muted)] mb-1 font-mono">時間標籤 (分:秒)</label>
                      <input
                        type="text"
                        value={newCueDraft.timeFormatted}
                        onChange={(e) =>
                          setNewCueDraft((prev) => ({
                            ...prev,
                            timeFormatted: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono"
                        placeholder="例如 01:25"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-muted)] mb-1">歌詞或段落名稱</label>
                      <input
                        type="text"
                        value={newCueDraft.sectionTitle}
                        onChange={(e) =>
                          setNewCueDraft((prev) => ({
                            ...prev,
                            sectionTitle: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                        placeholder="輸入歌詞句"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-muted)] mb-1">演唱角色或組別</label>
                      <input
                        type="text"
                        value={newCueDraft.characterFocus}
                        onChange={(e) =>
                          setNewCueDraft((prev) => ({
                            ...prev,
                            characterFocus: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                        placeholder="例如 Full Cast Ensemble"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[var(--text-muted)] mb-1">舞台走位指引</label>
                      <input
                        type="text"
                        value={newCueDraft.actingTip}
                        onChange={(e) =>
                          setNewCueDraft((prev) => ({
                            ...prev,
                            actingTip: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                        placeholder="例如：SL 左翼進場、推向舞台前緣"
                      />
                    </div>
                    <div>
                      <label className="block text-[var(--text-muted)] mb-1">發聲呼吸提示</label>
                      <input
                        type="text"
                        value={newCueDraft.vocalTip}
                        onChange={(e) =>
                          setNewCueDraft((prev) => ({
                            ...prev,
                            vocalTip: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                        placeholder="例如：提氣支撐、大合唱進場"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddCueForm(false)}
                      className="px-3 py-1 border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1 bg-[var(--accent-gold)] text-black font-bold"
                    >
                      儲存段落
                    </button>
                  </div>
                </form>
              )}

              {/* MODE A: LIVE SCROLLING TELEPROMPTER */}
              {lyricsViewMode === 'prompter' && (
                <div
                  ref={prompterContainerRef}
                  className="flex-1 overflow-y-auto p-4 space-y-3.5 scroll-smooth divide-y divide-[var(--border-subtle)]/50"
                >
                  {cues.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)] space-y-3">
                      <ScrollText className="w-10 h-10 opacity-40 text-[var(--accent-gold)]" />
                      <div className="text-sm font-bold text-[var(--text-primary)]">
                        此曲目目前尚未掛載歌詞字幕時間軸
                      </div>
                      <p className="text-xs max-w-sm text-[var(--text-muted)] leading-relaxed">
                        不必逐字手打！可貼上整篇純文字歌詞自動識別角色、一鍵依曲長均分，或跟隨音樂敲空白鍵即時打點。
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowSmartLyricsModal(true)}
                          className="ui-btn px-4 py-2 bg-[var(--accent-gold)] text-black text-xs font-bold inline-flex items-center gap-1.5 shadow-md hover:brightness-110"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>開啟智慧歌詞與打點精靈</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddCueForm(true)}
                          className="ui-btn px-3 py-2 border border-[var(--border-subtle)] hover:border-[var(--accent-gold-border)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>手動單句新增</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {nextCueSpan &&
                        nextCueSpan.startSec > currentTimeSec &&
                        nextCueSpan.startSec - currentTimeSec <= 5 && (
                          <div className="sticky top-0 z-20 p-2.5 bg-amber-950/95 border border-amber-500/80 backdrop-blur-md text-amber-200 text-xs flex items-center justify-between shadow-lg">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                              <span className="font-bold">
                                ⚡ 倒數 {(nextCueSpan.startSec - currentTimeSec).toFixed(1)} 秒進場 —— 請深吸氣、對齊拍點！
                              </span>
                            </div>
                            <span className="font-mono text-[11px] bg-black/60 px-2 py-0.5 rounded text-amber-400 font-extrabold">
                              【{nextCueSpan.cue.characterFocus.split('·')[0].trim()}】
                            </span>
                          </div>
                        )}
                      {cueSpans.map((span) => {
                      const isActive = activeCueSpan?.idx === span.idx;
                      const isPast = currentTimeSec >= span.endSec;

                      return (
                        <div
                          key={span.idx}
                          ref={isActive ? activeLyricCardRef : undefined}
                          className={`pt-3.5 first:pt-0 transition-all duration-200 ${
                            isActive
                              ? 'p-3.5 -mx-1 border-l-4 border-l-[var(--accent-gold)] bg-[var(--bg-highlight)] shadow-sm'
                              : isPast
                              ? 'opacity-65 hover:opacity-100'
                              : 'opacity-90 hover:opacity-100'
                          }`}
                        >
                          {/* Progress Line for the Active Cue */}
                          {isActive && (
                            <div className="w-full h-1 bg-[var(--border-subtle)] mb-2.5 overflow-hidden rounded-full">
                              <div
                                className="h-full bg-[var(--accent-gold)] transition-all duration-150"
                                style={{ width: `${activeSpanProgressPct}%` }}
                              />
                            </div>
                          )}

                          <div className="flex items-start justify-between gap-3">
                            {/* Main Lyric Block */}
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExternalSeekRequest({
                                      timeSec: span.startSec,
                                      autoPlay: true,
                                      seq: Date.now(),
                                    })
                                  }
                                  className={`font-mono tabular-nums font-bold inline-flex items-center gap-1 hover:underline ${
                                    isActive
                                      ? 'text-[var(--accent-gold)]'
                                      : 'text-[var(--text-muted)]'
                                  }`}
                                  title="點擊跳至此句秒數"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>{span.cue.timeFormatted}</span>
                                </button>

                                <span className="text-[var(--text-muted)]">·</span>

                                <span
                                  className={`text-[11px] px-1.5 py-0.2 border ${
                                    span.isMine
                                      ? 'border-[var(--accent-gold-border)] text-[var(--accent-gold)] bg-[var(--bg-elevated)] font-semibold'
                                      : 'border-transparent text-[var(--text-muted)]'
                                  }`}
                                >
                                  {span.cue.characterFocus}
                                </span>

                                {span.isMine && (
                                  <span className="text-[10px] text-[var(--accent-gold)] font-bold">
                                    ★ 我的唱段
                                  </span>
                                )}
                              </div>

                              {/* Prompter Lyric Typography */}
                              <div
                                className={`font-display tracking-tight leading-snug break-words transition-colors ${
                                  isActive
                                    ? 'text-lg sm:text-xl font-bold text-[var(--accent-gold)]'
                                    : 'text-sm sm:text-base font-medium text-[var(--text-primary)]'
                                }`}
                              >
                                {span.cue.sectionTitle}
                              </div>

                              {/* Subtitle / Tip Hint */}
                              {span.cue.vocalTip && span.cue.vocalTip !== span.cue.sectionTitle && (
                                <div className="text-xs text-[var(--text-muted)] line-clamp-1 italic">
                                  發聲提示：{span.cue.vocalTip}
                                </div>
                              )}
                            </div>

                            {/* Actions: Loop & Seek */}
                            <div className="flex items-center gap-1.5 shrink-0 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  playReferenceTone(261.63, 1.2);
                                  onShowBanner('已給起音：C4 (中央 C 基準音)，請開口前哼鳴對齊');
                                }}
                                className={`ui-instant px-2 py-1 text-xs border rounded-none inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
                                  isActive
                                    ? 'border-[var(--accent-gold-border)] bg-[var(--bg-surface)] text-[var(--accent-gold)] font-medium hover:brightness-110'
                                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                                title="播放開口起音基準音 (C4)"
                              >
                                <Volume2 className="w-3 h-3" />
                                <span className="hidden sm:inline">給音</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setExternalSeekRequest({
                                    timeSec: span.startSec,
                                    loopEndSec: span.endSec,
                                    loopLabel: span.cue.sectionTitle,
                                    autoPlay: true,
                                    seq: Date.now(),
                                  })
                                }
                                className={`ui-instant px-2 py-1 text-xs border rounded-none inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
                                  isActive
                                    ? 'border-[var(--accent-gold-border)] bg-[var(--bg-surface)] text-[var(--accent-gold)] font-medium'
                                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                                title="單句循環練習"
                              >
                                <Repeat className="w-3 h-3" />
                                <span className="hidden sm:inline">循環</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    </>
                  )}
                </div>
              )}

              {/* MODE B: FULL SHEET TABLE (For Batch Editing & Adding) */}
              {lyricsViewMode === 'sheet' && (
                <div className="flex-1 overflow-y-auto p-3 text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-mono text-[11px]">
                        <th className="py-2 px-2">時間碼</th>
                        <th className="py-2 px-2">歌詞／段落</th>
                        <th className="py-2 px-2">角色</th>
                        <th className="py-2 px-2 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {cueSpans.map((span) => {
                        const isCurrentPlaying =
                          currentTimeSec >= span.startSec &&
                          currentTimeSec < span.endSec;
                        const isEditing = editingCueIdx === span.idx;

                        return (
                          <tr
                            key={span.idx}
                            className={`transition-colors ${
                              isCurrentPlaying
                                ? 'bg-[var(--bg-highlight)] font-medium'
                                : 'hover:bg-[var(--bg-subtle)]'
                            }`}
                          >
                            <td className="py-2 px-2 font-mono text-[var(--accent-gold)] font-bold whitespace-nowrap tabular-nums">
                              {isEditing && cueEditDraft ? (
                                <input
                                  type="text"
                                  value={cueEditDraft.timeFormatted}
                                  onChange={(e) =>
                                    setCueEditDraft((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            timeFormatted: e.target.value,
                                          }
                                        : null
                                    )
                                  }
                                  className="w-16 px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] font-mono"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExternalSeekRequest({
                                      timeSec: span.startSec,
                                      autoPlay: true,
                                      seq: Date.now(),
                                    })
                                  }
                                  className="hover:underline flex items-center gap-1"
                                >
                                  <Play className="w-2.5 h-2.5 fill-current" />
                                  <span>{span.cue.timeFormatted}</span>
                                </button>
                              )}
                            </td>

                            <td className="py-2 px-2 text-[var(--text-primary)]">
                              {isEditing && cueEditDraft ? (
                                <input
                                  type="text"
                                  value={cueEditDraft.sectionTitle}
                                  onChange={(e) =>
                                    setCueEditDraft((prev) =>
                                      prev
                                        ? { ...prev, sectionTitle: e.target.value }
                                        : null
                                    )
                                  }
                                  className="w-full px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                                />
                              ) : (
                                <div className="font-medium line-clamp-1">
                                  {span.cue.sectionTitle}
                                </div>
                              )}
                            </td>

                            <td className="py-2 px-2 text-[var(--text-muted)] whitespace-nowrap">
                              {isEditing && cueEditDraft ? (
                                <input
                                  type="text"
                                  value={cueEditDraft.characterFocus}
                                  onChange={(e) =>
                                    setCueEditDraft((prev) =>
                                      prev
                                        ? { ...prev, characterFocus: e.target.value }
                                        : null
                                    )
                                  }
                                  className="w-24 px-1.5 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
                                />
                              ) : (
                                <span className={span.isMine ? 'text-[var(--accent-gold)] font-bold' : ''}>
                                  {span.cue.characterFocus}
                                </span>
                              )}
                            </td>

                            <td className="py-2 px-2 text-right whitespace-nowrap">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleSaveCueEdit}
                                    className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 inline-flex items-center gap-1"
                                    title="儲存"
                                  >
                                    <Save className="w-3 h-3" />
                                    <span>儲存</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCueIdx(null);
                                      setCueEditDraft(null);
                                    }}
                                    className="px-1.5 py-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditCue(span.idx, span.cue)}
                                    className="p-1 border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-gold)]"
                                    title="編輯"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCue(span.idx)}
                                    className="p-1 border border-red-500/30 text-red-400 hover:bg-red-500/10"
                                    title="刪除"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ------------------------------------------------------------------
                ZONE 3: 戲劇指引區 (Dramatic Guidance & Stage Blocking)
                - 固定高度容器，與音訊時間軸動態連動
                - 包含：即時舞台方位走位圖、導演指引、情境脈絡、個人排練筆記
               ------------------------------------------------------------------ */}
            <section className="col-span-12 lg:col-span-5 border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col h-[520px] xl:h-[560px] overflow-hidden shadow-xs">
              {/* Header Tab Bar */}
              <div className="p-3 sm:px-4 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[var(--accent-gold)]" />
                  <span className="font-bold text-[var(--text-primary)]">
                    戲劇指引區
                  </span>
                </div>

                <div className="flex items-center gap-1 border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setGuidanceTab('vocal_coach')}
                    className={`ui-instant px-2.5 py-0.5 text-xs font-bold inline-flex items-center gap-1 ${
                      guidanceTab === 'vocal_coach'
                        ? 'bg-[var(--accent-gold)] text-black'
                        : 'text-[var(--accent-gold)] hover:bg-[var(--bg-highlight)]'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>業餘演唱教練</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuidanceTab('live')}
                    className={`ui-instant px-2 py-0.5 text-xs font-medium ${
                      guidanceTab === 'live'
                        ? 'bg-[var(--accent-gold)] text-black font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    即時走位
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuidanceTab('context')}
                    className={`ui-instant px-2 py-0.5 text-xs font-medium ${
                      guidanceTab === 'context'
                        ? 'bg-[var(--accent-gold)] text-black font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    情境潛台詞
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuidanceTab('notes')}
                    className={`ui-instant px-2 py-0.5 text-xs font-medium ${
                      guidanceTab === 'notes'
                        ? 'bg-[var(--accent-gold)] text-black font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    熟練與筆記
                  </button>
                </div>
              </div>

              {/* TAB 0: AMATEUR VOCAL COACH & PITCH ASSIST */}
              {guidanceTab === 'vocal_coach' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <AmateurVocalCoachDeck
                    currentTimeSec={currentTimeSec}
                    nextCueTimeSec={nextCueSpan ? nextCueSpan.startSec : undefined}
                    nextCueTitle={nextCueSpan ? nextCueSpan.cue.sectionTitle : undefined}
                    activeCueTitle={activeCueSpan ? activeCueSpan.cue.sectionTitle : undefined}
                    isCueActive={
                      !!activeCueSpan &&
                      currentTimeSec >= activeCueSpan.startSec &&
                      currentTimeSec < activeCueSpan.endSec
                    }
                    onShowBanner={onShowBanner}
                  />
                </div>
              )}

              {/* TAB 1: LIVE STAGE BLOCKING & VOCAL TECHNIQUE */}
              {guidanceTab === 'live' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                  {/* Real-time Theatrical Stage Positioning 3x3 Matrix */}
                  <div className="p-3.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-[var(--accent-gold)] flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5" />
                        <span>舞台方位指示 (Stage Blocking Matrix)</span>
                      </div>
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        {activeStagePosition.label}
                      </span>
                    </div>

                    {/* 3x3 Stage Matrix Visualizer */}
                    <div className="grid grid-cols-3 gap-1.5 p-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      {[
                        { label: '後左 US-L', r: 0, c: 0 },
                        { label: '後中 US-C', r: 0, c: 1 },
                        { label: '後右 US-R', r: 0, c: 2 },
                        { label: '中左 MS-L', r: 1, c: 0 },
                        { label: '中舞台 CS', r: 1, c: 1 },
                        { label: '中右 MS-R', r: 1, c: 2 },
                        { label: '前左 DS-L', r: 2, c: 0 },
                        { label: '前中 DS-C', r: 2, c: 1 },
                        { label: '前右 DS-R', r: 2, c: 2 },
                      ].map((cell) => {
                        const isSpotlight =
                          activeStagePosition.row === cell.r &&
                          activeStagePosition.col === cell.c;

                        return (
                          <div
                            key={cell.label}
                            className={`py-2 px-1 text-center font-mono text-[10px] border transition-all duration-200 ${
                              isSpotlight
                                ? 'bg-[var(--accent-gold)] text-black font-bold border-[var(--accent-gold)] shadow-xs scale-102'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-transparent'
                            }`}
                          >
                            <div>{cell.label}</div>
                            {isSpotlight && (
                              <div className="text-[9px] uppercase tracking-wider mt-0.5">
                                ● 當前站位
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-[10px] text-center text-[var(--text-muted)] font-mono">
                      ▲ 上舞台 (Upstage / 幕後) · 觀眾席方向 ▼ (Audience / Downstage)
                    </div>
                  </div>

                  {/* Active Acting & Movement Card */}
                  <div className="p-3.5 border border-[var(--accent-gold-border)] bg-[var(--bg-highlight)] space-y-1.5">
                    <div className="text-[11px] font-bold text-[var(--accent-gold)] flex items-center justify-between">
                      <span>當前段落動作與走位指示</span>
                      <span className="font-mono tabular-nums">
                        {activeCueSpan?.cue?.timeFormatted || '00:00'}
                      </span>
                    </div>
                    <div className="font-display text-sm font-bold text-[var(--text-primary)]">
                      {activeCueSpan?.cue?.actingTip || '依導演與舞台監督調度開口'}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      上場角色：{activeCueSpan?.cue?.characterFocus || selectedTrack.characters}
                    </div>
                  </div>

                  {/* Vocal & Breath Reminder */}
                  <div className="p-3.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-1.5">
                    <div className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                      <span>發聲技巧與氣息提醒 (Vocal Tip)</span>
                    </div>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      {activeCueSpan?.cue?.vocalTip || selectedTrack.vocalTips || '穩健提氣支撐，專注於指揮給音拍點。'}
                    </p>
                  </div>

                  {/* Upcoming Entrance Countdown Banner */}
                  {nextCueSpan && (
                    <div className="p-3 border border-[var(--border-subtle)] bg-[var(--bg-subtle)] flex items-center justify-between gap-2 text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-[11px] text-[var(--text-muted)]">
                          下一進場點：{nextCueSpan.cue.timeFormatted} (約 {Math.max(0, Math.round(nextCueSpan.startSec - currentTimeSec))} 秒後)
                        </div>
                        <div className="font-medium text-[var(--text-primary)] truncate">
                          「{nextCueSpan.cue.sectionTitle}」
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExternalSeekRequest({
                            timeSec: nextCueSpan.startSec,
                            autoPlay: true,
                            seq: Date.now(),
                          })
                        }
                        className="ui-instant px-2 py-1 border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--accent-gold)] shrink-0 font-medium"
                      >
                        跳至預備
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: DRAMATIC CONTEXT & LIBRETTO SUBTEXT */}
              {guidanceTab === 'context' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-relaxed">
                  <div>
                    <h4 className="font-bold text-[var(--accent-gold)] mb-1 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>戲劇情境與時代背景 (Dramatic Context)</span>
                    </h4>
                    <p className="text-[var(--text-secondary)]">
                      {selectedTrack.dramaticContext}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)]">
                    <h4 className="font-bold text-[var(--accent-gold)] mb-1">
                      唱詞潛台詞與心理動機 (Subtext &amp; Objective)
                    </h4>
                    <p className="text-[var(--text-secondary)]">
                      {selectedTrack.librettoSubtext}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3">
                    <div>
                      <h5 className="font-semibold text-[var(--text-primary)] mb-1">
                        聲樂技巧指引 (Vocal Advice)
                      </h5>
                      <p className="text-[var(--text-muted)]">
                        {selectedTrack.vocalTips}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-[var(--text-primary)] mb-1">
                        身體儀態與表演調度 (Acting &amp; Posture)
                      </h5>
                      <p className="text-[var(--text-muted)]">
                        {selectedTrack.actingTips}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MASTERY TRACKER & PERSONAL NOTES */}
              {guidanceTab === 'notes' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                  {/* Mastery 5-Step Buttons */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-primary)]">
                        個人熟練度回報
                      </span>
                      <span className="font-mono text-[var(--text-muted)] tabular-nums">
                        練習 {currentTrackProgress.practiceCount} 次
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      {MASTERY_ORDER.map((st) => {
                        const meta = MASTERY_STATE_META[st];
                        const isActive = currentTrackProgress.masteryState === st;
                        const isPassed =
                          MASTERY_STATE_META[currentTrackProgress.masteryState].step > meta.step;

                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleMasteryStateChange(st)}
                            className={`ui-btn py-1.5 px-2 border text-center transition-colors text-[11px] ${
                              isActive
                                ? 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] font-bold'
                                : isPassed
                                ? 'border-emerald-800/40 text-emerald-400 bg-emerald-950/20'
                                : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-strong)]'
                            }`}
                          >
                            {meta.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick SOS Tags */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                    <span className="text-[var(--accent-gold)] font-medium flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>快速登記需加強重點：</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        '進場切拍需整齊',
                        '高音轉假音需支撐',
                        '法文發音咬字需校對',
                        '過門走位隊形需對位',
                        '氣息不足需偷換氣',
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleQuickSosTag(tag)}
                          className="ui-btn px-2 py-0.5 border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] text-[var(--text-secondary)] text-[11px] transition-colors"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Personal Notes Textarea */}
                  <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between">
                      <label className="block text-[var(--text-secondary)] font-medium">
                        個人排練筆記與心得：
                      </label>
                      {currentTrackProgress.personalNotes && (
                        <button
                          type="button"
                          onClick={() => onUpdateTrackProgress({ personalNotes: '' })}
                          className="ui-instant px-1.5 py-0.5 text-[10px] text-red-400 hover:underline"
                        >
                          清空
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={4}
                      value={currentTrackProgress.personalNotes || ''}
                      onChange={(e) =>
                        onUpdateTrackProgress({ personalNotes: e.target.value })
                      }
                      placeholder="記錄指揮指示、發聲重點或個人心得..."
                      className="w-full p-2.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-gold)] text-xs"
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Smart Lyrics Parser & Tap-to-Sync Studio Modal */}
          <SmartLyricsSyncModal
            isOpen={showSmartLyricsModal}
            onClose={() => setShowSmartLyricsModal(false)}
            trackTitle={selectedTrack.title}
            durationSec={totalDur}
            currentTimeSec={currentTimeSec}
            existingCues={cues}
            onApplyCues={(newCues) => {
              onUpdateTrackCues(newCues, totalDur);
            }}
            onSeekPlay={(timeSec, autoPlay) => {
              setExternalSeekRequest({
                timeSec,
                autoPlay,
                seq: Date.now(),
              });
            }}
            onShowBanner={onShowBanner}
          />
        </div>
      );
    }
  );

RehearsalStudioView.displayName = 'RehearsalStudioView';
