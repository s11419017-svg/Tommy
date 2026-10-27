/**
 * Vocal Audio Helper for Amateur Singers
 * - Realistic piano/bell tone synthesizer for reference pitch (給起音)
 * - Vocal warm-up arpeggios (Do-Mi-Sol-Mi-Do)
 * - Real-time pitch autocorrelation for microphone input
 */

export interface PitchInfo {
  frequency: number | null;
  note: string;
  octave: number | null;
  cents: number;
  rms: number;
  status: 'perfect' | 'sharp' | 'flat' | 'silent';
  statusText: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const REFERENCE_PITCHES: Array<{ note: string; freq: number; label: string; roleHint?: string }> = [
  { note: 'C3', freq: 130.81, label: 'C3 (低男音)', roleHint: '低男聲部/合唱男低' },
  { note: 'E3', freq: 164.81, label: 'E3', roleHint: '男中低起音' },
  { note: 'G3', freq: 196.0, label: 'G3', roleHint: '尚萬強常規音區' },
  { note: 'A3', freq: 220.0, label: 'A3', roleHint: '賈維/安佐拉爆發音' },
  { note: 'C4', freq: 261.63, label: 'C4 (中央 C)', roleHint: '男高女低交匯基準音' },
  { note: 'D4', freq: 293.66, label: 'D4', roleHint: '合唱進場音' },
  { note: 'E4', freq: 329.63, label: 'E4', roleHint: '芳婷起音' },
  { note: 'G4', freq: 392.0, label: 'G4', roleHint: '珂賽特/愛波寧高音' },
  { note: 'A4', freq: 440.0, label: 'A4 (國際標準 A)', roleHint: '女高音核心穿透音' },
  { note: 'C5', freq: 523.25, label: 'C5 (高八度 C)', roleHint: '女高音華彩高音' },
];

let globalAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    globalAudioCtx = new AudioCtx();
  }
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

/**
 * Play a warm piano-bell hybrid reference tone
 */
export function playReferenceTone(freq: number, durationSec = 1.2): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Dual oscillator: fundamental sine + warm triangle harmonic
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now); // 2nd harmonic overtone

    // Amplitude envelope with natural acoustic decay
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec + 0.05);
    osc2.stop(now + durationSec + 0.05);
  } catch (err) {
    console.warn('Unable to play reference tone', err);
  }
}

/**
 * Pitch detection using Autocorrelation
 */
export function analyzePitchFromBuffer(buffer: Float32Array, sampleRate: number): PitchInfo {
  let sumSq = 0;
  for (let i = 0; i < buffer.length; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSq / buffer.length);

  // If too quiet, return silent
  if (rms < 0.015) {
    return {
      frequency: null,
      note: '--',
      octave: null,
      cents: 0,
      rms,
      status: 'silent',
      statusText: '等待發聲...',
    };
  }

  // Normalized autocorrelation
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;
  const correlations = new Float32Array(MAX_SAMPLES);

  for (let offset = 0; offset < MAX_SAMPLES; offset++) {
    let correlation = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }
    correlation = 1 - correlation / MAX_SAMPLES;
    correlations[offset] = correlation;

    if (correlation > 0.9 && correlation > bestCorrelation) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      // Short-circuit peak found
      break;
    }
  }

  if (bestCorrelation > 0.01 && bestOffset > 0) {
    const fundamentalFreq = sampleRate / bestOffset;
    if (fundamentalFreq >= 65 && fundamentalFreq <= 1200) {
      // Calculate MIDI note and cents
      const noteNum = 12 * (Math.log(fundamentalFreq / 440) / Math.log(2)) + 69;
      const roundedNote = Math.round(noteNum);
      const cents = Math.round((noteNum - roundedNote) * 100);
      const noteIndex = (roundedNote % 12 + 12) % 12;
      const octave = Math.floor(roundedNote / 12) - 1;
      const noteName = `${NOTE_NAMES[noteIndex]}${octave}`;

      let status: 'perfect' | 'sharp' | 'flat' = 'perfect';
      let statusText = '🎯 音準完美！維持住氣息';
      if (cents > 12) {
        status = 'sharp';
        statusText = `⬆️ 偏高 +${cents} 音分 (喉部稍放鬆)`;
      } else if (cents < -12) {
        status = 'flat';
        statusText = `⬇️ 偏低 ${cents} 音分 (加強丹田支撐)`;
      }

      return {
        frequency: Math.round(fundamentalFreq * 10) / 10,
        note: noteName,
        octave,
        cents,
        rms,
        status,
        statusText,
      };
    }
  }

  return {
    frequency: null,
    note: '--',
    octave: null,
    cents: 0,
    rms,
    status: 'silent',
    statusText: '偵測歌聲中...',
  };
}
