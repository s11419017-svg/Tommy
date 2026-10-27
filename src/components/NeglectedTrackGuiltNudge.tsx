import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  BellRing,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  HelpCircle,
  MessageSquare,
  Music,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { LesMisTrackItem } from '../data/lesMisTracks';
import { ProgressRecord } from '../types/rehearsal';

interface NeglectedTrackGuiltNudgeProps {
  tracks: LesMisTrackItem[];
  calledTrackIds: string[];
  progressMap: Record<string, ProgressRecord>;
  currentUserId: string;
  onSelectTrackAndRehearse: (trackId: string) => void;
  onShowBanner: (msg: string, type?: 'success' | 'warning') => void;
}

interface NeglectedTrackReport {
  track: LesMisTrackItem;
  reason: 'today_called_zero' | 'long_time_unpracticed' | 'low_mastery';
  neglectedDays: number;
  practiceSeconds: number;
  dramaticTitle: string;
  guiltQuote: string;
}

const DRAMA_GUILT_QUOTES = [
  '全組都在等你的進場拍點，你忍心讓大家在街壘孤軍奮戰嗎？',
  '這首歌是合唱大高潮，走音或搶拍觀眾第一個聽得一清二楚！',
  '距離登台首演越來越近，別讓這首成為舞台上的「車禍現場」！',
  '尚萬強已經在後台發抖了，快戴起耳機開口唱一遍給他信心！',
  '賈維督察拿著手銬在後台巡視，這首歌你今天絕對逃不掉！',
];

export const NeglectedTrackGuiltNudge: React.FC<NeglectedTrackGuiltNudgeProps> = ({
  tracks,
  calledTrackIds,
  progressMap,
  currentUserId,
  onSelectTrackAndRehearse,
  onShowBanner,
}) => {
  // Mobile & Web Push Notification Permission State
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    const snoozedUntil = localStorage.getItem('lesmis_guilt_nudge_snooze');
    if (snoozedUntil && Date.now() < Number(snoozedUntil)) {
      return true;
    }
    return false;
  });

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Analyze most neglected & critical track
  const neglectedReport: NeglectedTrackReport | null = useMemo(() => {
    if (tracks.length === 0) return null;
    const now = Date.now();

    // 1. Check if there are called tracks today that have 0 practice or low practice
    for (const trackId of calledTrackIds) {
      const track = tracks.find((t) => t.trackId === trackId);
      if (!track) continue;
      const prog = progressMap[`${currentUserId}_${trackId}`];
      const practiceSec = prog?.totalPracticeSeconds || 0;
      if (practiceSec < 60) {
        return {
          track,
          reason: 'today_called_zero',
          neglectedDays: 1,
          practiceSeconds: practiceSec,
          dramaticTitle: `🚨 今日導演通告急召！《${track.title}》尚未開口！`,
          guiltQuote: '這是導演今日通告單上的首要必練曲目，目前練習進度告急！',
        };
      }
    }

    // 2. Check tracks with lowest practice time or oldest updatedAt
    let worstTrack: LesMisTrackItem = tracks[0];
    let maxNeglectScore = -1;
    let worstPracticeSec = 0;
    let worstNeglectedDays = 0;

    tracks.forEach((track) => {
      const prog = progressMap[`${currentUserId}_${track.trackId}`];
      const practiceSec = prog?.totalPracticeSeconds || 0;
      let daysSinceLast = 3; // default assumed if never practiced

      if (prog?.updatedAtIso) {
        const lastDate = new Date(prog.updatedAtIso).getTime();
        daysSinceLast = Math.max(1, Math.floor((now - lastDate) / (1000 * 3600 * 24)));
      }

      // High importance tracks get bonus weight
      const isEnsembleAnthem =
        track.title.includes('People Sing') ||
        track.title.includes('One Day More') ||
        track.title.includes('Barricade') ||
        track.title.includes('End of the Day');

      const neglectScore =
        (daysSinceLast * 10) + (practiceSec === 0 ? 50 : Math.max(0, 100 - practiceSec)) + (isEnsembleAnthem ? 30 : 0);

      if (neglectScore > maxNeglectScore) {
        maxNeglectScore = neglectScore;
        worstTrack = track;
        worstPracticeSec = practiceSec;
        worstNeglectedDays = daysSinceLast;
      }
    });

    if (maxNeglectScore > 20) {
      const randomQuote = DRAMA_GUILT_QUOTES[worstTrack.order % DRAMA_GUILT_QUOTES.length];
      return {
        track: worstTrack,
        reason: worstPracticeSec === 0 ? 'today_called_zero' : 'long_time_unpracticed',
        neglectedDays: Math.max(1, worstNeglectedDays),
        practiceSeconds: worstPracticeSec,
        dramaticTitle: `⚠️ 街壘排練告急！《${worstTrack.title}》已長達 ${worstNeglectedDays} 天未碰`,
        guiltQuote: randomQuote,
      };
    }

    return null;
  }, [tracks, calledTrackIds, progressMap, currentUserId]);

  // Request Mobile / Desktop Browser Notification Permission
  const handleRequestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      onShowBanner('目前此裝置瀏覽器不支援 Web 原生推播通知，仍會以螢幕浮動提醒呈現。', 'warning');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        onShowBanner('🎉 已成功開啟手機與瀏覽器推播通知授權！排練進度告急時將主動發送推播。', 'success');
        // Trigger immediate sample notification test
        if (neglectedReport) {
          new Notification('《悲慘世界》排練督導部召集', {
            body: `24601 號演員！您已多日未練習《${neglectedReport.track.title}》，首演在即，請立即登入排練室！`,
            icon: '/favicon.ico',
          });
        }
      } else if (perm === 'denied') {
        onShowBanner('您拒絕了通知權限。若想開啟，請至手機/瀏覽器設定中手動允許。', 'warning');
      }
    } catch (err) {
      console.warn('Failed to request notification permission', err);
    }
  };

  // Snooze for 2 hours
  const handleSnooze = () => {
    const twoHoursLater = Date.now() + 2 * 3600 * 1000;
    localStorage.setItem('lesmis_guilt_nudge_snooze', String(twoHoursLater));
    setIsDismissed(true);
    onShowBanner('已暫緩提醒 2 小時。2 小時後舞台監督會再次檢查您的排練進度！');
  };

  // One-click jump to rehearse
  const handleJumpToRehearse = () => {
    if (!neglectedReport) return;
    onSelectTrackAndRehearse(neglectedReport.track.trackId);
    onShowBanner(`⚡ 已直達《${neglectedReport.track.title}》排練室！請戴上耳機開口唱！`, 'success');
  };

  if (!neglectedReport || isDismissed) {
    return null;
  }

  return (
    <aside
      aria-label="排練進度告急提醒"
      className="fixed top-18 right-3 sm:right-6 z-40 max-w-md w-[92vw] sm:w-96 shadow-2xl animate-fade-in"
    >
      <div className="bg-[var(--bg-surface)] border-2 border-amber-600/80 bg-gradient-to-b from-[var(--bg-elevated)] to-black text-[var(--text-primary)] rounded-sm overflow-hidden shadow-2xl">
        {/* Dynamic Warning Header Banner */}
        <div className="p-3 bg-gradient-to-r from-red-950 via-amber-950 to-neutral-900 border-b border-amber-500/50 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
            <span className="font-extrabold text-amber-300 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-current text-amber-400" />
              <span>多鄰國式排練進度情勒告警</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Mobile Notification Button */}
            {notificationPermission !== 'granted' && (
              <button
                type="button"
                onClick={handleRequestPushPermission}
                className="px-2 py-0.5 rounded bg-black/60 hover:bg-black border border-amber-500/50 text-[10px] text-amber-200 inline-flex items-center gap-1 transition-colors"
                title="授權手機/瀏覽器推播，不在網頁時也能收到情勒提醒"
              >
                <BellRing className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">開手機推播</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSnooze}
              className="p-1 text-white/60 hover:text-white transition-colors"
              title="稍後 2 小時再提醒"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Guilt-trip Content Body */}
        <div className="p-3.5 space-y-3 text-xs">
          <div>
            <h4 className="font-bold text-sm text-[var(--accent-gold)] flex items-center gap-1.5">
              <span>{neglectedReport.dramaticTitle}</span>
            </h4>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed bg-[var(--bg-surface)] p-2.5 border-l-2 border-l-amber-500 border border-[var(--border-subtle)] italic">
              "{neglectedReport.guiltQuote}"
            </p>
          </div>

          {/* Stats on the neglected track */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 bg-black/50 border border-[var(--border-subtle)] space-y-0.5">
              <span className="text-[var(--text-muted)] text-[10px]">累計排練時間</span>
              <div className="font-bold text-amber-400">
                {Math.floor(neglectedReport.practiceSeconds / 60)} 分 {neglectedReport.practiceSeconds % 60} 秒
              </div>
            </div>
            <div className="p-2 bg-black/50 border border-[var(--border-subtle)] space-y-0.5">
              <span className="text-[var(--text-muted)] text-[10px]">角色進度狀態</span>
              <div className="font-bold text-red-400">
                {neglectedReport.practiceSeconds === 0 ? '尚未起音 ⚠️' : '熟練度不足 ⏳'}
              </div>
            </div>
          </div>

          {/* Direct One-Click Rehearsal Shortcut */}
          <div className="pt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={handleJumpToRehearse}
              className="flex-1 ui-btn py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs inline-flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>一鍵前往排練《{neglectedReport.track.title}》</span>
            </button>

            <button
              type="button"
              onClick={handleSnooze}
              className="px-2.5 py-2 border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:text-white text-[11px] text-[var(--text-muted)] whitespace-nowrap"
              title="稍後 2 小時再催我"
            >
              2小時後再催
            </button>
          </div>

          {/* Mobile push authorization hint */}
          <div className="border-t border-[var(--border-subtle)] pt-2 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Compass className="w-3 h-3 text-[var(--accent-gold)]" />
              <span>支援手機鎖定螢幕推播通知</span>
            </span>
            {notificationPermission === 'granted' ? (
              <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" />
                已開啟手機推播
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequestPushPermission}
                className="text-[var(--accent-gold)] hover:underline font-bold"
              >
                點此授權手機推播 →
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
