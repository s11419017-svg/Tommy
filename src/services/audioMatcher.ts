import { LesMisTrackItem } from '../data/lesMisTracks';

interface TrackKeywords {
  order: number;
  keywords: string[];
}

const TRACK_KEYWORDS: TrackKeywords[] = [
  {
    order: 1,
    keywords: [
      'prologue',
      'look down',
      'work song',
      '序幕',
      '序曲',
      '低頭',
      '苦役',
      '俯首低頭',
    ],
  },
  {
    order: 2,
    keywords: [
      'soliloquy',
      'what have i done',
      '尚萬強獨白',
      '尚萬強',
      '獨白',
      '我做了什麼',
    ],
  },
  {
    order: 3,
    keywords: ['end of the day', '一日將盡', '日將盡'],
  },
  {
    order: 4,
    keywords: ['dreamed a dream', '我曾有夢', '曾有夢', '做夢'],
  },
  {
    order: 5,
    keywords: ['lovely ladies', '可愛的女士', '女士們'],
  },
  {
    order: 6,
    keywords: ['who am i', '我是誰', '審判'],
  },
  {
    order: 7,
    keywords: ['come to me', 'fantine', '芳汀', '芳婷', '來到我身邊', '芳汀之死'],
  },
  {
    order: 8,
    keywords: ['confrontation', '正面對決', '對決', '正面衝突', '衝突'],
  },
  {
    order: 9,
    keywords: ['castle on a cloud', '雲端城堡', '城堡'],
  },
  {
    order: 10,
    keywords: ['master of the house', '酒店主人', '酒館老闆', '酒館'],
  },
  {
    order: 11,
    keywords: [
      'bargain',
      'waltz of treachery',
      '交易',
      '背叛',
      '華爾滋',
      '背叛之華爾滋',
    ],
  },
  {
    order: 12,
    keywords: ['stars', '繁星', '星星'],
  },
  {
    order: 13,
    keywords: ['red and black', 'abc cafe', '紅與黑', '咖啡館', 'abc咖啡館'],
  },
  {
    order: 14,
    keywords: [
      'people sing',
      '人民在歌唱',
      '人民之歌',
      'do you hear',
      '可聽見人民',
      '人民',
    ],
  },
  {
    order: 15,
    keywords: [
      'in my life',
      'heart full of love',
      '滿懷愛意',
      '在我生命中',
      '愛意',
    ],
  },
  {
    order: 16,
    keywords: ['one day more', '只待明日', '再過一天', '明日', '待明日'],
  },
  {
    order: 17,
    keywords: ['on my own', '形單影隻', '獨自一人', '形影相弔', '孤單'],
  },
  {
    order: 18,
    keywords: ['barricade', 'upon these stones', '街壘', '築起街壘', '街壘戰'],
  },
  {
    order: 19,
    keywords: ['bring him home', '帶他回家', '回家'],
  },
  {
    order: 20,
    keywords: ['empty chairs', 'empty tables', '空桌空椅', '人去樓空', '空桌'],
  },
  {
    order: 21,
    keywords: ['finale', '終曲', '大結局', '大合唱', '結局'],
  },
];

/**
 * Robust audio file to track matcher.
 * Tests multiple heuristics:
 * 1. Explicit track numbers (e.g. "01", "Track 01", "1 -", "01.")
 * 2. High-precision theatrical English & Chinese keywords
 * 3. Exact track title fuzzy substring match
 * 4. AudioLabel match
 */
export function matchAudioFileToTrack(
  fileName: string,
  tracks: LesMisTrackItem[]
): LesMisTrackItem | null {
  if (!fileName || !tracks || tracks.length === 0) return null;

  const lowerName = fileName.toLowerCase().replace(/[\-_]/g, ' ');

  // Heuristic 1: Track order match from filename
  // Matches "01", "track 1", "track01", "no.1", "1.", "1 -", "[01]", "(01)"
  const orderPatterns = [
    /(?:^|[^a-zA-Z0-9])(?:track|no\.?|cd\d+[-_]?|#)?\s*0?([1-9]|1[0-9]|2[0-1])(?:\s*[-._:)\]]|\s+|$)/i,
    /^0?([1-9]|1[0-9]|2[0-1])(?:\b|[-._\s]|$)/,
  ];

  for (const pattern of orderPatterns) {
    const match = fileName.match(pattern);
    if (match && match[1]) {
      const orderNum = parseInt(match[1], 10);
      const target = tracks.find((t) => t.order === orderNum);
      if (target) return target;
    }
  }

  // Heuristic 2: Keywords matching (longest / most specific keyword first)
  for (const entry of TRACK_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (lowerName.includes(kw.toLowerCase())) {
        const target = tracks.find((t) => t.order === entry.order);
        if (target) return target;
      }
    }
  }

  // Heuristic 3: Substring match with track title parts
  for (const t of tracks) {
    // Strip track number e.g. "01. "
    const cleanTitle = t.title.replace(/^\d+[\s.-]+/, '').toLowerCase();
    const parts = cleanTitle
      .split(/[/()]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 3);

    for (const p of parts) {
      if (lowerName.includes(p)) {
        return t;
      }
    }
  }

  // Heuristic 4: AudioLabel match
  for (const t of tracks) {
    if (t.audioLabel && t.audioLabel.trim().length >= 3) {
      const cleanLabel = t.audioLabel.trim().toLowerCase();
      if (lowerName.includes(cleanLabel) || cleanLabel.includes(lowerName)) {
        return t;
      }
    }
  }

  return null;
}
