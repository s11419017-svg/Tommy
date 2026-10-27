import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';

type RegionsPluginInstance = InstanceType<typeof RegionsPlugin>;
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronUp,
  Download,
  Drum,
  FileText,
  Flag,
  Highlighter,
  Keyboard,
  Mic,
  MicOff,
  Music,
  Pause,
  Play,
  Radio,
  Repeat,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { RehearsalCuePoint } from '../data/lesMisTracks';
import {
  createAudioEnhancementPipeline,
  AudioEnhancementPipeline,
  AudioPipelineMetrics,
} from '../services/audioEnhancementService';

// ============================================================================
// COLOCATED UTILITIES (High Cohesion — Single Audio & Cue Module)
// 1. LRC / SRT Subtitle Parser & Exporter
// 2. Autocorrelation Vocal Pitch Detector
// ============================================================================

export function formatSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function classifyEnsembleLine(line: string): boolean {
  const lower = line.toLowerCase();
  if (
    lower.includes('solo') ||
    lower.includes('獨唱') ||
    lower.includes('過門') ||
    lower.includes('前奏') ||
    lower.includes('間奏')
  ) {
    return false;
  }
  return true;
}

export function parseLrcOrSrtToCues(
  rawContent: string,
  fileName = '',
  _fallbackDurationSec?: number
): RehearsalCuePoint[] {
  const lines = rawContent.replace(/\r\n/g, '\n').split('\n');
  const cues: RehearsalCuePoint[] = [];
  const isSrt =
    fileName.toLowerCase().endsWith('.srt') || rawContent.includes('-->');

  if (isSrt) {
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      const arrowMatch = line.match(
        /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->/
      );
      if (arrowMatch) {
        const hours = parseInt(arrowMatch[1], 10) || 0;
        const mins = parseInt(arrowMatch[2], 10) || 0;
        const secs = parseInt(arrowMatch[3], 10) || 0;
        const totalSec = hours * 3600 + mins * 60 + secs;

        const textLines: string[] = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim().replace(/<[^>]+>/g, ''));
          i++;
        }
        const mergedText = textLines.join(' ').trim();
        if (mergedText) {
          const isEns = classifyEnsembleLine(mergedText);
          cues.push({
            timeSec: totalSec,
            timeFormatted: formatSec(totalSec),
            sectionTitle: mergedText,
            characterFocus: isEns
              ? 'Full Cast Ensemble · 群演合唱'
              : 'Solo / Prelude · 獨唱或過門',
            actingTip: isEns ? '按拍點整齊進場演唱' : '過門預備與走位調整',
            vocalTip: mergedText,
          });
        }
      }
      i++;
    }
  } else {
    const lrcRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\](.*)/;
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      const match = trimmed.match(lrcRegex);
      if (!match) continue;

      const mins = parseInt(match[1], 10) || 0;
      const secs = parseInt(match[2], 10) || 0;
      const totalSec = mins * 60 + secs;
      const lyricText = (match[4] || '').trim();
      if (!lyricText) continue;

      const isEns = classifyEnsembleLine(lyricText);
      cues.push({
        timeSec: totalSec,
        timeFormatted: formatSec(totalSec),
        sectionTitle: lyricText,
        characterFocus: isEns
          ? 'Full Cast Ensemble · 群演合唱'
          : 'Solo / Prelude · 獨唱或過門',
        actingTip: isEns ? '按拍點整齊進場演唱' : '過門預備與走位調整',
        vocalTip: lyricText,
      });
    }
  }

  return cues.sort((a, b) => a.timeSec - b.timeSec);
}

export function exportCuesToLrcString(
  trackTitle: string,
  cues: RehearsalCuePoint[]
): string {
  const header = [
    `[ti:${trackTitle}]`,
    `[ar:Les Misérables 公演排練工作台]`,
    `[by:舞台監督與音控組]`,
    '',
  ];
  const body = cues.map((c) => {
    const m = Math.floor(c.timeSec / 60);
    const s = Math.floor(c.timeSec % 60);
    const tag = `[${String(m).padStart(2, '0')}:${String(s).padStart(
      2,
      '0'
    )}.00]`;
    const blockingSuffix = c.actingTip ? ` (${c.actingTip})` : '';
    return `${tag}${c.sectionTitle}${blockingSuffix}`;
  });
  return [...header, ...body].join('\n');
}

interface PitchDetectionResult {
  frequencyHz: number | null;
  noteName: string;
  octave: number | null;
  centsOff: number;
  rmsVolume: number;
  stabilityLabel: string;
  isSinging: boolean;
}

const NOTE_STRINGS = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

function detectPitchFromFloatBuffer(
  buf: Float32Array,
  sampleRate: number
): PitchDetectionResult {
  const size = buf.length;
  let rms = 0;
  for (let i = 0; i < size; i++) {
    const val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / size);
  const normalizedVol = Math.min(1, rms * 6.5);

  if (rms < 0.015) {
    return {
      frequencyHz: null,
      noteName: '--',
      octave: null,
      centsOff: 0,
      rmsVolume: normalizedVol,
      stabilityLabel: '待命：請對著麥克風發聲',
      isSinging: false,
    };
  }

  let r1 = 0;
  let r2 = size - 1;
  const thres = 0.2;
  for (let i = 0; i < size / 2; i++) {
    if (Math.abs(buf[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < size / 2; i++) {
    if (Math.abs(buf[size - i]) < thres) {
      r2 = size - i;
      break;
    }
  }

  const trimmed = buf.slice(r1, r2);
  const newSize = trimmed.length;
  const c = new Float32Array(newSize);

  for (let i = 0; i < newSize; i++) {
    let sum = 0;
    for (let j = 0; j < newSize - i; j++) {
      sum += trimmed[j] * trimmed[j + i];
    }
    c[i] = sum;
  }

  let d = 0;
  while (d + 1 < newSize && c[d] > c[d + 1]) {
    d++;
  }

  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < newSize; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  if (maxpos <= 0) {
    return {
      frequencyHz: null,
      noteName: '--',
      octave: null,
      centsOff: 0,
      rmsVolume: normalizedVol,
      stabilityLabel: '偵測頻率中...',
      isSinging: true,
    };
  }

  let t0 = maxpos;
  if (t0 > 0 && t0 + 1 < newSize) {
    const x1 = c[t0 - 1];
    const x2 = c[t0];
    const x3 = c[t0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) t0 = t0 - b / (2 * a);
  }

  const freq = sampleRate / t0;
  if (freq < 65 || freq > 1100) {
    return {
      frequencyHz: null,
      noteName: '--',
      octave: null,
      centsOff: 0,
      rmsVolume: normalizedVol,
      stabilityLabel: '請維持穩定長音以利判讀',
      isSinging: true,
    };
  }

  const midiNum = 12 * (Math.log(freq / 440) / Math.log(2)) + 69;
  const roundedMidi = Math.round(midiNum);
  const cents = Math.round((midiNum - roundedMidi) * 100);
  const noteName = NOTE_STRINGS[roundedMidi % 12] || 'C';
  const octave = Math.floor(roundedMidi / 12) - 1;

  let stabilityLabel = '音準穩定';
  if (cents > 22) stabilityLabel = '音高偏高，建議放鬆喉部';
  else if (cents < -22) stabilityLabel = '音高偏低，建議加強氣息支撐';

  return {
    frequencyHz: Math.round(freq),
    noteName: `${noteName}${octave}`,
    octave,
    centsOff: cents,
    rmsVolume: normalizedVol,
    stabilityLabel,
    isSinging: true,
  };
}

// ============================================================================
// MAIN COMPONENT: WaveformStudioDeck
// ============================================================================

export interface TrackStemFiles {
  backingUrl?: string;
  backingName?: string;
  vocalUrl?: string;
  vocalName?: string;
  drumBassUrl?: string;
  drumBassName?: string;
  isPureInstrumentalTrack?: boolean;
}

export interface WaveformStudioDeckProps {
  trackId: string;
  trackTitle: string;
  durationSec: number;
  bpm: number;
  audioUrl: string;
  audioLabel: string;
  isCustomAudio: boolean;
  darkMode: boolean;
  isEnsembleMode: boolean;
  cues: RehearsalCuePoint[];
  stems?: TrackStemFiles;
  autoAdvanceNextTrack?: boolean;
  onToggleAutoAdvance?: () => void;
  onUpdateStems?: (
    stemType: 'backing' | 'vocal' | 'drumBass',
    file: File | null
  ) => void;
  onRemoveTrackAudio?: (
    slot?: 'main' | 'backing' | 'vocal' | 'drumBass' | 'all'
  ) => void;
  onTogglePureInstrumentalFlag?: () => void;
  onCuesChange: (
    nextCues: RehearsalCuePoint[],
    detectedDuration?: number
  ) => void;
  onUploadSingleFile: (file: File | null) => void;
  onTrackCompleted: () => void;
  onShowBanner: (msg: string, type?: 'success' | 'warning') => void;
  externalSeekRequest?: {
    timeSec: number;
    loopEndSec?: number;
    loopLabel?: string;
    autoPlay: boolean;
    seq: number;
  } | null;
  onTimeUpdate?: (timeSec: number) => void;
}

function isEnsembleCue(cue: RehearsalCuePoint): boolean {
  const text = `${cue.characterFocus} ${cue.sectionTitle}`.toLowerCase();
  return (
    text.includes('ensemble') ||
    text.includes('full cast') ||
    text.includes('convict') ||
    text.includes('worker') ||
    text.includes('student') ||
    text.includes('crowd') ||
    text.includes('群演') ||
    text.includes('合唱') ||
    text.includes('全體') ||
    text.includes('大聲') ||
    text.includes('大家')
  );
}

/**
 * Generates a 100% SILENT WAV buffer (zero audible signal) + visual-only peaks
 * when a track slot has no uploaded audio file yet.
 * Never generates synthetic tones or fake audio so uploaded tracks are never confused with synth noise.
 */
function createSilentTimelinePreview(
  durationSec: number,
  cues: RehearsalCuePoint[]
): { silentWavUrl: string; visualPeaks: number[]; safeDuration: number } {
  const sampleRate = 8000;
  const safeDuration = Math.min(600, Math.max(15, Math.round(durationSec || 180)));
  // 1-second silent WAV container; WaveSurfer stretches it to safeDuration using visualPeaks
  const silentSamples = sampleRate;
  const buffer = new ArrayBuffer(44 + silentSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + silentSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, silentSamples * 2, true);
  // All PCM samples remain 0 (100% pure silence — no synthetic audio ever played)

  const numBars = 300;
  const visualPeaks: number[] = [];
  for (let i = 0; i < numBars; i++) {
    const ratio = i / numBars;
    let isEnsembleSection = false;
    for (let c = 0; c < cues.length; c++) {
      const startRatio = cues[c].timeSec / Math.max(1, safeDuration);
      const endRatio =
        c + 1 < cues.length
          ? cues[c + 1].timeSec / Math.max(1, safeDuration)
          : 1.0;
      if (ratio >= startRatio && ratio < endRatio) {
        isEnsembleSection = isEnsembleCue(cues[c]);
        break;
      }
    }
    visualPeaks.push(isEnsembleSection ? 0.55 : 0.2);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return {
    silentWavUrl: URL.createObjectURL(blob),
    visualPeaks,
    safeDuration,
  };
}

const STAGE_BLOCKING_QUICK_TAGS = [
  '左翼 (SL) 進場',
  '右翼 (SR) 進場',
  '推向舞台前緣 (Downstage)',
  '退向後舞台 (Upstage)',
  '畫面定格 (Freeze)',
  '燈暗換景 (Blackout)',
];

export const WaveformStudioDeck: React.FC<WaveformStudioDeckProps> = ({
  trackId,
  trackTitle,
  durationSec,
  bpm,
  audioUrl,
  audioLabel,
  isCustomAudio,
  darkMode,
  cues,
  stems,
  autoAdvanceNextTrack = false,
  onToggleAutoAdvance,
  onUpdateStems,
  onRemoveTrackAudio,
  onTogglePureInstrumentalFlag,
  onCuesChange,
  onUploadSingleFile,
  onTrackCompleted,
  onShowBanner,
  externalSeekRequest,
  onTimeUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsPluginRef = useRef<RegionsPluginInstance | null>(null);
  const activeLoopRegionRef = useRef<{ start: number; end: number } | null>(
    null
  );
  const cuesRef = useRef<RehearsalCuePoint[]>(cues);
  cuesRef.current = cues;

  // Preserve current time across seamless Vocal <-> Pure Instrumental version swaps
  const resumeTimeOnSwapRef = useRef<{ time: number; autoPlay: boolean } | null>(
    null
  );

  // Web Audio DSP filter chain refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const vocalCutFilterRef = useRef<BiquadFilterNode | null>(null);
  const bassBoostFilterRef = useRef<BiquadFilterNode | null>(null);
  const beatSnapFilterRef = useRef<BiquadFilterNode | null>(null);

  // Synchronized multi-stem HTMLAudioElements
  const vocalAudioRef = useRef<HTMLAudioElement | null>(null);
  const drumBassAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [actualDuration, setActualDuration] = useState(durationSec || 180);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [loopingRegionTitle, setLoopingRegionTitle] = useState<string | null>(
    null
  );
  const [selectedCueIdx, setSelectedCueIdx] = useState<number>(0);

  // Pure Instrumental seamless switching & 3-2-1 entry countdown
  const [usingBackingVersion, setUsingBackingVersion] = useState(false);
  const [entryCountdownEnabled, setEntryCountdownEnabled] = useState(true);

  // Category 1 State: Rehearsal Controls
  const [karaokeVocalCut, setKaraokeVocalCut] = useState(false);
  const [beatBoostActive, setBeatBoostActive] = useState(false);
  const [pitchSemitones, setPitchSemitones] = useState<number>(0);

  // Real-Time Pitch Tuner
  const [tunerActive, setTunerActive] = useState(false);
  const [pitchData, setPitchData] = useState<PitchDetectionResult>({
    frequencyHz: null,
    noteName: '--',
    octave: null,
    centsOff: 0,
    rmsVolume: 0,
    stabilityLabel: '開啟後對著麥克風發聲即可判讀音高',
    isSinging: false,
  });
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRafRef = useRef<number | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);

  // Real-Time Vocal Clarity & Noise Suppression DSP State
  const [enhancerEnabled, setEnhancerEnabled] = useState(true);
  const [noiseGateThreshold, setNoiseGateThreshold] = useState(-42); // dB: -54 to -30
  const [clarityBoostGain, setClarityBoostGain] = useState(4.0); // dB: 0 to +8
  const [enhancementMetrics, setEnhancementMetrics] = useState<AudioPipelineMetrics>({
    inputDb: -90,
    inputRms: 0,
    outputRms: 0,
    isGateOpen: true,
    reductionDb: 0,
  });
  const enhancerPipelineRef = useRef<AudioEnhancementPipeline | null>(null);
  const metricsRafRef = useRef<number | null>(null);

  // 15-Second Self-Test Recorder
  const [isRecordingTake, setIsRecordingTake] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedTakeUrl, setRecordedTakeUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  // Collapsible Drawers: Practice Vocal Lab (Tuner + 15s Rec) & Sound Crew / Cue Authoring
  const [vocalLabDrawerOpen, setVocalLabDrawerOpen] = useState(false);
  const [soundCrewDrawerOpen, setSoundCrewDrawerOpen] = useState(false);
  const [lrcModeOpen, setLrcModeOpen] = useState(false);
  const [lrcLinesText, setLrcLinesText] = useState<string>(
    '前奏預備（視線看指揮）\n第一段：全體合唱進場\n過門間奏（走位換隊形）\n副歌：全體強音齊唱'
  );
  const [lrcCursorIdx, setLrcCursorIdx] = useState<number>(0);

  const [mainTrackVol, setMainTrackVol] = useState<number>(100);
  const [vocalStemVol, setVocalStemVol] = useState<number>(100);
  const [drumBassStemVol, setDrumBassStemVol] = useState<number>(100);

  const lrcLines = lrcLinesText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  // Auto-detect if filename itself looks like a pure instrumental version
  const filenameLooksInstrumental = React.useMemo(() => {
    const lower = (audioLabel || '').toLowerCase();
    return (
      Boolean(stems?.isPureInstrumentalTrack) ||
      lower.includes('純音樂') ||
      lower.includes('伴奏') ||
      lower.includes('伴唱') ||
      lower.includes('無人聲') ||
      lower.includes('消音') ||
      lower.includes('inst') ||
      lower.includes('backing') ||
      lower.includes('karaoke') ||
      lower.includes('bgm') ||
      lower.includes('mm')
    );
  }, [audioLabel, stems?.isPureInstrumentalTrack]);

  const effectiveWaveSurferUrl =
    usingBackingVersion && stems?.backingUrl ? stems.backingUrl : audioUrl;

  const effectiveAudioLabel =
    usingBackingVersion && stems?.backingName
      ? `純音樂伴奏版：${stems.backingName}`
      : filenameLooksInstrumental
      ? `純音樂伴奏版：${audioLabel}`
      : audioLabel;

  const activeCueIndex = React.useMemo(() => {
    if (!cues || cues.length === 0) return -1;
    let idx = 0;
    for (let i = 0; i < cues.length; i++) {
      if (currentTime >= cues[i].timeSec) {
        idx = i;
      }
    }
    return idx;
  }, [cues, currentTime]);

  const upcomingEnsembleCountdown = React.useMemo(() => {
    if (!entryCountdownEnabled || !cues || cues.length === 0) return null;
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      if (!isEnsembleCue(cue)) continue;
      const diff = cue.timeSec - currentTime;
      if (diff > 0 && diff <= 4.0) {
        return {
          secondsLeft: Math.ceil(diff),
          cue,
        };
      }
    }
    return null;
  }, [cues, currentTime, entryCountdownEnabled]);

  const syncRegionsToWaveform = (
    ws: WaveSurfer,
    regPlugin: RegionsPluginInstance,
    cueList: RehearsalCuePoint[]
  ) => {
    regPlugin.clearRegions();
    const totalDur = ws.getDuration() || actualDuration || 180;

    cueList.forEach((cue, idx) => {
      const start = Math.min(totalDur - 0.5, Math.max(0, cue.timeSec));
      const nextCueStart =
        idx + 1 < cueList.length ? cueList[idx + 1].timeSec : totalDur;
      const end = Math.min(totalDur, Math.max(start + 2, nextCueStart));
      const ensemble = isEnsembleCue(cue);

      const shortLabel = `${String(idx + 1).padStart(2, '0')} · ${
        ensemble ? '合唱' : '過門'
      }`;

      regPlugin.addRegion({
        id: `cue-region-${idx}`,
        start,
        end,
        content: shortLabel,
        color: ensemble
          ? darkMode
            ? 'rgba(210, 180, 140, 0.24)'
            : 'rgba(122, 79, 36, 0.16)'
          : darkMode
          ? 'rgba(124, 118, 107, 0.11)'
          : 'rgba(126, 119, 108, 0.09)',
        drag: false,
        resize: false,
      });
    });
  };

  const syncStemsTransport = (
    action: 'play' | 'pause' | 'seek',
    targetTime?: number
  ) => {
    const stemEls = [vocalAudioRef.current, drumBassAudioRef.current];
    stemEls.forEach((el) => {
      if (!el || !el.src) return;
      if (typeof targetTime === 'number') {
        el.currentTime = targetTime;
      }
      if (action === 'play') {
        el.play().catch(() => {});
      } else if (action === 'pause') {
        el.pause();
      }
    });
  };

  useEffect(() => {
    setUsingBackingVersion(false);
    resumeTimeOnSwapRef.current = null;
  }, [trackId]);

  useEffect(() => {
    if (!containerRef.current) return;

    setIsReady(false);
    setIsPlaying(false);
    activeLoopRegionRef.current = null;
    setLoopingRegionTitle(null);

    const regPlugin = RegionsPlugin.create();
    regionsPluginRef.current = regPlugin;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 104,
      waveColor: darkMode ? '#524D45' : '#C4BCAD',
      progressColor: darkMode ? '#9E4238' : '#853129',
      cursorColor: darkMode ? '#D2B48C' : '#7A4F24',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      plugins: [regPlugin],
    });

    wsRef.current = ws;

    let generatedSilentUrl: string | null = null;
    const hasUploadedAudio = Boolean(
      effectiveWaveSurferUrl && effectiveWaveSurferUrl.trim().length > 0
    );

    if (hasUploadedAudio) {
      ws.load(effectiveWaveSurferUrl);
    } else {
      const preview = createSilentTimelinePreview(durationSec, cuesRef.current);
      generatedSilentUrl = preview.silentWavUrl;
      ws.load(preview.silentWavUrl, [preview.visualPeaks], preview.safeDuration);
    }

    ws.on('ready', () => {
      const rawDur = ws.getDuration();
      const dur = Math.round(
        hasUploadedAudio && rawDur > 0 ? rawDur : durationSec || 180
      );
      setActualDuration(dur);
      setIsReady(true);
      syncRegionsToWaveform(ws, regPlugin, cuesRef.current);

      if (resumeTimeOnSwapRef.current) {
        const { time, autoPlay } = resumeTimeOnSwapRef.current;
        resumeTimeOnSwapRef.current = null;
        const safeTime = Math.min(dur - 0.5, Math.max(0, time));
        ws.setTime(safeTime);
        setCurrentTime(safeTime);
        if (autoPlay) {
          ws.play();
        }
      }
    });

    ws.on('timeupdate', (t) => {
      setCurrentTime(t);
      const loopReg = activeLoopRegionRef.current;
      if (loopReg && t >= loopReg.end) {
        ws.setTime(loopReg.start);
        syncStemsTransport('seek', loopReg.start);
      }
    });

    ws.on('seeking', (t) => {
      syncStemsTransport('seek', t);
    });

    ws.on('play', () => {
      setIsPlaying(true);
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      syncStemsTransport('play', ws.getCurrentTime());
    });

    ws.on('pause', () => {
      setIsPlaying(false);
      syncStemsTransport('pause');
    });

    ws.on('finish', () => {
      setIsPlaying(false);
      syncStemsTransport('pause');
      onTrackCompleted();
    });

    ws.on('error', (err) => {
      console.warn('WaveSurfer audio error handled:', err);
      setIsReady(true);
      const preview = createSilentTimelinePreview(durationSec, cuesRef.current);
      ws.load(preview.silentWavUrl, [preview.visualPeaks], preview.safeDuration);
      onShowBanner('音訊載入受限，已啟用排練節拍時間軸模式。', 'warning');
    });

    regPlugin.on('region-created', (region: Region) => {
      if (region.id.startsWith('cue-region-')) return;
      const startSec = Math.round(region.start);
      const newCue: RehearsalCuePoint = {
        timeSec: startSec,
        timeFormatted: formatSec(startSec),
        sectionTitle: `合唱段落 (${formatSec(startSec)}–${formatSec(
          region.end
        )})`,
        characterFocus: 'Full Cast Ensemble · 群演合唱',
        actingTip: '依此區間進場演唱與走位',
        vocalTip: '點擊此區間可單獨循環練習。',
      };
      const updated = [...cuesRef.current, newCue].sort(
        (a, b) => a.timeSec - b.timeSec
      );
      onCuesChange(updated);
      onShowBanner(
        `已在聲波上新增段落標記 (${formatSec(region.start)} – ${formatSec(
          region.end
        )})。`
      );
    });

    regPlugin.on('region-updated', (region: Region) => {
      if (!region.id.startsWith('cue-region-')) return;
      const idx = Number(region.id.replace('cue-region-', ''));
      if (Number.isNaN(idx) || !cuesRef.current[idx]) return;

      const newStart = Math.max(0, Math.round(region.start));
      const nextList = cuesRef.current.map((c, i) =>
        i === idx
          ? {
              ...c,
              timeSec: newStart,
              timeFormatted: formatSec(newStart),
            }
          : c
      );
      onCuesChange(nextList);
    });

    regPlugin.on('region-clicked', (region: Region, e: MouseEvent) => {
      e.stopPropagation();
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const totalDur = ws.getDuration() || durationSec || 180;
        const seekTime = ratio * totalDur;
        ws.setTime(seekTime);
        syncStemsTransport('seek', seekTime);
        setCurrentTime(seekTime);
      }
      if (region.id.startsWith('cue-region-')) {
        const idx = Number(region.id.replace('cue-region-', ''));
        if (!Number.isNaN(idx)) setSelectedCueIdx(idx);
      }
    });

    return () => {
      ws.destroy();
      if (vocalAudioRef.current) {
        vocalAudioRef.current.pause();
        vocalAudioRef.current.currentTime = 0;
      }
      if (drumBassAudioRef.current) {
        drumBassAudioRef.current.pause();
        drumBassAudioRef.current.currentTime = 0;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      vocalCutFilterRef.current = null;
      bassBoostFilterRef.current = null;
      beatSnapFilterRef.current = null;
      if (generatedSilentUrl) {
        URL.revokeObjectURL(generatedSilentUrl);
      }
    };
  }, [trackId, effectiveWaveSurferUrl]);

  // Update waveform colors on theme switch WITHOUT destroying or reloading the audio player
  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.setOptions({
        waveColor: darkMode ? '#524D45' : '#C4BCAD',
        progressColor: darkMode ? '#9E4238' : '#853129',
        cursorColor: darkMode ? '#D2B48C' : '#7A4F24',
      });
      if (regionsPluginRef.current && isReady) {
        syncRegionsToWaveform(wsRef.current, regionsPluginRef.current, cues);
      }
    }
  }, [darkMode]);

  useEffect(() => {
    if (isReady && wsRef.current && regionsPluginRef.current) {
      syncRegionsToWaveform(wsRef.current, regionsPluginRef.current, cues);
    }
  }, [cues, isReady]);

  // Lazily connect Web Audio DSP filters ONLY when user explicitly enables Vocal Cut or Beat Boost
  // This guarantees 100% bit-perfect native audio playback when DSP filters are off.
  useEffect(() => {
    const needsDsp =
      (karaokeVocalCut && !usingBackingVersion) || beatBoostActive;

    if (needsDsp && wsRef.current && !audioCtxRef.current) {
      try {
        const mediaEl = wsRef.current.getMediaElement();
        if (mediaEl) {
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;

          const source = ctx.createMediaElementSource(mediaEl);

          const vocalCut = ctx.createBiquadFilter();
          vocalCut.type = 'peaking';
          vocalCut.frequency.value = 1250;
          vocalCut.Q.value = 0.85;
          vocalCut.gain.value = 0;
          vocalCutFilterRef.current = vocalCut;

          const bassBoost = ctx.createBiquadFilter();
          bassBoost.type = 'lowshelf';
          bassBoost.frequency.value = 115;
          bassBoost.gain.value = 0;
          bassBoostFilterRef.current = bassBoost;

          const beatSnap = ctx.createBiquadFilter();
          beatSnap.type = 'peaking';
          beatSnap.frequency.value = 2500;
          beatSnap.Q.value = 1.2;
          beatSnap.gain.value = 0;
          beatSnapFilterRef.current = beatSnap;

          source
            .connect(vocalCut)
            .connect(bassBoost)
            .connect(beatSnap)
            .connect(ctx.destination);
        }
      } catch {
        // Ignore if media element already connected
      }
    }

    if (vocalCutFilterRef.current) {
      vocalCutFilterRef.current.gain.value =
        karaokeVocalCut && !usingBackingVersion ? -15 : 0;
    }
    if (bassBoostFilterRef.current) {
      bassBoostFilterRef.current.gain.value = beatBoostActive ? 11 : 0;
    }
    if (beatSnapFilterRef.current) {
      beatSnapFilterRef.current.gain.value = beatBoostActive ? 5 : 0;
    }
  }, [karaokeVocalCut, beatBoostActive, usingBackingVersion, isReady]);

  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.setVolume(isMuted ? 0 : mainTrackVol / 100);
    }
    if (vocalAudioRef.current) {
      vocalAudioRef.current.volume = isMuted ? 0 : vocalStemVol / 100;
    }
    if (drumBassAudioRef.current) {
      drumBassAudioRef.current.volume = isMuted ? 0 : drumBassStemVol / 100;
    }
  }, [mainTrackVol, vocalStemVol, drumBassStemVol, isMuted]);

  useEffect(() => {
    if (!wsRef.current) return;
    const mediaEl = wsRef.current.getMediaElement();
    if (!mediaEl) return;

    const allMedia = [
      mediaEl,
      vocalAudioRef.current,
      drumBassAudioRef.current,
    ];

    if (pitchSemitones !== 0) {
      const pitchFactor = Math.pow(2, pitchSemitones / 12);
      allMedia.forEach((el) => {
        if (!el) return;
        el.preservesPitch = false;
        (
          el as unknown as {
            mozPreservesPitch?: boolean;
            webkitPreservesPitch?: boolean;
          }
        ).mozPreservesPitch = false;
        (
          el as unknown as {
            mozPreservesPitch?: boolean;
            webkitPreservesPitch?: boolean;
          }
        ).webkitPreservesPitch = false;
        el.playbackRate = playbackRate * pitchFactor;
      });
    } else {
      allMedia.forEach((el) => {
        if (!el) return;
        el.preservesPitch = true;
        el.playbackRate = playbackRate;
      });
    }
  }, [pitchSemitones, playbackRate, isReady]);

  useEffect(() => {
    return () => {
      if (metricsRafRef.current) cancelAnimationFrame(metricsRafRef.current);
      if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
      if (enhancerPipelineRef.current) {
        enhancerPipelineRef.current.destroy();
        enhancerPipelineRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (micAudioCtxRef.current) {
        micAudioCtxRef.current.close().catch(() => {});
        micAudioCtxRef.current = null;
      }
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!lrcModeOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleStampCurrentLrcLine();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lrcModeOpen, lrcCursorIdx, currentTime, lrcLines]);

  useEffect(() => {
    if (!externalSeekRequest || !wsRef.current || !isReady) return;
    const totalDur = actualDuration || durationSec || 180;
    const clamped = Math.max(
      0,
      Math.min(totalDur, externalSeekRequest.timeSec)
    );
    if (
      typeof externalSeekRequest.loopEndSec === 'number' &&
      externalSeekRequest.loopEndSec > clamped
    ) {
      activeLoopRegionRef.current = {
        start: clamped,
        end: Math.min(
          totalDur,
          Math.max(clamped + 2, externalSeekRequest.loopEndSec)
        ),
      };
      setLoopingRegionTitle(
        externalSeekRequest.loopLabel ||
          `${formatSec(clamped)} – ${formatSec(externalSeekRequest.loopEndSec)}`
      );
    } else {
      activeLoopRegionRef.current = null;
      setLoopingRegionTitle(null);
    }
    wsRef.current.setTime(clamped);
    syncStemsTransport('seek', clamped);
    setCurrentTime(clamped);
    onTimeUpdate?.(clamped);
    if (externalSeekRequest.autoPlay && !wsRef.current.isPlaying()) {
      wsRef.current.play().catch(() => {});
    }
  }, [externalSeekRequest?.seq, isReady]);

  const togglePlay = () => {
    if (!wsRef.current) return;
    if (!effectiveWaveSurferUrl && !isPlaying) {
      onShowBanner(
        '目前此場次尚未載入音檔（正以無聲時間軸預覽進場提示）。可點擊上方「載入音檔」掛載 MP3 / WAV。'
      );
    }
    wsRef.current.playPause();
  };

  const handleReset = () => {
    if (!wsRef.current) return;
    wsRef.current.pause();
    wsRef.current.setTime(0);
    syncStemsTransport('seek', 0);
    activeLoopRegionRef.current = null;
    setLoopingRegionTitle(null);
  };

  const handleSpeedChange = (rate: number) => {
    setPitchSemitones(0);
    setPlaybackRate(rate);
    if (wsRef.current) {
      wsRef.current.setPlaybackRate(rate, true);
    }
  };

  const handleMuteToggle = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (wsRef.current) {
      wsRef.current.setMuted(next);
    }
  };

  const handleToggleBackingOrKaraoke = () => {
    if (stems?.backingUrl) {
      resumeTimeOnSwapRef.current = {
        time: currentTime,
        autoPlay: isPlaying,
      };
      const next = !usingBackingVersion;
      setUsingBackingVersion(next);
      onShowBanner(
        next
          ? `已切換至純音樂伴奏版（由 ${formatSec(currentTime)} 接續播放）。`
          : `已切回有人聲導唱版（由 ${formatSec(currentTime)} 接續播放）。`
      );
      return;
    }

    if (filenameLooksInstrumental) {
      const next = !entryCountdownEnabled;
      setEntryCountdownEnabled(next);
      onShowBanner(
        next
          ? '已開啟純音樂進場前 3 秒倒數提示。'
          : '已關閉進場倒數提示。'
      );
      return;
    }

    const next = !karaokeVocalCut;
    setKaraokeVocalCut(next);
    onShowBanner(
      next
        ? '已開啟中頻人聲衰減模式（如已有純音樂檔，可於上方直接掛載）。'
        : '已恢復原始音場模式。'
    );
  };

  const cleanupMicAndPipeline = () => {
    if (metricsRafRef.current) {
      cancelAnimationFrame(metricsRafRef.current);
      metricsRafRef.current = null;
    }
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (enhancerPipelineRef.current) {
      enhancerPipelineRef.current.destroy();
      enhancerPipelineRef.current = null;
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

  const getOrCreateEnhancementPipeline = async (): Promise<{
    stream: MediaStream;
    pipeline: AudioEnhancementPipeline;
    ctx: AudioContext;
  }> => {
    if (
      enhancerPipelineRef.current &&
      micStreamRef.current &&
      micAudioCtxRef.current &&
      micAudioCtxRef.current.state !== 'closed'
    ) {
      return {
        stream: micStreamRef.current,
        pipeline: enhancerPipelineRef.current,
        ctx: micAudioCtxRef.current,
      };
    }

    const rawStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    micStreamRef.current = rawStream;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    micAudioCtxRef.current = ctx;

    const pipeline = createAudioEnhancementPipeline(rawStream, ctx, {
      enabled: enhancerEnabled,
      noiseGateThresholdDb: noiseGateThreshold,
      clarityBoostDb: clarityBoostGain,
    });
    enhancerPipelineRef.current = pipeline;

    const pollMetrics = () => {
      if (enhancerPipelineRef.current) {
        setEnhancementMetrics(enhancerPipelineRef.current.getMetrics());
        metricsRafRef.current = requestAnimationFrame(pollMetrics);
      }
    };
    if (metricsRafRef.current) cancelAnimationFrame(metricsRafRef.current);
    metricsRafRef.current = requestAnimationFrame(pollMetrics);

    return { stream: rawStream, pipeline, ctx };
  };

  useEffect(() => {
    if (enhancerPipelineRef.current) {
      enhancerPipelineRef.current.updateConfig({
        enabled: enhancerEnabled,
        noiseGateThresholdDb: noiseGateThreshold,
        clarityBoostDb: clarityBoostGain,
      });
    }
  }, [enhancerEnabled, noiseGateThreshold, clarityBoostGain]);

  const handleTogglePitchTuner = async () => {
    if (tunerActive) {
      if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
      setTunerActive(false);
      setPitchData({
        frequencyHz: null,
        noteName: '--',
        octave: null,
        centsOff: 0,
        rmsVolume: 0,
        stabilityLabel: '待命：請對著麥克風發聲',
        isSinging: false,
      });
      if (!isRecordingTake) {
        cleanupMicAndPipeline();
      }
      return;
    }

    try {
      const { pipeline, ctx } = await getOrCreateEnhancementPipeline();
      const analyser = pipeline.outputAnalyser;
      analyser.fftSize = 2048;
      const floatBuf = new Float32Array(analyser.fftSize);
      setTunerActive(true);
      setVocalLabDrawerOpen(true);
      onShowBanner(
        enhancerEnabled
          ? '音準感應器已啟動（已套用即時降噪與 3.2kHz 人聲增益），對著麥克風演唱即可判讀。'
          : '音準感應器已啟動（旁通原音模式），對著麥克風演唱即可判讀。'
      );

      const updatePitchLoop = () => {
        analyser.getFloatTimeDomainData(floatBuf);
        const res = detectPitchFromFloatBuffer(floatBuf, ctx.sampleRate);
        setPitchData(res);
        micRafRef.current = requestAnimationFrame(updatePitchLoop);
      };
      micRafRef.current = requestAnimationFrame(updatePitchLoop);
    } catch {
      onShowBanner(
        '無法開啟麥克風，請確認瀏覽器已允許麥克風權限。',
        'warning'
      );
    }
  };

  const handleToggleSelfRecording = async () => {
    if (isRecordingTake) {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
      if (recordTimerRef.current) {
        window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      setIsRecordingTake(false);
      return;
    }

    try {
      const { pipeline } = await getOrCreateEnhancementPipeline();
      const streamToRecord = pipeline.enhancedStream;
      const chunks: BlobPart[] = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = mimeType
        ? new MediaRecorder(streamToRecord, { mimeType })
        : new MediaRecorder(streamToRecord);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        if (recordedTakeUrl) {
          URL.revokeObjectURL(recordedTakeUrl);
        }
        const url = URL.createObjectURL(blob);
        setRecordedTakeUrl(url);
        setVocalLabDrawerOpen(true);
        if (!tunerActive) {
          cleanupMicAndPipeline();
        }
        onShowBanner(
          enhancerEnabled
            ? '15 秒跟唱試錄完成（已注入開源人聲增益與降噪濾波），可於下方播放檢聽。'
            : '15 秒跟唱試錄完成（旁通原音模式），可於下方播放檢聽。'
        );
      };

      recorder.start();
      setIsRecordingTake(true);
      setVocalLabDrawerOpen(true);
      setRecordingSeconds(0);

      if (wsRef.current && !isPlaying) {
        wsRef.current.play();
      }

      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= 15) {
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
            if (recordTimerRef.current) {
              window.clearInterval(recordTimerRef.current);
              recordTimerRef.current = null;
            }
            setIsRecordingTake(false);
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      onShowBanner('無法啟動錄音，請允許瀏覽器使用麥克風。', 'warning');
    }
  };

  const handleImportLrcOrSrtFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsedCues = parseLrcOrSrtToCues(text, file.name);
      if (parsedCues.length === 0) {
        onShowBanner(
          '在此檔案中找不到時間軸標記（如 [00:12.00] 或 00:00:12,000 -->），請確認格式。',
          'warning'
        );
        return;
      }
      onCuesChange(parsedCues);
      onShowBanner(
        `已匯入「${file.name}」，建立 ${parsedCues.length} 個時間軸段落。`
      );
    } catch {
      onShowBanner('讀取字幕檔失敗，請確認檔案為 UTF-8 編碼。', 'warning');
    }
  };

  const handleExportLrcFile = () => {
    const lrcString = exportCuesToLrcString(trackTitle, cues);
    const blob = new Blob([lrcString], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = trackTitle.replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
    a.download = `${safeName}_排練時間軸.lrc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowBanner('已匯出 .lrc 歌詞與走位時間軸檔。');
  };

  const handlePinInstantCueAtCurrentTime = (isEnsemble: boolean) => {
    const sec = Math.floor(currentTime);
    const newCue: RehearsalCuePoint = {
      timeSec: sec,
      timeFormatted: formatSec(sec),
      sectionTitle: isEnsemble
        ? `群演合唱進場 (${formatSec(sec)})`
        : `過門／獨唱段落 (${formatSec(sec)})`,
      characterFocus: isEnsemble
        ? 'Full Cast Ensemble · 群演合唱'
        : 'Solo · 獨唱或過門',
      actingTip: isEnsemble
        ? '注意指揮手勢與前奏拍點進場'
        : '過門預備或等待獨唱結束',
      vocalTip: isEnsemble ? '整齊起音' : '聆聽伴奏對位',
    };
    const next = [...cues, newCue].sort((a, b) => a.timeSec - b.timeSec);
    onCuesChange(next);
    onShowBanner(`已於 ${formatSec(sec)} 新增段落標記：「${newCue.sectionTitle}」。`);
  };

  const handleAutoDetectVocalPeaks = () => {
    if (!wsRef.current) return;
    const decoded = wsRef.current.getDecodedData();
    if (!decoded) {
      onShowBanner('請等待音檔聲波解碼完成後再執行自動分段。', 'warning');
      return;
    }

    const channelData = decoded.getChannelData(0);
    const sampleRate = decoded.sampleRate;
    const totalSec = decoded.duration;
    const windowSec = 2.0;
    const samplesPerWin = Math.max(1, Math.floor(sampleRate * windowSec));
    const numWindows = Math.floor(channelData.length / samplesPerWin);

    if (numWindows < 3) {
      onShowBanner('音檔長度較短，已直接標記為全段合唱。');
      return;
    }

    const rmsList: number[] = [];
    for (let w = 0; w < numWindows; w++) {
      let sumSq = 0;
      const startSample = w * samplesPerWin;
      for (let i = 0; i < samplesPerWin; i += 4) {
        const v = channelData[startSample + i] || 0;
        sumSq += v * v;
      }
      rmsList.push(Math.sqrt(sumSq / (samplesPerWin / 4)));
    }

    const sortedRms = [...rmsList].sort((a, b) => a - b);
    const medianRms = sortedRms[Math.floor(sortedRms.length * 0.52)] || 0.05;
    const threshold = medianRms * 1.12;

    const detectedCues: RehearsalCuePoint[] = [];
    let currentType: 'LOUD' | 'QUIET' | null = null;
    let lastAddedSec = -10;

    for (let w = 0; w < numWindows; w++) {
      const sec = Math.round(w * windowSec);
      const isLoud = rmsList[w] >= threshold;
      const nextType: 'LOUD' | 'QUIET' = isLoud ? 'LOUD' : 'QUIET';

      if (nextType !== currentType && sec - lastAddedSec >= 6) {
        currentType = nextType;
        lastAddedSec = sec;
        detectedCues.push({
          timeSec: sec,
          timeFormatted: formatSec(sec),
          sectionTitle: isLoud
            ? '伴奏強音區：群演齊唱進場'
            : '伴奏弱音區：前奏／過門預備',
          characterFocus: isLoud
            ? 'Full Cast Ensemble · 群演合唱'
            : 'Solo / Prelude · 獨唱或過場',
          actingTip: isLoud
            ? '伴奏音量轉強，群演進場開口'
            : '伴奏轉弱，預備下一個進場點與走位',
          vocalTip: isLoud ? '跟著重拍整齊起音' : '默數拍子預備',
        });
      }
    }

    if (detectedCues.length === 0 || detectedCues[0].timeSec > 0) {
      detectedCues.unshift({
        timeSec: 0,
        timeFormatted: '00:00',
        sectionTitle: '樂曲前奏預備',
        characterFocus: 'Prelude · 前奏',
        actingTip: '確認上場翼口與起始站位',
        vocalTip: '聆聽前奏速度',
      });
    }

    onCuesChange(detectedCues.slice(0, 8), Math.round(totalSec));
    onShowBanner(
      `已依音檔音量變化建立 ${
        detectedCues.filter((c) => isEnsembleCue(c)).length
      } 個合唱進場區段。`
    );
  };

  const handleStampCurrentLrcLine = () => {
    if (lrcLines.length === 0) return;
    if (wsRef.current && !isPlaying) {
      wsRef.current.play();
    }

    const lineIdx = lrcCursorIdx < lrcLines.length ? lrcCursorIdx : 0;
    const text = lrcLines[lineIdx];
    const sec = Math.floor(currentTime);
    const looksLikeEnsemble =
      text.includes('大家') ||
      text.includes('全') ||
      text.includes('合唱') ||
      text.includes('群演') ||
      (!text.includes('過門') && !text.includes('前奏') && !text.includes('獨唱'));

    const stampedCue: RehearsalCuePoint = {
      timeSec: sec,
      timeFormatted: formatSec(sec),
      sectionTitle: text,
      characterFocus: looksLikeEnsemble
        ? 'Full Cast Ensemble · 群演合唱'
        : 'Solo · 獨唱或過門',
      actingTip: looksLikeEnsemble
        ? '合唱進場段落'
        : '過門預備與隊形轉換',
      vocalTip: text,
    };

    const baseList = lineIdx === 0 ? [] : [...cues];
    const nextCues = [...baseList, stampedCue].sort(
      (a, b) => a.timeSec - b.timeSec
    );
    onCuesChange(nextCues);

    if (lineIdx + 1 < lrcLines.length) {
      setLrcCursorIdx(lineIdx + 1);
    } else {
      setLrcCursorIdx(0);
      onShowBanner('已完成全部歌詞與段落時間點標記。');
    }
  };

  const handleUpdateCueField = (
    idx: number,
    field: 'sectionTitle' | 'actingTip' | 'vocalTip' | 'toggleEnsemble',
    value?: string
  ) => {
    const next = cues.map((c, i) => {
      if (i !== idx) return c;
      if (field === 'toggleEnsemble') {
        const currentlyEns = isEnsembleCue(c);
        return {
          ...c,
          characterFocus: currentlyEns
            ? 'Solo · 主角獨唱／過門'
            : 'Full Cast Ensemble · 群演合唱',
        };
      }
      return {
        ...c,
        [field]: value ?? '',
      };
    });
    onCuesChange(next);
  };

  const handleAppendBlockingTag = (idx: number, tag: string) => {
    const target = cues[idx];
    if (!target) return;
    const current = target.actingTip || '';
    const nextTip = current.includes(tag)
      ? current
      : current
      ? `${current} · ${tag}`
      : tag;
    handleUpdateCueField(idx, 'actingTip', nextTip);
  };

  const handleDeleteCue = (idx: number) => {
    if (cues.length <= 1) return;
    const next = cues.filter((_, i) => i !== idx);
    onCuesChange(next);
    setSelectedCueIdx(0);
  };

  const borderHairline = 'border-[var(--border-subtle)]';
  const mutedText = 'text-[var(--text-muted)]';
  const secondaryText = 'text-[var(--text-secondary)]';
  const currentActiveCue =
    activeCueIndex >= 0 && activeCueIndex < cues.length
      ? cues[activeCueIndex]
      : null;
  const activeIsEnsemble = currentActiveCue
    ? isEnsembleCue(currentActiveCue)
    : false;

  const isCurrentlyPureInstrumental =
    usingBackingVersion || filenameLooksInstrumental;

  return (
    <div
      className={`px-3.5 sm:px-8 lg:px-10 py-4 sm:py-6 border-b ${borderHairline} space-y-4`}
    >
      {/* Hidden Synchronized Stem Audio Elements */}
      {stems?.vocalUrl && (
        <audio ref={vocalAudioRef} src={stems.vocalUrl} preload="auto" />
      )}
      {stems?.drumBassUrl && (
        <audio ref={drumBassAudioRef} src={stems.drumBassUrl} preload="auto" />
      )}

      {/* PURE INSTRUMENTAL 3-2-1 VISUAL ENTRY COUNTDOWN ALERT */}
      <div className="relative overflow-hidden">
        <div
          data-state={upcomingEnsembleCountdown ? 'open' : 'closed'}
          aria-hidden={!upcomingEnsembleCountdown}
          className="ui-drawer-shell px-4 sm:px-5 py-3.5 bg-[var(--accent-primary)] text-[#F6F3EC] border border-[var(--accent-gold-border)] flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-sm sm:text-lg font-bold text-[#F5DEB3] px-2.5 py-1 bg-black/25 tabular-nums shrink-0">
              倒數 {upcomingEnsembleCountdown?.secondsLeft ?? 3} 秒
            </span>
            <div className="min-w-0">
              <div className="text-[11px] text-[#E8D5B5] font-medium">
                純音樂進場預備（氣息準備，看指揮手勢）
              </div>
              <div className="font-display text-sm sm:text-base font-bold truncate">
                即將進場：「{upcomingEnsembleCountdown?.cue.sectionTitle ?? ''}」
              </div>
            </div>
          </div>
          <span className="text-xs font-mono text-[#F5DEB3] shrink-0 tabular-nums">
            進場點 {upcomingEnsembleCountdown?.cue.timeFormatted ?? '00:00'}
          </span>
        </div>
      </div>

      {/* ====================================================================
          UNIFIED STUDIO CONSOLE (整合式排練音控座：消除碎裂邊框，視覺集中且溫潤)
         ==================================================================== */}
      <div
        className={`border ${borderHairline} bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]`}
      >
        {/* CONSOLE ROW 1: Live Stage & Vocal Cue Monitor Bar */}
        {currentActiveCue && (
          <div
            className={`ui-cue-continuity px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-3 ${
              activeIsEnsemble
                ? 'border-l-[var(--accent-gold)] bg-[var(--bg-highlight)]'
                : 'border-l-transparent bg-[var(--bg-surface)]'
            }`}
          >
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-semibold text-[var(--accent-gold)] tabular-nums">
                  {currentActiveCue.timeFormatted}
                </span>
                <span className={mutedText}>·</span>
                <span
                  className={
                    activeIsEnsemble
                      ? 'font-semibold text-[var(--accent-gold)]'
                      : secondaryText
                  }
                >
                  {activeIsEnsemble ? '群演合唱進場' : '過門／獨唱對位'}
                </span>
                <span className={mutedText}>·</span>
                <span className={`truncate ${secondaryText}`}>
                  走位提示：{currentActiveCue.actingTip || '依舞台調度'}
                </span>
              </div>

              <div className="font-display text-base sm:text-xl font-bold tracking-tight break-words sm:truncate text-[var(--text-primary)]">
                {currentActiveCue.sectionTitle}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleUpdateCueField(activeCueIndex, 'toggleEnsemble')
                }
                className={`min-h-[34px] px-3 py-1.5 text-xs border ${borderHairline} bg-[var(--bg-elevated)] hover:border-[var(--accent-gold)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap`}
              >
                {activeIsEnsemble ? '改標為獨唱／過門' : '改標為群演合唱'}
              </button>
            </div>
          </div>
        )}

        {/* CONSOLE ROW 2: WaveSurfer.js Waveform Well */}
        <div className="px-4 sm:px-5 py-4 bg-[var(--bg-elevated)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-baseline gap-1 font-mono tabular-nums">
                <span className="text-base font-bold text-[var(--accent-gold)]">
                  {formatSec(currentTime)}
                </span>
                <span className={mutedText}>/ {formatSec(actualDuration)}</span>
              </div>
              <span className={mutedText}>·</span>
              <span
                className={`truncate max-w-[200px] sm:max-w-[320px] ${
                  isCustomAudio || stems?.backingUrl
                    ? 'text-[var(--status-sage)] font-medium'
                    : mutedText
                }`}
              >
                {isCustomAudio || stems?.backingUrl
                  ? effectiveAudioLabel
                  : '尚未掛載主音檔'}
              </span>

              {/* Direct Quick Audio Upload Button */}
              <label className="cursor-pointer min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--accent-bordeaux)] hover:opacity-90 text-white font-medium text-[11px] transition-opacity">
                <Upload className="w-3 h-3" />
                <span>{isCustomAudio ? '更換音檔' : '載入音檔'}</span>
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.m4b"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f) onUploadSingleFile(f);
                    e.target.value = '';
                  }}
                />
              </label>

              {/* Quick Remove Audio Button when custom audio is loaded */}
              {isCustomAudio && onRemoveTrackAudio && (
                <button
                  type="button"
                  onClick={() => onRemoveTrackAudio('main')}
                  className="ui-instant min-h-[32px] inline-flex items-center gap-1 px-2 py-1 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-[11px] font-medium transition-colors"
                  title="移除此曲本機主音檔"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>移除音檔</span>
                </button>
              )}

              {isCurrentlyPureInstrumental && (
                <>
                  <span className={mutedText}>·</span>
                  <span className="text-[var(--accent-gold)] font-medium">
                    純音樂伴奏模式
                  </span>
                </>
              )}
            </div>

            <div className={`hidden sm:flex items-center gap-2.5 text-[11px] ${mutedText}`}>
              <span>點擊聲波或拖曳下方進度條可精準跳轉</span>
            </div>
          </div>

          {/* Master Audio Scrubber & Quick Seek Controls */}
          <div className="p-2.5 bg-black/40 border border-[var(--border-subtle)] space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-2">
                <span className="text-[var(--accent-gold)] font-bold text-xs tabular-nums">
                  {formatSec(currentTime)}
                </span>
                <span className={mutedText}>/ {formatSec(actualDuration)}</span>
                <span className="text-[10px] text-[var(--accent-gold)] font-sans px-1.5 py-0.2 bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  即時拉動條
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(0, currentTime - 5);
                    if (wsRef.current) wsRef.current.setTime(next);
                    setCurrentTime(next);
                    onTimeUpdate?.(next);
                  }}
                  className={`px-2 py-0.5 border ${borderHairline} bg-[var(--bg-elevated)] hover:border-[var(--accent-gold-border)] text-[var(--accent-gold)] font-bold transition-colors`}
                  title="倒退 5 秒"
                >
                  « -5s
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(actualDuration, currentTime + 5);
                    if (wsRef.current) wsRef.current.setTime(next);
                    setCurrentTime(next);
                    onTimeUpdate?.(next);
                  }}
                  className={`px-2 py-0.5 border ${borderHairline} bg-[var(--bg-elevated)] hover:border-[var(--accent-gold-border)] text-[var(--accent-gold)] font-bold transition-colors`}
                  title="快進 5 秒"
                >
                  +5s »
                </button>
              </div>
            </div>

            {/* Draggable Scrubber Slider */}
            <div className="relative flex items-center py-0.5">
              <input
                type="range"
                min={0}
                max={Math.max(1, actualDuration)}
                step={0.1}
                value={currentTime}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurrentTime(val);
                  if (wsRef.current) {
                    wsRef.current.setTime(val);
                    syncStemsTransport('seek', val);
                  }
                  onTimeUpdate?.(val);
                }}
                className="w-full h-3 bg-black/70 border border-[var(--border-subtle)] appearance-none cursor-ew-resize accent-[var(--accent-gold)] hover:accent-amber-300 focus:outline-none transition-all"
                title="滑鼠按住拖動即可平滑拉動播放進度"
              />
            </div>
          </div>

          <div
            className="relative pt-1"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const f = e.dataTransfer.files?.[0];
              if (f) onUploadSingleFile(f);
            }}
          >
            {!isReady && (
              <div className="text-xs text-[var(--accent-gold)] py-6 text-center">
                正在解碼並繪製音訊聲波... (亦可直接拖放 MP3 檔案至此)
              </div>
            )}
            <div
              ref={containerRef}
              className="w-full cursor-pointer hover:brightness-105 select-none transition-all"
            />
          </div>
        </div>

        {/* CONSOLE ROW 3: Single-Row Transport, Pitch & Practice Drawer Controls */}
        <div className="px-4 sm:px-5 py-3 bg-[var(--bg-surface)] flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 text-xs">
          {/* Left Group: Transport + Speed + Pitch Stepper */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="ui-btn min-h-[38px] inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[#FAF8F3] font-semibold whitespace-nowrap shrink-0"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>暫停</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>播放</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className={`ui-btn min-h-[38px] inline-flex items-center gap-1 px-2.5 py-2 border ${borderHairline} bg-[var(--bg-elevated)] hover:border-[var(--accent-gold)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>回開頭</span>
            </button>

            {loopingRegionTitle && (
              <button
                type="button"
                onClick={() => {
                  activeLoopRegionRef.current = null;
                  setLoopingRegionTitle(null);
                }}
                className="ui-btn min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-2 bg-[var(--bg-highlight-strong)] border border-[var(--accent-gold-border)] text-[var(--accent-gold)] font-medium whitespace-nowrap shrink-0"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>循環中 ({loopingRegionTitle}) · 解除</span>
              </button>
            )}

            <span className={`hidden sm:inline px-1 ${mutedText}`}>|</span>

            {/* Speed 0.75x / 1.0x */}
            <div
              className={`inline-flex items-center border ${borderHairline} bg-[var(--bg-elevated)] font-mono`}
            >
              {[0.75, 1.0].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleSpeedChange(r)}
                  className={`ui-instant min-h-[36px] px-2.5 py-1.5 whitespace-nowrap ${
                    playbackRate === r && pitchSemitones === 0
                      ? 'bg-[var(--bg-highlight-strong)] text-[var(--accent-gold)] font-bold'
                      : `${secondaryText} hover:text-[var(--text-primary)]`
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>

            {/* Compact Pitch Stepper (-3 to +3 semitones) */}
            <div
              className={`inline-flex items-center border ${borderHairline} bg-[var(--bg-elevated)] font-mono`}
              title="半音升降調微調 (-3 至 +3 半音)"
            >
              <button
                type="button"
                onClick={() => setPitchSemitones((p) => Math.max(-3, p - 1))}
                disabled={pitchSemitones <= -3}
                className={`ui-instant min-h-[36px] px-2.5 py-1.5 ${secondaryText} hover:text-[var(--accent-gold)] disabled:opacity-30`}
              >
                ♭-
              </button>
              <button
                type="button"
                onClick={() => setPitchSemitones(0)}
                className={`ui-instant min-h-[36px] px-2.5 py-1.5 border-x ${borderHairline} tabular-nums whitespace-nowrap ${
                  pitchSemitones !== 0
                    ? 'text-[var(--accent-gold)] font-bold bg-[var(--bg-highlight)]'
                    : secondaryText
                }`}
              >
                {pitchSemitones === 0
                  ? '原調'
                  : pitchSemitones > 0
                  ? `+${pitchSemitones}半音`
                  : `${pitchSemitones}半音`}
              </button>
              <button
                type="button"
                onClick={() => setPitchSemitones((p) => Math.min(3, p + 1))}
                disabled={pitchSemitones >= 3}
                className={`ui-instant min-h-[36px] px-2.5 py-1.5 ${secondaryText} hover:text-[var(--accent-gold)] disabled:opacity-30`}
              >
                ♯+
              </button>
            </div>

            <button
              type="button"
              onClick={handleMuteToggle}
              aria-label="靜音"
              className={`ui-instant min-h-[36px] min-w-[36px] inline-flex items-center justify-center p-2 border ${borderHairline} bg-[var(--bg-elevated)] ${secondaryText} hover:text-[var(--text-primary)]`}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Right Group: Audio Mode Toggles + Collapsible Tool Drawers */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Guide vs Backing / Countdown Toggle */}
            <button
              type="button"
              onClick={handleToggleBackingOrKaraoke}
              className={`ui-btn min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 border whitespace-nowrap shrink-0 ${
                usingBackingVersion ||
                (filenameLooksInstrumental && entryCountdownEnabled) ||
                karaokeVocalCut
                  ? 'border-[var(--accent-gold-border)] bg-[var(--bg-highlight-strong)] text-[var(--accent-gold)] font-semibold'
                  : `${borderHairline} bg-[var(--bg-elevated)] ${secondaryText} hover:text-[var(--text-primary)] hover:border-[var(--accent-gold-border)]`
              }`}
            >
              <Music className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>
                {stems?.backingUrl
                  ? usingBackingVersion
                    ? '純音樂版（切回導唱）'
                    : '導唱版（切至純音樂）'
                  : filenameLooksInstrumental
                  ? entryCountdownEnabled
                    ? '純音樂倒數：開'
                    : '純音樂倒數：關'
                  : karaokeVocalCut
                  ? '人聲衰減：開'
                  : '人聲衰減'}
              </span>
            </button>

            {/* Beat Boost Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !beatBoostActive;
                setBeatBoostActive(next);
                onShowBanner(
                  next
                    ? '已開啟低頻與重拍強化，輔助純音樂伴奏對拍。'
                    : '已恢復標準頻率響應。'
                );
              }}
              className={`ui-btn min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 border whitespace-nowrap shrink-0 ${
                beatBoostActive
                  ? 'border-[var(--accent-gold-border)] bg-[var(--bg-highlight-strong)] text-[var(--accent-gold)] font-semibold'
                  : `${borderHairline} bg-[var(--bg-elevated)] ${secondaryText} hover:text-[var(--text-primary)] hover:border-[var(--accent-gold-border)]`
              }`}
            >
              <Drum className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>{beatBoostActive ? '重拍強化：開' : '重拍強化'}</span>
            </button>

            {/* Drawer 1 Trigger: Vocal Pitch Tuner & 15s Self-Recorder */}
            <button
              type="button"
              onClick={() => {
                setVocalLabDrawerOpen(!vocalLabDrawerOpen);
                if (!vocalLabDrawerOpen) setSoundCrewDrawerOpen(false);
              }}
              className={`ui-btn min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 border whitespace-nowrap shrink-0 ${
                vocalLabDrawerOpen || tunerActive || isRecordingTake
                  ? 'border-[var(--accent-gold-border)] bg-[var(--bg-highlight-strong)] text-[var(--accent-gold)] font-semibold'
                  : `${borderHairline} bg-[var(--bg-elevated)] ${secondaryText} hover:text-[var(--text-primary)] hover:border-[var(--accent-gold-border)]`
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>
                {isRecordingTake
                  ? `錄音中 (${15 - recordingSeconds}s)`
                  : tunerActive
                  ? `音準：${pitchData.noteName}`
                  : '音準與試錄'}
              </span>
              <ChevronDown
                className="w-3.5 h-3.5 ui-chevron"
                data-open={vocalLabDrawerOpen ? 'true' : 'false'}
              />
            </button>

            {/* Drawer 2 Trigger: Sound Crew Stems, LRC & Timeline Authoring */}
            <button
              type="button"
              onClick={() => {
                setSoundCrewDrawerOpen(!soundCrewDrawerOpen);
                if (!soundCrewDrawerOpen) setVocalLabDrawerOpen(false);
              }}
              className={`ui-btn min-h-[38px] inline-flex items-center gap-1.5 px-3 py-2 border whitespace-nowrap shrink-0 ${
                soundCrewDrawerOpen || lrcModeOpen
                  ? 'border-[var(--accent-gold-border)] bg-[var(--bg-highlight-strong)] text-[var(--accent-gold)] font-semibold'
                  : `${borderHairline} bg-[var(--bg-elevated)] ${secondaryText} hover:text-[var(--text-primary)] hover:border-[var(--accent-gold-border)]`
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
              <span>音控與打點</span>
              <ChevronDown
                className="w-3.5 h-3.5 ui-chevron"
                data-open={soundCrewDrawerOpen ? 'true' : 'false'}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          DRAWER A: 音準判讀與 15 秒跟唱試錄 (展開時才顯示，保持主畫面清爽)
         ==================================================================== */}
      <div className="relative overflow-hidden">
        <div
          data-state={
            vocalLabDrawerOpen || tunerActive || isRecordingTake
              ? 'open'
              : 'closed'
          }
          aria-hidden={!(vocalLabDrawerOpen || tunerActive || isRecordingTake)}
          className={`ui-drawer-shell p-4 border ${borderHairline} bg-[var(--bg-surface)] space-y-4`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-[var(--accent-gold)]">
                跟唱練習室：即時音準判讀與 15 秒自錄檢聽
              </span>
              <span className={mutedText}>
                · 開啟麥克風可即時檢測音高偏差，或錄下 15 秒跟唱回放對拍
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleTogglePitchTuner}
                className={`ui-btn min-h-[36px] py-1.5 px-3 border font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
                  tunerActive
                    ? 'border-[var(--status-sage)] bg-[var(--status-sage-bg)] text-[var(--status-sage)]'
                    : `${borderHairline} bg-[var(--bg-elevated)] hover:border-[var(--accent-gold-border)]`
                }`}
              >
                {tunerActive ? (
                  <>
                    <MicOff className="w-3.5 h-3.5" />
                    <span>關閉音準器</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    <span>啟動音準判讀</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleSelfRecording}
                className={`ui-btn min-h-[36px] py-1.5 px-3 border font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
                  isRecordingTake
                    ? 'border-rose-500 bg-[var(--accent-primary)] text-white'
                    : `${borderHairline} bg-[var(--bg-elevated)] hover:border-[var(--accent-gold-border)]`
                }`}
              >
                {isRecordingTake ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>停止錄音 ({15 - recordingSeconds}s)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    <span>錄製 15 秒跟唱</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (tunerActive) {
                    handleTogglePitchTuner();
                  }
                  setVocalLabDrawerOpen(false);
                }}
                className={`ui-instant min-h-[36px] px-2 text-xs underline ${mutedText}`}
              >
                收起
              </button>
            </div>
          </div>

          {/* ====================================================================
              即時麥克風降噪與人聲增益 DSP 模組 (RNNoise / Web Audio)
             ==================================================================== */}
          <div
            className={`p-3.5 border ${borderHairline} bg-[var(--bg-elevated)] space-y-3.5`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-7 h-7 flex items-center justify-center border border-[var(--accent-gold-border)] bg-[var(--bg-canvas)] text-[var(--accent-gold)] shrink-0">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent-gold)]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      即時麥克風降噪與人聲增益
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 border border-[var(--accent-gold-border)] text-[var(--accent-gold)] bg-[var(--bg-canvas)]">
                      Web Audio DSP · RNNoise
                    </span>
                  </div>
                  <p className={`text-[11px] ${mutedText} mt-0.5`}>
                    80Hz 空調嗡鳴過濾 · 自適應靜音噪音門 · 3.2kHz 劇院明亮泛音 · 防爆音動態壓限
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Live Gate Status Indicator */}
                <div className="text-xs">
                  {tunerActive || isRecordingTake ? (
                    enhancementMetrics.isGateOpen ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono border border-[var(--status-sage)]/50 bg-[var(--status-sage-bg)] text-[var(--status-sage)]">
                        <span className="w-2 h-2 rounded-full bg-[var(--status-sage)] animate-pulse" />
                        人聲演唱中 · 濾波開啟
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono border border-[var(--status-ochre)]/50 bg-[var(--status-ochre-bg)] text-[var(--status-ochre)]">
                        <span className="w-2 h-2 rounded-full bg-[var(--status-ochre)]" />
                        底噪抑制中 ({enhancementMetrics.reductionDb > 0 ? `-${enhancementMetrics.reductionDb}dB` : '門閉'})
                      </span>
                    )
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono border ${borderHairline} bg-[var(--bg-canvas)] ${mutedText}`}>
                      <Activity className="w-3 h-3 text-[var(--text-muted)]" />
                      待命中（開麥即時生效）
                    </span>
                  )}
                </div>

                {/* Bypass / Enable Button */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !enhancerEnabled;
                    setEnhancerEnabled(next);
                    onShowBanner(
                      next
                        ? '已啟用即時降噪與人聲增益引擎。'
                        : '已切換為旁通原音模式（Bypass）。'
                    );
                  }}
                  className={`ui-btn min-h-[32px] px-3 py-1 border text-xs font-semibold inline-flex items-center gap-1.5 ${
                    enhancerEnabled
                      ? 'border-[var(--status-sage)] bg-[var(--status-sage-bg)] text-[var(--status-sage)]'
                      : `${borderHairline} bg-[var(--bg-canvas)] text-[var(--text-muted)] hover:text-[var(--text-primary)]`
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{enhancerEnabled ? '降噪增益：已啟用' : '旁通原音 (Bypass)'}</span>
                </button>
              </div>
            </div>

            {/* Sliders & Real-Time Monitoring Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[var(--border-subtle)] text-xs">
              {/* Slider 1: Noise Gate Threshold */}
              <div className={`p-2.5 border ${borderHairline} bg-[var(--bg-canvas)] space-y-2`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-primary)]">
                    降噪深度 (Noise Gate)
                  </span>
                  <span className="font-mono text-[var(--accent-gold)] font-bold">
                    {noiseGateThreshold} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-54"
                  max="-30"
                  step="1"
                  value={noiseGateThreshold}
                  onChange={(e) => setNoiseGateThreshold(Number(e.target.value))}
                  disabled={!enhancerEnabled}
                  className="w-full accent-[var(--accent-gold)] cursor-pointer disabled:opacity-40"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                  <span>微弱 (-54dB)</span>
                  <span>平衡 (-42dB)</span>
                  <span>強效 (-30dB)</span>
                </div>
                <p className={`text-[10px] ${mutedText} leading-tight`}>
                  平滑壓制冷氣、電風扇與電腦底噪，靜音時自動閉門防音準跳動。
                </p>
              </div>

              {/* Slider 2: 3.2kHz Vocal Clarity Boost */}
              <div className={`p-2.5 border ${borderHairline} bg-[var(--bg-canvas)] space-y-2`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-primary)]">
                    人聲明亮增益 (Peaking EQ)
                  </span>
                  <span className="font-mono text-[var(--accent-gold)] font-bold">
                    +{clarityBoostGain} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.5"
                  value={clarityBoostGain}
                  onChange={(e) => setClarityBoostGain(Number(e.target.value))}
                  disabled={!enhancerEnabled}
                  className="w-full accent-[var(--accent-gold)] cursor-pointer disabled:opacity-40"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                  <span>原聲 (0dB)</span>
                  <span>微亮 (+4dB)</span>
                  <span>劇院唱腔 (+8dB)</span>
                </div>
                <p className={`text-[10px] ${mutedText} leading-tight`}>
                  增強 3.2kHz 歌唱泛音與發音咬字，提升舞台穿透感與回放立體度。
                </p>
              </div>

              {/* Box 3: Real-Time Signal Level & Processing Status */}
              <div className={`p-2.5 border ${borderHairline} bg-[var(--bg-canvas)] space-y-2 flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-[var(--text-primary)]">
                      即時電平與防破音
                    </span>
                    <span className="text-[10px] font-mono text-[var(--status-sage)]">
                      80Hz 濾波 · 壓限保全
                    </span>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={mutedText}>輸入訊號強度：</span>
                      <span className="font-mono tabular-nums text-[var(--text-primary)]">
                        {tunerActive || isRecordingTake ? `${enhancementMetrics.inputDb} dB` : '-- dB'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent-gold)] transition-all duration-75 origin-left"
                        style={{
                          width: `${
                            tunerActive || isRecordingTake
                              ? Math.min(100, Math.max(0, (enhancementMetrics.inputDb + 70) * 1.5))
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px]">
                  <span className={mutedText}>動態噪聲壓制量：</span>
                  <span className="font-mono font-bold text-[var(--status-sage)]">
                    {tunerActive || isRecordingTake
                      ? enhancementMetrics.reductionDb > 0
                        ? `-${enhancementMetrics.reductionDb} dB (濾波中)`
                        : '0 dB (全頻暢通)'
                      : '0 dB'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {tunerActive && (
            <div
              className={`p-3.5 border ${borderHairline} bg-[var(--bg-elevated)] flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 border border-[var(--accent-gold-border)] flex flex-col items-center justify-center bg-[var(--bg-canvas)] text-[var(--accent-gold)] shrink-0">
                  <span className="font-mono text-lg font-bold leading-none tabular-nums">
                    {pitchData.noteName}
                  </span>
                  <span className="font-mono text-[10px] opacity-75 mt-0.5 tabular-nums">
                    {pitchData.frequencyHz
                      ? `${pitchData.frequencyHz}Hz`
                      : '待命'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[var(--accent-gold)]">
                    {pitchData.stabilityLabel}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={mutedText}>音量：</span>
                    <div className="w-32 h-2 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] overflow-hidden">
                      <div
                        className="h-full w-full origin-left bg-[var(--status-sage)] transition-transform duration-75"
                        style={{
                          transform: `scaleX(${Math.max(
                            0,
                            Math.min(1, pitchData.rmsVolume)
                          )})`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                <span className={mutedText}>偏低</span>
                <div className="relative w-32 h-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] overflow-hidden">
                  <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[var(--accent-gold)]" />
                  {pitchData.frequencyHz && (
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-2 transition-transform duration-75 ${
                        Math.abs(pitchData.centsOff) <= 20
                          ? 'bg-[var(--status-sage)]'
                          : 'bg-[var(--status-ochre)]'
                      }`}
                      style={{
                        transform: `translateX(${Math.round(
                          (Math.min(92, Math.max(4, 50 + pitchData.centsOff)) /
                            100) *
                            120
                        )}px)`,
                      }}
                    />
                  )}
                </div>
                <span className={mutedText}>偏高</span>
              </div>
            </div>
          )}

          {recordedTakeUrl && (
            <div
              className={`p-3 border border-[var(--accent-gold-border)] bg-[var(--bg-elevated)] flex flex-wrap items-center justify-between gap-3 text-xs`}
            >
              <div className="flex items-center gap-2 font-medium text-[var(--accent-gold)]">
                <Mic className="w-3.5 h-3.5" />
                <span>15 秒跟唱試錄回放：</span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <audio
                  src={recordedTakeUrl}
                  controls
                  className="h-8 max-w-full sm:max-w-[220px]"
                />
                <a
                  href={recordedTakeUrl}
                  download={`${trackTitle}_跟唱試錄.webm`}
                  className="ui-btn min-h-[34px] inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--accent-gold)] text-[var(--bg-canvas)] font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下載錄音</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(recordedTakeUrl);
                    setRecordedTakeUrl(null);
                    onShowBanner('已刪除 15 秒跟唱試錄音檔。');
                  }}
                  className="ui-instant min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1.5 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>刪除試錄</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          DRAWER B: 音控分軌、純音樂配對與時間軸打點面板 (收納進階音控與舞監工具)
         ==================================================================== */}
      <div className="relative overflow-hidden">
        <div
          data-state={soundCrewDrawerOpen ? 'open' : 'closed'}
          aria-hidden={!soundCrewDrawerOpen}
          className={`ui-drawer-shell p-4 sm:p-5 border border-[var(--accent-gold-border)] bg-[var(--bg-surface)] space-y-5`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-[var(--border-subtle)]">
            <div>
              <h3 className="font-display text-sm sm:text-base font-bold text-[var(--accent-gold)] flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                <span>音控與舞監設定：音軌掛載、分軌混音與時間軸打點</span>
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              {onToggleAutoAdvance && (
                <button
                  type="button"
                  onClick={onToggleAutoAdvance}
                  className={`min-h-[34px] px-2.5 py-1 border ${
                    autoAdvanceNextTrack
                      ? 'border-[var(--accent-gold-border)] text-[var(--accent-gold)] font-semibold'
                      : `${borderHairline} ${mutedText}`
                  }`}
                >
                  {autoAdvanceNextTrack
                    ? '順演模式：結束自動跳下一首'
                    : '音控模式：單曲結束停駐 (Cue Stop)'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSoundCrewDrawerOpen(false)}
                className={`min-h-[34px] px-2 underline ${mutedText}`}
              >
                收起面板
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
            {/* Left 6 Cols: Audio Files & Stem Volumes */}
            <div className="lg:col-span-6 space-y-2.5">
              <div className="font-bold text-[var(--accent-gold)]">
                1. 單曲音檔與雙軌配對
              </div>

              <div className={`flex flex-wrap items-center justify-between gap-2 p-2.5 border ${borderHairline} bg-[var(--bg-elevated)]`}>
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    主音檔：{audioLabel || '尚未掛載'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!stems?.backingUrl && onTogglePureInstrumentalFlag && (
                    <button
                      type="button"
                      onClick={onTogglePureInstrumentalFlag}
                      className="min-h-[32px] px-1.5 text-[11px] text-[var(--accent-gold)] underline"
                    >
                      {filenameLooksInstrumental ? '改標為有人聲' : '標記為純音樂'}
                    </button>
                  )}
                  <label className="cursor-pointer min-h-[32px] inline-flex items-center px-2.5 py-1 border border-[var(--accent-gold-border)] text-[var(--accent-gold)] hover:bg-[var(--bg-highlight)]">
                    <span>更換主音檔</span>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.m4b"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        if (f) onUploadSingleFile(f);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {isCustomAudio && onRemoveTrackAudio && (
                    <button
                      type="button"
                      onClick={() => onRemoveTrackAudio('main')}
                      className="ui-instant min-h-[32px] inline-flex items-center gap-1 px-2 py-1 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                      title="移除此曲主音檔"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>移除</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 border border-[var(--accent-gold-border)] bg-[var(--bg-elevated)]">
                <div className="min-w-0">
                  <div className="font-medium text-[var(--accent-gold)] truncate">
                    純音樂伴奏軌：{stems?.backingName || '尚未配對純音樂版'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onUpdateStems && (
                    <label className="cursor-pointer min-h-[32px] inline-flex items-center px-2.5 py-1 bg-[var(--accent-primary)] text-[#FAF8F3] hover:bg-[var(--accent-primary-hover)] font-semibold shrink-0">
                      <span>{stems?.backingUrl ? '更換純音樂' : '掛載純音樂檔'}</span>
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.m4b"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          if (f) {
                            onUpdateStems('backing', f);
                            setUsingBackingVersion(true);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {stems?.backingUrl && onRemoveTrackAudio && (
                    <button
                      type="button"
                      onClick={() => {
                        setUsingBackingVersion(false);
                        onRemoveTrackAudio('backing');
                      }}
                      className="ui-instant min-h-[32px] inline-flex items-center gap-1 px-2 py-1 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                      title="移除純音樂伴奏軌"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>移除</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Volume Sliders */}
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 border ${borderHairline} bg-[var(--bg-elevated)]`}>
                <div className="flex items-center justify-between sm:w-36 shrink-0">
                  <span className="font-medium">主聲波音量</span>
                  <span className="font-mono sm:hidden tabular-nums text-[var(--accent-gold)]">
                    {mainTrackVol}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={mainTrackVol}
                  onChange={(e) => setMainTrackVol(Number(e.target.value))}
                  className="w-full sm:flex-1 accent-[var(--accent-gold)]"
                />
                <span className="hidden sm:inline font-mono w-9 text-right tabular-nums">
                  {mainTrackVol}%
                </span>
              </div>

              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 border ${borderHairline} bg-[var(--bg-elevated)]`}>
                <div className="flex items-center justify-between gap-2 sm:w-36 shrink-0">
                  <span className="truncate" title={stems?.vocalName}>
                    疊加導唱軌 {stems?.vocalName ? `(${stems.vocalName})` : ''}
                  </span>
                  <span className="font-mono sm:hidden tabular-nums text-[var(--accent-gold)]">
                    {vocalStemVol}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={vocalStemVol}
                  onChange={(e) => setVocalStemVol(Number(e.target.value))}
                  className="w-full sm:flex-1 accent-[var(--accent-gold)]"
                />
                <span className="hidden sm:inline font-mono w-9 text-right tabular-nums">
                  {vocalStemVol}%
                </span>
                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  {onUpdateStems && (
                    <label className="cursor-pointer min-h-[30px] inline-flex items-center px-2 py-0.5 border border-[var(--accent-gold-border)] text-[var(--accent-gold)]">
                      <span>{stems?.vocalUrl ? '更換' : '載入'}</span>
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.m4b"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          if (f) onUpdateStems('vocal', f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {stems?.vocalUrl && onRemoveTrackAudio && (
                    <button
                      type="button"
                      onClick={() => onRemoveTrackAudio('vocal')}
                      className="ui-instant min-h-[30px] inline-flex items-center gap-1 px-2 py-0.5 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                      title="移除疊加導唱軌"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>移除</span>
                    </button>
                  )}
                </div>
              </div>

              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 border ${borderHairline} bg-[var(--bg-elevated)]`}>
                <div className="flex items-center justify-between gap-2 sm:w-36 shrink-0">
                  <span className="truncate" title={stems?.drumBassName}>
                    疊加節拍軌 {stems?.drumBassName ? `(${stems.drumBassName})` : ''}
                  </span>
                  <span className="font-mono sm:hidden tabular-nums text-[var(--accent-gold)]">
                    {drumBassStemVol}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={drumBassStemVol}
                  onChange={(e) => setDrumBassStemVol(Number(e.target.value))}
                  className="w-full sm:flex-1 accent-[var(--accent-gold)]"
                />
                <span className="hidden sm:inline font-mono w-9 text-right tabular-nums">
                  {drumBassStemVol}%
                </span>
                <div className="flex items-center justify-end gap-1.5 shrink-0">
                  {onUpdateStems && (
                    <label className="cursor-pointer min-h-[30px] inline-flex items-center px-2 py-0.5 border border-[var(--accent-gold-border)] text-[var(--accent-gold)]">
                      <span>{stems?.drumBassUrl ? '更換' : '載入'}</span>
                      <input
                        type="file"
                        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus,.m4b"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          if (f) onUpdateStems('drumBass', f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                  {stems?.drumBassUrl && onRemoveTrackAudio && (
                    <button
                      type="button"
                      onClick={() => onRemoveTrackAudio('drumBass')}
                      className="ui-instant min-h-[30px] inline-flex items-center gap-1 px-2 py-0.5 border border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                      title="移除疊加節拍軌"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>移除</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right 6 Cols: Timeline Pinning & LRC/SRT Import/Export */}
            <div className="lg:col-span-6 space-y-3 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="font-bold text-[var(--accent-gold)]">
                  2. 時間軸段落標記與 .LRC / .SRT 字幕工具
                </div>
                <p className={`leading-relaxed ${secondaryText}`}>
                  可直接於播放秒數插旗標記、依音檔音量變化自動切分強弱音段落，或匯入標準 .lrc / .srt 歌詞時間軸檔。
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handlePinInstantCueAtCurrentTime(true)}
                    className={`ui-instant inline-flex items-center justify-center gap-1.5 px-3 py-2 border ${borderHairline} bg-[var(--bg-elevated)] text-[var(--accent-gold)] hover:border-[var(--accent-gold-border)] font-medium`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>於當前秒數標記進場</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoDetectVocalPeaks}
                    className={`ui-btn inline-flex items-center justify-center gap-1.5 px-3 py-2 border ${borderHairline} bg-[var(--bg-elevated)] hover:border-[var(--accent-gold-border)]`}
                  >
                    <Zap className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    <span>依音量自動分段</span>
                  </button>

                  <label
                    className={`cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[#FAF8F3] font-semibold transition-colors`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>匯入 .LRC / .SRT</span>
                    <input
                      type="file"
                      accept=".lrc,.srt,.txt"
                      className="hidden"
                      onChange={(e) => {
                        handleImportLrcOrSrtFile(e.target.files?.[0] || null);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleExportLrcFile}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 border ${borderHairline} bg-[var(--bg-elevated)] hover:border-[var(--accent-gold-border)] font-medium`}
                  >
                    <Download className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    <span>匯出 .LRC 時間軸</span>
                  </button>
                </div>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setLrcModeOpen(!lrcModeOpen)}
                    className={`ui-btn w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border ${
                      lrcModeOpen
                        ? 'border-[var(--accent-gold-border)] bg-[var(--bg-highlight-strong)] text-[var(--accent-gold)] font-semibold'
                        : `${borderHairline} bg-[var(--bg-elevated)] hover:border-[var(--accent-gold-border)]`
                    }`}
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>
                      {lrcModeOpen
                        ? '收起空白鍵打點對詞工具'
                        : '開啟「空白鍵即時打點對詞」工具'}
                    </span>
                  </button>
                </div>
              </div>

              <div className={`p-3 border ${borderHairline} bg-[var(--bg-elevated)] text-[11px] ${mutedText}`}>
                整包匯入資料夾時，檔名含 <code>純音樂</code>、<code>伴奏</code>、<code>inst</code>、<code>backing</code> 將自動配對為純音樂軌。
              </div>
            </div>
          </div>

          {/* Nested LRC Spacebar Tapper inside Sound Crew / Authoring workflow */}
          {lrcModeOpen && (
            <div className={`pt-4 border-t ${borderHairline} space-y-3`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--accent-gold)]">
                  LRC 空白鍵時間軸打點（播放時按空白鍵即可將該行標記於當前秒數）
                </span>
                <button
                  type="button"
                  onClick={() => setLrcModeOpen(false)}
                  className={`ui-instant text-xs underline ${mutedText}`}
                >
                  關閉打點
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                <div className="md:col-span-6">
                  <textarea
                    rows={4}
                    value={lrcLinesText}
                    onChange={(e) => {
                      setLrcLinesText(e.target.value);
                      setLrcCursorIdx(0);
                    }}
                    placeholder="每行輸入一句歌詞或段落標題..."
                    className={`w-full p-2.5 text-xs bg-[var(--bg-elevated)] border ${borderHairline} focus:outline-none focus:border-[var(--accent-gold)] leading-relaxed`}
                  />
                </div>
                <div className="md:col-span-6 space-y-2">
                  <button
                    type="button"
                    onClick={handleStampCurrentLrcLine}
                    className="ui-instant w-full py-4 px-4 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[#FAF8F3] text-center space-y-1"
                  >
                    <div className="text-[11px] text-[#E8D5B5]">
                      點擊或按空白鍵標記第 {lrcCursorIdx + 1} /{' '}
                      {Math.max(1, lrcLines.length)} 行（{formatSec(currentTime)}）
                    </div>
                    <div className="font-display text-base font-bold truncate">
                      「{lrcLines[lrcCursorIdx] || '請先於左側輸入文字'}」
                    </div>
                  </button>
                  <div className="flex justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={() => setLrcCursorIdx(0)}
                      className={`ui-instant ${mutedText} hover:underline`}
                    >
                      重置回第 1 行
                    </button>
                    <span className={mutedText}>標記後自動寫入下方走位提詞表</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
