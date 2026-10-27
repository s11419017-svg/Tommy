/**
 * Lyrics & Cue Parsing Utility
 * Supports LRC, SRT, Plain Text with Role Detection, Auto-Distribution, and Tap-to-Sync.
 */

import { RehearsalCuePoint } from '../data/lesMisTracks';

export function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function classifyEnsembleLine(text: string): boolean {
  const lower = text.toLowerCase();
  if (
    lower.includes('全體') ||
    lower.includes('眾人') ||
    lower.includes('合唱') ||
    lower.includes('大家') ||
    lower.includes('人民') ||
    lower.includes('ensemble') ||
    lower.includes('chorus') ||
    lower.includes('all')
  ) {
    return true;
  }
  if (
    lower.includes('獨唱') ||
    lower.includes('solo') ||
    lower.includes('過門') ||
    lower.includes('前奏') ||
    lower.includes('間奏')
  ) {
    return false;
  }
  return true;
}

export interface ParsedRawLine {
  id: string;
  originalText: string;
  role: string;
  lyric: string;
  isEnsemble: boolean;
  timeSec?: number;
}

/**
 * Intelligent Script & Lyric Text Parser
 * Detects role prefixes such as:
 * - 【尚萬強】我有我的尊嚴
 * - [Javert] Do not forget my name
 * - Marius: A heart full of love
 * - 合唱：聽見人民在怒吼
 */
export function parseRawPlainTextLyrics(rawText: string): ParsedRawLine[] {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const results: ParsedRawLine[] = [];

  const bracketPattern = /^[【\[（\(]([^】\]）\)]+)[】\]）\)]\s*(.*)$/;
  const colonPattern = /^([^\s:：]{1,16})\s*[:：]\s*(.*)$/;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Skip metadata headers if accidentally pasted
    if (rawLine.startsWith('#') || rawLine.startsWith('//') || rawLine.startsWith('[ti:') || rawLine.startsWith('[ar:')) {
      continue;
    }

    let role = '';
    let lyric = rawLine;

    const bMatch = rawLine.match(bracketPattern);
    if (bMatch) {
      role = bMatch[1].trim();
      lyric = bMatch[2].trim() || role;
    } else {
      const cMatch = rawLine.match(colonPattern);
      if (cMatch) {
        role = cMatch[1].trim();
        lyric = cMatch[2].trim() || role;
      }
    }

    // Role normalization
    let normalizedRole = 'Full Cast Ensemble · 群演合唱';
    const roleLower = role.toLowerCase();
    if (!role) {
      const isEns = classifyEnsembleLine(lyric);
      normalizedRole = isEns ? 'Full Cast Ensemble · 群演合唱' : 'Solo / Lead · 領唱獨唱';
    } else if (
      roleLower.includes('合唱') ||
      roleLower.includes('全體') ||
      roleLower.includes('眾人') ||
      roleLower.includes('chorus') ||
      roleLower.includes('ensemble')
    ) {
      normalizedRole = 'Full Cast Ensemble · 群演合唱';
    } else if (roleLower.includes('尚萬強') || roleLower.includes('valjean')) {
      normalizedRole = 'Jean Valjean · 尚萬強';
    } else if (roleLower.includes('賈維') || roleLower.includes('javert')) {
      normalizedRole = 'Javert · 賈維';
    } else if (roleLower.includes('芳婷') || roleLower.includes('fantine')) {
      normalizedRole = 'Fantine · 芳婷';
    } else if (roleLower.includes('珂賽特') || roleLower.includes('cosette')) {
      normalizedRole = 'Cosette · 珂賽特';
    } else if (roleLower.includes('馬里歐') || roleLower.includes('marius')) {
      normalizedRole = 'Marius · 馬里歐';
    } else if (roleLower.includes('愛波寧') || roleLower.includes('eponine') || roleLower.includes('éponine')) {
      normalizedRole = 'Éponine · 愛波寧';
    } else if (roleLower.includes('安佐拉') || roleLower.includes('enjolras')) {
      normalizedRole = 'Enjolras · 安佐拉';
    } else if (roleLower.includes('德納第') || roleLower.includes('thenardier')) {
      normalizedRole = 'Thénardier · 德納第夫婦';
    } else {
      normalizedRole = `${role} · 角色聲部`;
    }

    const isEns =
      normalizedRole.includes('合唱') ||
      normalizedRole.includes('Ensemble') ||
      classifyEnsembleLine(lyric);

    results.push({
      id: `raw-${i}-${Date.now()}`,
      originalText: rawLine,
      role: normalizedRole,
      lyric: lyric,
      isEnsemble: isEns,
    });
  }

  return results;
}

/**
 * Automatically distribute lines evenly across the track duration
 */
export function autoDistributeTimestamps(
  parsedLines: ParsedRawLine[],
  totalDurationSec: number,
  introSec = 6,
  outroSec = 6
): RehearsalCuePoint[] {
  if (parsedLines.length === 0) return [];
  const usableDur = Math.max(10, totalDurationSec - introSec - outroSec);
  const step = usableDur / Math.max(1, parsedLines.length);

  return parsedLines.map((line, idx) => {
    const sec = Math.round(introSec + idx * step);
    return {
      timeSec: sec,
      timeFormatted: formatSec(sec),
      sectionTitle: line.lyric,
      characterFocus: line.role,
      actingTip: line.isEnsemble ? '按節拍整齊合唱' : '角色情緒與眼神定位',
      vocalTip: line.lyric,
    };
  });
}

/**
 * Parse .LRC or .SRT content directly into cue points
 */
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
          const parsed = parseRawPlainTextLyrics(mergedText)[0];
          const isEns = parsed ? parsed.isEnsemble : classifyEnsembleLine(mergedText);
          const role = parsed ? parsed.role : (isEns ? 'Full Cast Ensemble · 群演合唱' : 'Solo / Prelude · 獨唱或過門');
          const lyricOnly = parsed ? parsed.lyric : mergedText;

          cues.push({
            timeSec: totalSec,
            timeFormatted: formatSec(totalSec),
            sectionTitle: lyricOnly,
            characterFocus: role,
            actingTip: isEns ? '按拍點整齊進場演唱' : '過門預備與走位調整',
            vocalTip: lyricOnly,
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

      const parsed = parseRawPlainTextLyrics(lyricText)[0];
      const isEns = parsed ? parsed.isEnsemble : classifyEnsembleLine(lyricText);
      const role = parsed ? parsed.role : (isEns ? 'Full Cast Ensemble · 群演合唱' : 'Solo / Prelude · 獨唱或過門');
      const lyricOnly = parsed ? parsed.lyric : lyricText;

      cues.push({
        timeSec: totalSec,
        timeFormatted: formatSec(totalSec),
        sectionTitle: lyricOnly,
        characterFocus: role,
        actingTip: isEns ? '按拍點整齊進場演唱' : '過門預備與走位調整',
        vocalTip: lyricOnly,
      });
    }
  }

  return cues.sort((a, b) => a.timeSec - b.timeSec);
}

/**
 * Export cues to standard .LRC format
 */
export function exportCuesToLrcString(
  trackTitle: string,
  cues: RehearsalCuePoint[]
): string {
  const header = [
    `[ti:${trackTitle}]`,
    `[ar:Les Misérables 公演排練工作台]`,
    `[al:舞台排練時間軸]`,
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
    const prefix = c.characterFocus && !c.characterFocus.includes('Ensemble') 
      ? `【${c.characterFocus.split('·')[0].trim()}】` 
      : '';
    const blockingSuffix = c.actingTip ? ` (${c.actingTip})` : '';
    return `${tag}${prefix}${c.sectionTitle}${blockingSuffix}`;
  });
  return [...header, ...body].join('\n');
}
