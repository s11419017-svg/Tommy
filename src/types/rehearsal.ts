import { LesMisTrackItem, RehearsalCuePoint } from '../data/lesMisTracks';
import { MasteryState } from '../machines/rehearsalStateMachine';

export type ActiveView = 'portal' | 'rehearsal' | 'tracks' | 'supervision';

export type SectionGroup =
  | 'Principal Cast'
  | 'Soprano / Alto'
  | 'Tenor / Bass'
  | 'Stage Direction';

export interface UserProfileDoc {
  uid: string;
  displayName: string;
  characterRole: string;
  sectionGroup: SectionGroup;
}

export interface ProgressRecord {
  progressId: string;
  userId: string;
  userName: string;
  characterRole: string;
  trackId: string;
  trackOrder?: number;
  trackTitle: string;
  masteryState: MasteryState;
  lastPlaybackState?: string;
  practiceCount: number;
  totalPracticeSeconds: number;
  personalNotes: string;
  directorFeedback: string;
  updatedAtIso?: string;
}

export interface TrackStemFiles {
  backingUrl?: string;
  backingName?: string;
  vocalUrl?: string;
  vocalName?: string;
  drumBassUrl?: string;
  drumBassName?: string;
  isPureInstrumentalTrack?: boolean;
}

export interface ProductionCallboard {
  dateIso: string;
  directorNotice: string;
  calledTrackIds: string[];
}

export interface CueSpanInfo {
  cue: RehearsalCuePoint;
  idx: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  leftPct: number;
  widthPct: number;
  isMine: boolean;
}

export interface StoredAudioMeta {
  trackId: string;
  fileName: string;
  url: string;
  durationSec?: number;
}
