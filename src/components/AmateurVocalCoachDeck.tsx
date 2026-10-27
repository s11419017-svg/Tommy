import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Compass,
  Gauge,
  HelpCircle,
  Mic,
  MicOff,
  Music,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  Wind,
  Zap,
} from 'lucide-react';
import {
  analyzePitchFromBuffer,
  PitchInfo,
  playReferenceTone,
  REFERENCE_PITCHES,
} from '../utils/vocalAudioHelper';

interface AmateurVocalCoachDeckProps {
  currentTimeSec: number;
  nextCueTimeSec?: number;
  nextCueTitle?: string;
  activeCueTitle?: string;
  isCueActive: boolean;
  onShowBanner: (msg: string, type?: 'success' | 'warning') => void;
}

export const AmateurVocalCoachDeck: React.FC<AmateurVocalCoachDeckProps> = ({
  currentTimeSec,
  nextCueTimeSec,
  nextCueTitle,
  activeCueTitle,
  isCueActive,
  onShowBanner,
}) => {
  // Mic Pitch Detection State
  const [isMicActive, setIsMicActive] = useState(false);
  const [pitchResult, setPitchResult] = useState<PitchInfo>({
    frequency: null,
    note: '--',
    octave: null,
    cents: 0,
    rms: 0,
    status: 'silent',
    statusText: '點擊下方啟動麥克風進行即時音準校對',
  });
  const [selectedRefNote, setSelectedRefNote] = useState<string | null>(null);

  // Warm-up Player State
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [warmupVowelIdx, setWarmupVowelIdx] = useState(0);
  const warmupTimerRef = useRef<number | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number | null>(null);

  // Calculate Countdown to Next Cue
  const deltaSecToNext =
    typeof nextCueTimeSec === 'number' && nextCueTimeSec > currentTimeSec
      ? nextCueTimeSec - currentTimeSec
      : null;

  const isCountingDown = deltaSecToNext !== null && deltaSecToNext <= 5.0 && deltaSecToNext > 0;

  // Toggle Mic Pitch Detection
  const toggleMicDetection = async () => {
    if (isMicActive) {
      cleanupMic();
      setIsMicActive(false);
      setPitchResult({
        frequency: null,
        note: '--',
        octave: null,
        cents: 0,
        rms: 0,
        status: 'silent',
        statusText: '音準檢測已關閉',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // keep natural harmonics for pitch
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      micAudioCtxRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 2048;
      sourceNode.connect(analyserNode);

      const buffer = new Float32Array(analyserNode.fftSize);

      const detectLoop = () => {
        analyserNode.getFloatTimeDomainData(buffer);
        const analyzed = analyzePitchFromBuffer(buffer, audioCtx.sampleRate);
        setPitchResult(analyzed);
        micRafRef.current = requestAnimationFrame(detectLoop);
      };

      micRafRef.current = requestAnimationFrame(detectLoop);
      setIsMicActive(true);
      onShowBanner('即時音準教練已啟動，請對著麥克風發聲唱出長音！');
    } catch {
      onShowBanner('無法獲取麥克風權限，請確認瀏覽器已允許使用麥克風。', 'warning');
    }
  };

  const cleanupMic = () => {
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanupMic();
      if (warmupTimerRef.current) clearInterval(warmupTimerRef.current);
    };
  }, []);

  // Play Reference Pitch Tone
  const handlePlayReferencePitch = (freq: number, note: string) => {
    setSelectedRefNote(note);
    playReferenceTone(freq, 1.5);
    onShowBanner(`正在給起音：${note} (${Math.round(freq)} Hz)`);
  };

  // 30s Vocal Warm-up Arpeggio
  const WARMUP_VOWELS = ['Mah (開口放鬆)', 'Meh (明亮靠前)', 'Mee (咽音聚集)', 'Moh (圓潤空間)', 'Moo (軟顎抬起)'];
  const handleStartWarmup = () => {
    if (isWarmingUp) {
      if (warmupTimerRef.current) clearInterval(warmupTimerRef.current);
      setIsWarmingUp(false);
      return;
    }

    setIsWarmingUp(true);
    let step = 0;
    // Scale notes: C4, E4, G4, E4, C4
    const scale = [261.63, 329.63, 392.0, 329.63, 261.63];

    const playNextStep = () => {
      const noteFreq = scale[step % scale.length];
      const vowelIdx = Math.floor(step / scale.length) % WARMUP_VOWELS.length;
      setWarmupVowelIdx(vowelIdx);
      playReferenceTone(noteFreq, 0.45);
      step++;

      if (step >= scale.length * WARMUP_VOWELS.length) {
        clearInterval(warmupTimerRef.current!);
        setIsWarmingUp(false);
        onShowBanner('🎉 開嗓暖身完成！聲帶已喚醒，請保持深長氣息。');
      }
    };

    playNextStep();
    warmupTimerRef.current = window.setInterval(playNextStep, 500);
  };

  return (
    <div className="space-y-4 text-xs">
      {/* ----------------------------------------------------------------------
          FEATURE 1: 視覺化進場倒數提示 (Entry Countdown & Inhale Coach)
         ---------------------------------------------------------------------- */}
      <div
        className={`p-3.5 border transition-all duration-200 ${
          isCountingDown
            ? 'bg-amber-950/40 border-amber-500 shadow-md ring-1 ring-amber-500/40'
            : isCueActive
            ? 'bg-emerald-950/30 border-emerald-500/60'
            : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="font-bold flex items-center gap-1.5">
            <Wind className={`w-4 h-4 ${isCountingDown ? 'text-amber-400 animate-spin' : 'text-[var(--accent-gold)]'}`} />
            <span className={isCountingDown ? 'text-amber-300' : 'text-[var(--text-primary)]'}>
              {isCountingDown
                ? '⚡ 進場節拍倒數中（準備張嘴開口！）'
                : isCueActive
                ? '🎤 當前唱段進行中（穩定氣息）'
                : '進場節奏與呼吸輔助'}
            </span>
          </div>

          {deltaSecToNext !== null && deltaSecToNext <= 12 && (
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/50 border border-[var(--border-subtle)] text-[var(--accent-gold)] font-bold">
              距進場：{deltaSecToNext.toFixed(1)} 秒
            </span>
          )}
        </div>

        {isCountingDown ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs text-amber-200">
              <span className="font-bold truncate max-w-[200px]">即將進場：{nextCueTitle || '下一段歌詞'}</span>
              <span className="font-mono font-extrabold text-sm text-amber-400 animate-pulse">
                倒數 {Math.ceil(deltaSecToNext || 0)} 拍
              </span>
            </div>

            {/* 4-beat visual countdown blocks */}
            <div className="grid grid-cols-4 gap-2 text-center font-bold">
              {[4, 3, 2, 1].map((beatNum) => {
                const isCurrentBeat = Math.ceil(deltaSecToNext || 0) === beatNum;
                const isInhaleBeat = beatNum <= 2;
                return (
                  <div
                    key={beatNum}
                    className={`py-2 px-1 border transition-all ${
                      isCurrentBeat
                        ? 'bg-amber-500 text-black border-amber-400 shadow-md scale-105'
                        : 'bg-black/40 text-[var(--text-muted)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="text-sm font-extrabold font-mono">{beatNum}</div>
                    <div className="text-[10px] mt-0.5">
                      {isInhaleBeat ? (beatNum === 2 ? '🫁 深吸氣' : '預備開口') : '預備聽點'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isCueActive ? (
          <div className="text-emerald-300 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>正在唱：<strong>{activeCueTitle}</strong></span>
            </div>
            <span className="text-[11px] text-emerald-400 font-mono">維持氣息支撐</span>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            伴奏進行中，當距離下一句唱詞小於 5 秒時，此處會自動啟動「4 拍視覺倒數與吸氣節奏球」，解決業餘歌手搶拍或漏拍的痛點！
          </p>
        )}
      </div>

      {/* ----------------------------------------------------------------------
          FEATURE 2: 即時人聲音準檢測儀 (Visual Pitch Tuner & Feedback)
         ---------------------------------------------------------------------- */}
      <div className="p-3.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-bold text-[var(--accent-gold)] flex items-center gap-1.5">
            <Activity className="w-4 h-4" />
            <span>即時人聲音準檢測儀 (Live Pitch Coach)</span>
          </div>
          <button
            type="button"
            onClick={toggleMicDetection}
            className={`px-3 py-1 text-xs font-bold inline-flex items-center gap-1.5 border transition-all ${
              isMicActive
                ? 'bg-red-500 text-white border-red-400 shadow-sm animate-pulse'
                : 'bg-[var(--accent-gold)] text-black border-[var(--accent-gold)] hover:brightness-110'
            }`}
          >
            {isMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isMicActive ? '關閉音準檢測' : '開啟即時音準'}</span>
          </button>
        </div>

        {/* Live Pitch Gauge */}
        <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-[var(--text-primary)]">
                {pitchResult.note}
              </span>
              {pitchResult.frequency && (
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  {pitchResult.frequency} Hz
                </span>
              )}
            </div>

            <div
              className={`px-2.5 py-1 text-xs font-bold rounded-sm border inline-flex items-center gap-1 ${
                pitchResult.status === 'perfect'
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-600'
                  : pitchResult.status === 'sharp'
                  ? 'bg-blue-950/40 text-blue-300 border-blue-600'
                  : pitchResult.status === 'flat'
                  ? 'bg-amber-950/40 text-amber-300 border-amber-600'
                  : 'bg-black/30 text-[var(--text-muted)] border-[var(--border-subtle)]'
              }`}
            >
              <span>{pitchResult.statusText}</span>
            </div>
          </div>

          {/* Cents Needle / Meter (-50 to +50 cents) */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
              <span>-50 (偏低/Flat)</span>
              <span className="text-emerald-400 font-bold">🎯 準確 (0)</span>
              <span>+50 (偏高/Sharp)</span>
            </div>
            <div className="relative h-3 bg-black/60 rounded overflow-hidden border border-[var(--border-subtle)]">
              {/* Perfect Center Guide Zone (±12 cents) */}
              <div className="absolute left-[38%] right-[38%] top-0 bottom-0 bg-emerald-500/25 border-x border-emerald-500/40" />

              {/* Needle Indicator */}
              {pitchResult.frequency && (
                <div
                  className="absolute top-0 bottom-0 w-1.5 bg-[var(--accent-gold)] shadow-md transition-all duration-75 -translate-x-1/2"
                  style={{
                    left: `${Math.min(95, Math.max(5, ((pitchResult.cents + 50) / 100) * 100))}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------------
          FEATURE 3: 鋼琴給起音鍵盤 (Reference Pitch Piano Keys)
         ---------------------------------------------------------------------- */}
      <div className="p-3.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="font-bold text-[var(--accent-gold)] flex items-center gap-1.5">
            <Volume2 className="w-4 h-4" />
            <span>鋼琴給起音鍵盤（開口前點擊對音，不走音）</span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">Web Audio 鋼琴音色</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {REFERENCE_PITCHES.map((p) => {
            const isSelected = selectedRefNote === p.note;
            return (
              <button
                key={p.note}
                type="button"
                onClick={() => handlePlayReferencePitch(p.freq, p.note)}
                className={`p-2 border text-left transition-all group ${
                  isSelected
                    ? 'border-[var(--accent-gold)] bg-[var(--bg-highlight)] shadow-sm'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-gold-border)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-xs text-[var(--text-primary)] group-hover:text-[var(--accent-gold)]">
                    {p.note}
                  </span>
                  <Play className="w-2.5 h-2.5 text-[var(--accent-gold)] opacity-0 group-hover:opacity-100 transition-opacity fill-current" />
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                  {p.roleHint}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------------------------
          FEATURE 4: 30 秒母音開嗓音階 (30s Vocal Warm-up Arpeggio)
         ---------------------------------------------------------------------- */}
      <div className="p-3.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="font-bold text-[var(--accent-gold)] flex items-center gap-1.5">
            <Zap className="w-4 h-4" />
            <span>30 秒母音開嗓暖身音階 (Vocal Warm-up)</span>
          </div>

          <button
            type="button"
            onClick={handleStartWarmup}
            className={`px-3 py-1 text-xs font-bold inline-flex items-center gap-1.5 border transition-all ${
              isWarmingUp
                ? 'bg-amber-500 text-black border-amber-400 animate-pulse'
                : 'border-[var(--accent-gold-border)] bg-[var(--bg-surface)] text-[var(--accent-gold)] hover:bg-[var(--bg-highlight)]'
            }`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isWarmingUp ? '停止暖身' : '播放開嗓音階'}</span>
          </button>
        </div>

        {isWarmingUp && (
          <div className="p-2.5 bg-black/40 border border-amber-500/50 flex items-center justify-between text-xs text-amber-200">
            <span>
              當前發聲母音：<strong>{WARMUP_VOWELS[warmupVowelIdx]}</strong>
            </span>
            <span className="font-mono text-amber-400">Do-Mi-Sol-Mi-Do 伴奏輪播中</span>
          </div>
        )}

        {/* ----------------------------------------------------------------------
            FEATURE 5: 音樂劇初學者 4 大避坑秘笈 (Vocal Hacks)
           ---------------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
          <div className="p-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="font-bold text-[var(--accent-gold)]">1. 丹田氣息支撐</span>
            <p className="text-[var(--text-muted)] leading-relaxed">
              不要用喉嚨硬頂擠音。開口前腹部自然擴張，發聲時小腹向內收緊送氣。
            </p>
          </div>
          <div className="p-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="font-bold text-[var(--accent-gold)]">2. 搶拍與慢拍預防</span>
            <p className="text-[var(--text-muted)] leading-relaxed">
              進場前提前 1 小節看上方倒數燈，在第 2 拍口鼻同步深吸氣，第 1 拍準時張口。
            </p>
          </div>
          <div className="p-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="font-bold text-[var(--accent-gold)]">3. 合唱聲部融合</span>
            <p className="text-[var(--text-muted)] leading-relaxed">
              合唱時請保留 30% 專注力聆聽左右同伴，子音咬字要整齊俐落，母音要圓潤歸韻。
            </p>
          </div>
          <div className="p-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-0.5">
            <span className="font-bold text-[var(--accent-gold)]">4. 高音換聲區技巧</span>
            <p className="text-[var(--text-muted)] leading-relaxed">
              唱高音時下巴微微下收、放鬆咬肌，抬起後軟顎，將聲音投射至頭腔後上方。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
