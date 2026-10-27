import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Flame,
  Music,
  Play,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { LesMisTrackItem } from '../data/lesMisTracks';
import { ProgressRecord } from '../types/rehearsal';

export type MascotCharacter = 'director' | 'javert' | 'gavroche';

interface RehearsalCompanionProps {
  tracks: LesMisTrackItem[];
  calledTrackIds: string[];
  progressMap: Record<string, ProgressRecord>;
  currentUserId: string;
  selectedTrackTitle: string;
  onSelectTrackAndRehearse: (trackId: string) => void;
  onShowBanner: (msg: string, type?: 'success' | 'warning') => void;
  isOpenExternal?: boolean;
  onCloseExternal?: () => void;
}

interface StreakData {
  streakDays: number;
  lastPracticeDate: string; // YYYY-MM-DD
  todaySeconds: number;
  dailyGoalSeconds: number; // e.g. 180s (3 mins)
}

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

const MASCOT_PROFILES: Record<
  MascotCharacter,
  {
    name: string;
    title: string;
    avatar: string;
    color: string;
    quotes: {
      done: string[];
      pending: string[];
      urgent: string[];
      broken: string[];
      neglected: string[];
    };
  }
> = {
  director: {
    name: '魔鬼舞台監督',
    title: 'Stage Director',
    avatar: '🎭',
    color: 'from-amber-700 to-amber-950',
    quotes: {
      done: [
        '不錯！今天走位跟拍點都有模有樣，首演有救了！',
        '保持這個連勝士氣，全體合唱群演都會以你的穩定為榮！',
        '今天的氣息很足，下舞台記得多喝溫開水保養聲帶。',
      ],
      pending: [
        '你看過排練表了嗎？距離正式公演沒幾天，你今天還沒開口！',
        '別以為群演站在後面觀眾就聽不到，走音指揮第一個瞪你！',
        '今天只要 3 分鐘跟唱一遍，別讓你的排練連勝紀錄斷掉！',
      ],
      urgent: [
        '已經晚上了！合唱組其他人都在背譜，你忍心讓整組等你嗎？',
        '現在立刻戴耳機唱一遍，否則明天的通告我會親自點名！',
      ],
      broken: [
        '你昨天居然缺席了... 舞台監督心碎了，快用今天補回來！',
      ],
      neglected: [
        '這首歌是全劇大高潮，你已經多日沒碰了，難道要首演當天開天窗？',
        '進場點跟轉調最容易翻車的就是這首，現在立刻進排練室跑一遍！',
      ],
    },
  },
  javert: {
    name: '賈維督察',
    title: 'Inspector Javert',
    avatar: '👮‍♂️',
    color: 'from-blue-900 to-slate-950',
    quotes: {
      done: [
        '恪守職責，日日排練。法律認可你的勤勉，繼續保持！',
        '尚萬強逃不過法網，而你逃不過完美的音準！',
      ],
      pending: [
        '24601 號演員！你今天還沒向麥克風報到，別想逃避排練！',
        '在星光之下，音準的法則不可違背。現在就開口唱！',
        '你以為不練唱我就查不到嗎？連勝紀錄的檔案清楚記著！',
      ],
      urgent: [
        '鐘聲即將敲響！午夜前若不完成 3 分鐘練唱，本督察將簽發逮捕令！',
      ],
      broken: [
        '連勝中斷了！你打破了對舞台的誓言！今天立刻自首補練！',
      ],
      neglected: [
        '檔案顯示這首曲目處於嚴重荒廢狀態！本督察命令你立即開口！',
        '正義不容遲到，合唱的拍點亦然！立刻前往這首排練！',
      ],
    },
  },
  gavroche: {
    name: '街壘少年加夫洛許',
    title: 'Little Gavroche',
    avatar: '🚩',
    color: 'from-red-800 to-amber-950',
    quotes: {
      done: [
        '太帥了！紅旗高高升起！革命少不了你的聲音！',
        '聽見人民在怒吼！你的高音直接震撼了全巴黎！',
      ],
      pending: [
        '大哥哥大姐姐！街壘就要開戰了，快跟我們一起唱《民之所向》！',
        '火苗要熄滅了！只要練一首歌，就能替街壘補充彈藥！',
        '別躺著滑手機啦！巴黎在等你起音！',
      ],
      urgent: [
        '天快黑了，衛兵要包圍街壘了！快開麥克風唱一句！',
      ],
      broken: [
        '嗚嗚嗚... 你昨天沒來街壘，連勝火苗熄滅了... 快重新點燃！',
      ],
      neglected: [
        '這首歌大家都要衝上街壘了，你還沒練熟，子彈都要打光啦！',
        '快點快點！跟加夫洛許一起把這首歌唱到最響亮！',
      ],
    },
  },
};

export const RehearsalCompanion: React.FC<RehearsalCompanionProps> = ({
  tracks,
  calledTrackIds,
  progressMap,
  currentUserId,
  selectedTrackTitle,
  onSelectTrackAndRehearse,
  onShowBanner,
  isOpenExternal,
  onCloseExternal,
}) => {
  const [character, setCharacter] = useState<MascotCharacter>(() => {
    return (localStorage.getItem('lesmis_mascot_char') as MascotCharacter) || 'director';
  });

  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : isOpenInternal;
  const setIsOpen = (val: boolean) => {
    setIsOpenInternal(val);
    if (!val && onCloseExternal) {
      onCloseExternal();
    }
  };

  const [quoteIndex, setQuoteIndex] = useState(0);

  // Streak data
  const [streak, setStreak] = useState<StreakData>(() => {
    const today = getTodayString();
    const saved = localStorage.getItem('lesmis_streak_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lastPracticeDate === today) {
          return parsed;
        }
        const last = new Date(parsed.lastPracticeDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          return {
            streakDays: parsed.streakDays,
            lastPracticeDate: parsed.lastPracticeDate,
            todaySeconds: 0,
            dailyGoalSeconds: 180,
          };
        } else if (diffDays > 1) {
          return {
            streakDays: 0,
            lastPracticeDate: parsed.lastPracticeDate,
            todaySeconds: 0,
            dailyGoalSeconds: 180,
          };
        }
        return parsed;
      } catch {
        // fallback
      }
    }
    return {
      streakDays: 3,
      lastPracticeDate: '2026-10-20',
      todaySeconds: 45,
      dailyGoalSeconds: 180,
    };
  });

  useEffect(() => {
    localStorage.setItem('lesmis_streak_data', JSON.stringify(streak));
  }, [streak]);

  useEffect(() => {
    localStorage.setItem('lesmis_mascot_char', character);
  }, [character]);

  // Snooze state
  const [snoozeUntil, setSnoozeUntil] = useState<number>(() => {
    const saved = localStorage.getItem('lesmis_guilt_snooze');
    return saved ? Number(saved) : 0;
  });

  const isSnoozed = Date.now() < snoozeUntil;

  // Web / Mobile Push Notification Permission
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const handleRequestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      onShowBanner('此手機/瀏覽器不支援原生 Web Push 推播，將保留網頁內進度提醒。', 'warning');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        onShowBanner('🎉 已成功開啟手機與瀏覽器推播通知授權！', 'success');
        new Notification('《悲慘世界》劇組排練督導部', {
          body: `🔥 連勝 ${streak.streakDays} 天！舞台監督與全組演員已在排練室就位！`,
          icon: '/favicon.ico',
        });
      } else if (perm === 'denied') {
        onShowBanner('推播已被拒絕。若需開啟，請至瀏覽器或手機設定中允許通知。', 'warning');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  // Find neglected track
  const neglectedTrackInfo = useMemo(() => {
    if (tracks.length === 0) return null;
    const now = Date.now();

    // Priority 1: Called track with 0 practice
    for (const trackId of calledTrackIds) {
      const track = tracks.find((t) => t.trackId === trackId);
      if (!track) continue;
      const prog = progressMap[`${currentUserId}_${trackId}`];
      const sec = prog?.totalPracticeSeconds || 0;
      if (sec < 60) {
        return {
          track,
          reason: 'today_called',
          neglectedDays: 1,
          seconds: sec,
          label: `🚨 今日導演通告急召！《${track.title}》尚未開口`,
        };
      }
    }

    // Priority 2: Lowest practice time / oldest practice
    let worst = tracks[0];
    let maxNeglectScore = -1;
    let worstSec = 0;
    let worstDays = 0;

    tracks.forEach((t) => {
      const prog = progressMap[`${currentUserId}_${t.trackId}`];
      const sec = prog?.totalPracticeSeconds || 0;
      let days = 3;
      if (prog?.updatedAtIso) {
        const last = new Date(prog.updatedAtIso).getTime();
        days = Math.max(1, Math.floor((now - last) / (1000 * 3600 * 24)));
      }
      const isEnsemble =
        t.title.includes('People Sing') ||
        t.title.includes('One Day More') ||
        t.title.includes('Barricade');

      const score = days * 10 + (sec === 0 ? 50 : Math.max(0, 100 - sec)) + (isEnsemble ? 25 : 0);
      if (score > maxNeglectScore) {
        maxNeglectScore = score;
        worst = t;
        worstSec = sec;
        worstDays = days;
      }
    });

    if (maxNeglectScore > 20) {
      return {
        track: worst,
        reason: 'neglected',
        neglectedDays: Math.max(1, worstDays),
        seconds: worstSec,
        label: `⚠️ 街壘排練告急！《${worst.title}》已 ${worstDays} 天未練`,
      };
    }
    return null;
  }, [tracks, calledTrackIds, progressMap, currentUserId]);

  const today = getTodayString();
  const isTodayDone = streak.todaySeconds >= streak.dailyGoalSeconds;
  const currentHour = new Date().getHours();
  const isUrgentNight = currentHour >= 20 && !isTodayDone;

  const profile = MASCOT_PROFILES[character];

  const quotesList = neglectedTrackInfo && !isTodayDone
    ? profile.quotes.neglected
    : isTodayDone
    ? profile.quotes.done
    : isUrgentNight
    ? profile.quotes.urgent
    : streak.streakDays === 0
    ? profile.quotes.broken
    : profile.quotes.pending;

  const activeQuote = quotesList[quoteIndex % quotesList.length];

  const handleNextQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % quotesList.length);
  };

  const handleSimulatePractice = () => {
    setStreak((prev) => {
      const nextSec = Math.min(prev.dailyGoalSeconds, prev.todaySeconds + 60);
      const isNowDone = nextSec >= prev.dailyGoalSeconds;
      const nextDays =
        isNowDone && prev.lastPracticeDate !== today ? prev.streakDays + 1 : prev.streakDays;
      return {
        ...prev,
        todaySeconds: nextSec,
        streakDays: nextDays,
        lastPracticeDate: isNowDone ? today : prev.lastPracticeDate,
      };
    });
    onShowBanner('⚡ 登錄 60 秒有效排練！街壘士氣正在攀升！', 'success');
  };

  const handleSnooze = (hours = 2) => {
    const until = Date.now() + hours * 3600 * 1000;
    setSnoozeUntil(until);
    localStorage.setItem('lesmis_guilt_snooze', String(until));
    setIsOpen(false);
    onShowBanner(`已暫緩提醒 ${hours} 小時。休息是為了唱得更穩！`);
  };

  const pct = Math.min(100, Math.round((streak.todaySeconds / streak.dailyGoalSeconds) * 100));

  return (
    <>
      {/* 
        1. NON-OBSTRUCTIVE DOCKED SLIM TAB (螢幕側邊極簡拉環)
        - Sits cleanly on the right edge above the mobile bottom nav
        - Width: only ~38px, height: ~52px
        - NEVER covers headings or content in the center!
      */}
      {!isOpen && !isSnoozed && (
        <aside
          aria-label="排練督導側邊拉環"
          className="fixed bottom-20 sm:bottom-24 right-0 z-30 select-none animate-ui-fade-in"
        >
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1.5 pl-2.5 pr-2 py-2 rounded-l-full bg-neutral-900/95 border-y border-l border-[var(--accent-gold)] shadow-xl text-white hover:bg-neutral-800 active:scale-95 transition-all group"
            title="點開排練督導與連續天數小精靈"
          >
            <span className="text-base leading-none">{profile.avatar}</span>
            <div className="flex flex-col items-start leading-none pr-0.5">
              <span className="flex items-center gap-0.5 text-[11px] font-mono font-bold text-amber-400">
                <Flame className="w-3 h-3 fill-current text-amber-400" />
                {streak.streakDays}
              </span>
              {neglectedTrackInfo && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping mt-0.5 self-center" />
              )}
            </div>
          </button>
        </aside>
      )}

      {/*
        2. EXPANDED DRAWER / BOTTOM SHEET
        - Mobile: Slide-up bottom sheet with backdrop
        - Desktop: Slide-in right drawer
        - Leaves entire screen free when closed!
      */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:justify-center lg:items-end select-none animate-ui-fade-in">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer / Sheet Content Container */}
          <aside
            aria-label="排練督導與連續排練中心"
            className="relative w-full lg:w-96 max-h-[85vh] overflow-y-auto bg-[var(--bg-surface)] border-t-2 lg:border-l-2 lg:border-t-0 border-[var(--accent-gold)] shadow-2xl rounded-t-2xl lg:rounded-none z-10 flex flex-col"
          >
            {/* Mobile Drag Handle */}
            <div className="lg:hidden w-12 h-1 bg-stone-600 rounded-full mx-auto mt-2.5 mb-1" />

            {/* Header Bar */}
            <div
              className={`px-4 py-3 bg-gradient-to-r ${profile.color} flex items-center justify-between text-white border-b border-[var(--border-subtle)]`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{profile.avatar}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">{profile.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-amber-300 font-mono">
                      {profile.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-stone-300">
                    {character === 'director' ? '嚴格督促' : character === 'javert' ? '鐵面執法' : '熱血鼓舞'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Switch Character */}
                <button
                  type="button"
                  onClick={() => {
                    const chars: MascotCharacter[] = ['director', 'javert', 'gavroche'];
                    const nextIdx = (chars.indexOf(character) + 1) % chars.length;
                    setCharacter(chars[nextIdx]);
                  }}
                  className="px-2 py-1 rounded bg-black/40 hover:bg-black/70 text-[11px] text-amber-200 border border-white/20 transition-colors"
                  title="切換督導性格"
                >
                  換人格
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-white/80 hover:text-white rounded-md hover:bg-white/10 transition-colors"
                  title="收起"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Mascot Quote Bubble */}
              <div className="relative p-3.5 bg-[var(--bg-elevated)] border border-[var(--accent-gold-border)] rounded-sm text-xs text-[var(--text-primary)] leading-relaxed shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="italic font-serif-editorial text-[13px]">
                    "{activeQuote}"
                  </p>
                  <button
                    type="button"
                    onClick={handleNextQuote}
                    className="text-[11px] text-[var(--accent-gold)] hover:underline whitespace-nowrap shrink-0 mt-0.5"
                    title="換一句情勒"
                  >
                    換一句
                  </button>
                </div>
              </div>

              {/* Streak & Daily 3-minute Goal */}
              <div className="p-3 bg-black/50 border border-[var(--border-subtle)] space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <Flame
                      className={`w-4 h-4 ${
                        isTodayDone
                          ? 'text-amber-400 fill-amber-400 animate-bounce'
                          : 'text-amber-500 fill-amber-500'
                      }`}
                    />
                    <span className="font-bold text-[var(--accent-gold)]">
                      連續排練 {streak.streakDays} 天
                    </span>
                  </div>

                  <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                    {Math.floor(streak.todaySeconds / 60)}分{streak.todaySeconds % 60}秒 / 3分鐘
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-700">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isTodayDone
                        ? 'bg-gradient-to-r from-emerald-500 to-amber-400'
                        : 'bg-gradient-to-r from-amber-600 to-amber-400'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>{isTodayDone ? '✨ 今日火苗已守住' : '⚠️ 今日尚未達標 3 分鐘'}</span>
                  <button
                    type="button"
                    onClick={handleSimulatePractice}
                    className="text-[var(--accent-gold)] hover:underline font-mono"
                  >
                    +1 分鐘測試打卡
                  </button>
                </div>
              </div>

              {/* Neglected Track Warning Card (情勒告急卡片) */}
              {neglectedTrackInfo && (
                <div className="p-3 bg-red-950/40 border border-red-800/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-red-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      <span>{neglectedTrackInfo.label}</span>
                    </span>
                  </div>

                  <p className="text-[11px] text-stone-300 font-serif-editorial italic">
                    全組演員在排練場都跟上了，唯獨這首進度落後！
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectTrackAndRehearse(neglectedTrackInfo.track.trackId);
                      setIsOpen(false);
                      onShowBanner(
                        `⚡ 已直達《${neglectedTrackInfo.track.title}》排練室！請戴上耳機開唱！`,
                        'success'
                      );
                    }}
                    className="w-full min-h-[44px] py-2 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99]"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>一鍵前往排練《{neglectedTrackInfo.track.title}》</span>
                  </button>
                </div>
              )}

              {/* Mobile / Web Push Notification Permission Request */}
              <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    <span>手機鎖定螢幕推播</span>
                  </span>

                  {notificationPermission === 'granted' ? (
                    <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      已開啟
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestPushPermission}
                      className="text-xs text-[var(--accent-gold)] font-bold hover:underline"
                    >
                      點擊授權通知 →
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  若授權推播，當您忘記當日排練或特定曲目進度落後時，手機將收到督察或導演的溫馨召集。
                </p>
              </div>

              {/* Bottom Quick Actions (Snooze & Close) */}
              <div className="flex items-center gap-2 pt-1 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => handleSnooze(2)}
                  className="flex-1 min-h-[40px] py-2 px-3 border border-[var(--border-subtle)] hover:border-[var(--accent-gold)] bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
                >
                  暫緩 2 小時再催我
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="min-h-[40px] py-2 px-4 bg-[var(--bg-elevated)] hover:bg-[var(--accent-gold)] text-[var(--text-primary)] hover:text-black border border-[var(--border-subtle)] text-xs font-bold transition-colors"
                >
                  我知道了
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
