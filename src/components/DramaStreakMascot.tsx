import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Flame,
  Heart,
  MessageCircle,
  Mic,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';

interface DramaStreakMascotProps {
  onQuickStartRehearsal?: () => void;
  onShowBanner?: (msg: string, type?: 'success' | 'warning') => void;
  currentTrackTitle?: string;
}

export type MascotCharacter = 'director' | 'javert' | 'gavroche';

interface StreakData {
  streakDays: number;
  lastPracticeDate: string; // YYYY-MM-DD
  todaySeconds: number;
  dailyGoalSeconds: number; // e.g., 180s (3 mins)
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
        '不錯！今天走位跟拍點都很整齊，首演有望了！',
        '保持這個士氣，全體群演都會以你的穩定為榮！',
        '今天的氣息很足，下舞台記得多喝溫開水保養聲帶。',
      ],
      pending: [
        '你看過排練表了嗎？距離正式公演剩沒幾天，你今天還沒開口！',
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
    },
  },
};

export const DramaStreakMascot: React.FC<DramaStreakMascotProps> = ({
  onQuickStartRehearsal,
  onShowBanner,
  currentTrackTitle = 'Do You Hear the People Sing',
}) => {
  const [character, setCharacter] = useState<MascotCharacter>(() => {
    return (localStorage.getItem('lesmis_mascot_char') as MascotCharacter) || 'director';
  });

  const [streak, setStreak] = useState<StreakData>(() => {
    const today = getTodayString();
    const saved = localStorage.getItem('lesmis_streak_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.lastPracticeDate === today) {
          return parsed;
        }
        // Check if yesterday was practiced
        const last = new Date(parsed.lastPracticeDate);
        const curr = new Date(today);
        const diffDays = Math.round((curr.getTime() - last.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          // Streak maintained, today reset
          return {
            streakDays: parsed.streakDays,
            lastPracticeDate: parsed.lastPracticeDate,
            todaySeconds: 0,
            dailyGoalSeconds: 180,
          };
        } else if (diffDays > 1) {
          // Streak broken
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
      streakDays: 3, // starter encouraging streak
      lastPracticeDate: '2026-10-20',
      todaySeconds: 45,
      dailyGoalSeconds: 180,
    };
  });

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Sync streak to localStorage
  useEffect(() => {
    localStorage.setItem('lesmis_streak_data', JSON.stringify(streak));
  }, [streak]);

  useEffect(() => {
    localStorage.setItem('lesmis_mascot_char', character);
  }, [character]);

  const today = getTodayString();
  const isTodayDone = streak.todaySeconds >= streak.dailyGoalSeconds;
  const currentHour = new Date().getHours();
  const isUrgentNight = currentHour >= 20 && !isTodayDone;

  const profile = MASCOT_PROFILES[character];

  // Pick quotes
  const quotesList = isTodayDone
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
      const nextDays = isNowDone && prev.lastPracticeDate !== today ? prev.streakDays + 1 : prev.streakDays;
      return {
        ...prev,
        todaySeconds: nextSec,
        streakDays: nextDays,
        lastPracticeDate: isNowDone ? today : prev.lastPracticeDate,
      };
    });
    onShowBanner?.('⚡ 登錄 60 秒有效排練！街壘士氣正在攀升！', 'success');
  };

  const pct = Math.min(100, Math.round((streak.todaySeconds / streak.dailyGoalSeconds) * 100));

  // If minimized to tiny floating orb
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => {
            setIsMinimized(false);
            setIsOpen(true);
          }}
          className="relative w-12 h-12 rounded-full bg-gradient-to-br from-amber-600 to-black border-2 border-[var(--accent-gold)] shadow-xl flex items-center justify-center text-xl hover:scale-105 active:scale-95 transition-all group"
          title="點開多鄰國式排練督導小精靈"
        >
          <span>{profile.avatar}</span>
          <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-red-600 border border-white text-[10px] font-mono font-bold text-white flex items-center gap-0.5">
            <Flame className="w-2.5 h-2.5 fill-current" />
            {streak.streakDays}
          </span>
        </button>
      </div>
    );
  }

  return (
    <aside aria-label="排練督導與連續天數助手" className="fixed bottom-4 right-4 z-40 max-w-sm w-[92vw] sm:w-88 animate-fade-in">
      <div className="bg-[var(--bg-surface)] border-2 border-[var(--accent-gold-border)] shadow-2xl overflow-hidden rounded-sm">
        {/* Top Header Bar */}
        <div
          className={`px-3 py-2 bg-gradient-to-r ${profile.color} flex items-center justify-between text-white border-b border-[var(--border-subtle)]`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">{profile.avatar}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white">{profile.name}</span>
                <span className="text-[10px] px-1 py-0.2 rounded bg-black/40 text-amber-300 font-mono">
                  {profile.title}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Character Switcher */}
            <button
              type="button"
              onClick={() => {
                const chars: MascotCharacter[] = ['director', 'javert', 'gavroche'];
                const nextIdx = (chars.indexOf(character) + 1) % chars.length;
                setCharacter(chars[nextIdx]);
              }}
              className="px-1.5 py-0.5 rounded bg-black/30 hover:bg-black/60 text-[10px] text-amber-200 border border-white/20 transition-colors"
              title="切換督促性格（魔鬼導演 / 賈維 / 加夫洛許）"
            >
              換人格
            </button>

            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1 text-white/70 hover:text-white"
              title="縮小為圓形徽章"
            >
              <MinusIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mascot Speech Bubble (Duolingo-style Guilt-trip / Encouragement) */}
        <div className="p-3.5 space-y-3 bg-[var(--bg-elevated)]">
          <div className="relative p-3 bg-[var(--bg-surface)] border border-[var(--accent-gold-border)] text-xs text-[var(--text-primary)] leading-relaxed shadow-sm">
            {/* Little speech bubble arrow */}
            <div className="absolute -top-1.5 left-6 w-3 h-3 bg-[var(--bg-surface)] border-t border-l border-[var(--accent-gold-border)] rotate-45" />

            <div className="flex items-start justify-between gap-2">
              <p className="italic font-medium">"{activeQuote}"</p>
              <button
                type="button"
                onClick={handleNextQuote}
                className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent-gold)] whitespace-nowrap shrink-0 mt-0.5"
                title="換一句吐槽/督促"
              >
                換一句
              </button>
            </div>
          </div>

          {/* Duolingo Streak Bar & Progress Ring */}
          <div className="p-2.5 bg-black/50 border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <Flame className={`w-4 h-4 ${isTodayDone ? 'text-amber-400 fill-amber-400 animate-bounce' : 'text-amber-500 fill-amber-500'}`} />
                <span className="font-bold text-[var(--accent-gold)]">
                  連續排練 {streak.streakDays} 天
                </span>
                {isTodayDone && <span className="text-[10px] text-emerald-400 font-bold">✓ 今日已保住火苗</span>}
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
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                onQuickStartRehearsal?.();
                onShowBanner?.(`已為您開啟今日排練曲目《${currentTrackTitle}》，請準備開口！`);
              }}
              className="flex-1 ui-btn py-2 px-3 bg-[var(--accent-gold)] text-black text-xs font-extrabold inline-flex items-center justify-center gap-1.5 hover:brightness-110 shadow-md"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{isTodayDone ? '繼續加練 1 首' : '速練 3 分鐘保住火苗'}</span>
            </button>

            <button
              type="button"
              onClick={handleSimulatePractice}
              className="ui-btn py-2 px-2.5 border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-gold-border)] text-xs text-[var(--text-muted)] hover:text-white"
              title="手動打卡 +1 分鐘排練時間"
            >
              +1分
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
