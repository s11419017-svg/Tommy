/**
 * Dual Finite State Machines (FSM) for Les Misérables Rehearsal Platform
 * 1. PlaybackFSM: Governs audio track loading, playback, A-B section looping, and completion.
 * 2. MasteryFSM: Governs student rehearsal progression from UNSTARTED to STAGE_READY.
 */

export enum PlaybackState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  AB_LOOPING = 'AB_LOOPING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export enum PlaybackEvent {
  LOAD_SOURCE = 'LOAD_SOURCE',
  SOURCE_READY = 'SOURCE_READY',
  LOAD_FAILED = 'LOAD_FAILED',
  PLAY = 'PLAY',
  PAUSE = 'PAUSE',
  ENGAGE_AB_LOOP = 'ENGAGE_AB_LOOP',
  CLEAR_AB_LOOP = 'CLEAR_AB_LOOP',
  TRACK_ENDED = 'TRACK_ENDED',
  SEEK = 'SEEK',
  RESET = 'RESET',
}

export enum MasteryState {
  UNSTARTED = 'UNSTARTED',
  LISTENING = 'LISTENING',
  VOCAL_PRACTICE = 'VOCAL_PRACTICE',
  OFF_BOOK = 'OFF_BOOK',
  STAGE_READY = 'STAGE_READY',
}

export interface FSMTransitionLog {
  id: string;
  timestamp: string;
  machine: 'PLAYBACK_FSM' | 'MASTERY_FSM';
  fromState: string;
  event: string;
  toState: string;
  note: string;
}

export const PLAYBACK_STATE_META: Record<
  PlaybackState,
  { label: string; zhLabel: string; description: string; allowedEvents: PlaybackEvent[] }
> = {
  [PlaybackState.IDLE]: {
    label: 'IDLE',
    zhLabel: '待命未掛載',
    description: '尚未掛載音檔或合成器未啟動，等待選擇曲目音訊來源。',
    allowedEvents: [PlaybackEvent.LOAD_SOURCE, PlaybackEvent.SOURCE_READY],
  },
  [PlaybackState.LOADING]: {
    label: 'LOADING',
    zhLabel: '音訊載入中',
    description: '正在解碼本地音檔或緩衝遠端音軌，禁止播放與跳轉操作。',
    allowedEvents: [PlaybackEvent.SOURCE_READY, PlaybackEvent.LOAD_FAILED, PlaybackEvent.RESET],
  },
  [PlaybackState.READY]: {
    label: 'READY',
    zhLabel: '音軌就緒',
    description: '音檔或排練導唱引擎已就緒，可開始排練播放或跳轉 Cue 點。',
    allowedEvents: [PlaybackEvent.PLAY, PlaybackEvent.SEEK, PlaybackEvent.LOAD_SOURCE, PlaybackEvent.RESET],
  },
  [PlaybackState.PLAYING]: {
    label: 'PLAYING',
    zhLabel: '排練播放中',
    description: '正在播放曲目並同步掃描時間軸演繹 Cue 點與累計練習秒數。',
    allowedEvents: [
      PlaybackEvent.PAUSE,
      PlaybackEvent.ENGAGE_AB_LOOP,
      PlaybackEvent.SEEK,
      PlaybackEvent.TRACK_ENDED,
      PlaybackEvent.LOAD_SOURCE,
      PlaybackEvent.RESET,
    ],
  },
  [PlaybackState.PAUSED]: {
    label: 'PAUSED',
    zhLabel: '暫停筆記中',
    description: '排練暫停，可撰寫個人走位／發聲筆記或設定 A-B 循環段落。',
    allowedEvents: [
      PlaybackEvent.PLAY,
      PlaybackEvent.ENGAGE_AB_LOOP,
      PlaybackEvent.SEEK,
      PlaybackEvent.LOAD_SOURCE,
      PlaybackEvent.RESET,
    ],
  },
  [PlaybackState.AB_LOOPING]: {
    label: 'AB_LOOPING',
    zhLabel: 'A-B 段落精練循環',
    description: '鎖定在 A 點與 B 點區間內無限循環播放，專攻高音或複雜走位。',
    allowedEvents: [
      PlaybackEvent.CLEAR_AB_LOOP,
      PlaybackEvent.PAUSE,
      PlaybackEvent.SEEK,
      PlaybackEvent.LOAD_SOURCE,
      PlaybackEvent.RESET,
    ],
  },
  [PlaybackState.COMPLETED]: {
    label: 'COMPLETED',
    zhLabel: '單曲完聽打卡',
    description: '全曲排練完畢，自動累加完聽次數並觸發熟練度狀態機升階檢查。',
    allowedEvents: [PlaybackEvent.PLAY, PlaybackEvent.SEEK, PlaybackEvent.LOAD_SOURCE, PlaybackEvent.RESET],
  },
  [PlaybackState.ERROR]: {
    label: 'ERROR',
    zhLabel: '音訊來源異常',
    description: '音檔格式不支援或連結失效，可一鍵重置切換至內建排練節拍器。',
    allowedEvents: [PlaybackEvent.LOAD_SOURCE, PlaybackEvent.RESET],
  },
};

export function transitionPlaybackState(
  current: PlaybackState,
  event: PlaybackEvent
): { nextState: PlaybackState; valid: boolean; reason: string } {
  switch (current) {
    case PlaybackState.IDLE:
      if (event === PlaybackEvent.LOAD_SOURCE) {
        return { nextState: PlaybackState.LOADING, valid: true, reason: '開始載入曲目音檔' };
      }
      if (event === PlaybackEvent.SOURCE_READY) {
        return { nextState: PlaybackState.READY, valid: true, reason: '排練音訊引擎已就緒' };
      }
      break;

    case PlaybackState.LOADING:
      if (event === PlaybackEvent.SOURCE_READY) {
        return { nextState: PlaybackState.READY, valid: true, reason: '音檔緩衝與解碼完成' };
      }
      if (event === PlaybackEvent.LOAD_FAILED) {
        return { nextState: PlaybackState.ERROR, valid: true, reason: '音檔載入失敗，進入錯誤保護狀態' };
      }
      if (event === PlaybackEvent.RESET) {
        return { nextState: PlaybackState.IDLE, valid: true, reason: '重置播放器狀態機' };
      }
      break;

    case PlaybackState.READY:
      if (event === PlaybackEvent.PLAY) {
        return { nextState: PlaybackState.PLAYING, valid: true, reason: '啟動曲目排練播放' };
      }
      if (event === PlaybackEvent.SEEK) {
        return { nextState: PlaybackState.READY, valid: true, reason: '於就緒狀態預先定位 Cue 點' };
      }
      if (event === PlaybackEvent.LOAD_SOURCE) {
        return { nextState: PlaybackState.LOADING, valid: true, reason: '切換掛載新音檔' };
      }
      if (event === PlaybackEvent.RESET) {
        return { nextState: PlaybackState.IDLE, valid: true, reason: '卸載音訊回到待命' };
      }
      break;

    case PlaybackState.PLAYING:
      if (event === PlaybackEvent.PAUSE) {
        return { nextState: PlaybackState.PAUSED, valid: true, reason: '暫停播放以檢視演繹 Tips' };
      }
      if (event === PlaybackEvent.ENGAGE_AB_LOOP) {
        return { nextState: PlaybackState.AB_LOOPING, valid: true, reason: '鎖定 A-B 區間進入反覆精練狀態' };
      }
      if (event === PlaybackEvent.TRACK_ENDED) {
        return { nextState: PlaybackState.COMPLETED, valid: true, reason: '全曲播放完畢，自動記錄練習次數' };
      }
      if (event === PlaybackEvent.SEEK) {
        return { nextState: PlaybackState.PLAYING, valid: true, reason: '跳轉至指定演繹 Cue 點繼續播放' };
      }
      if (event === PlaybackEvent.LOAD_SOURCE) {
        return { nextState: PlaybackState.LOADING, valid: true, reason: '切換曲目重新載入音檔' };
      }
      if (event === PlaybackEvent.RESET) {
        return { nextState: PlaybackState.READY, valid: true, reason: '停止並回到曲目開頭' };
      }
      break;

    case PlaybackState.PAUSED:
      if (event === PlaybackEvent.PLAY) {
        return { nextState: PlaybackState.PLAYING, valid: true, reason: '恢復排練播放' };
      }
      if (event === PlaybackEvent.ENGAGE_AB_LOOP) {
        return { nextState: PlaybackState.AB_LOOPING, valid: true, reason: '由暫停狀態啟動 A-B 段落循環' };
      }
      if (event === PlaybackEvent.SEEK) {
        return { nextState: PlaybackState.PAUSED, valid: true, reason: '於暫停狀態移動時間軸' };
      }
      if (event === PlaybackEvent.LOAD_SOURCE) {
        return { nextState: PlaybackState.LOADING, valid: true, reason: '更換音檔來源' };
      }
      if (event === PlaybackEvent.RESET) {
        return { nextState: PlaybackState.READY, valid: true, reason: '歸零時間軸並回到就緒狀態' };
      }
      break;

    case PlaybackState.AB_LOOPING:
      if (event === PlaybackEvent.CLEAR_AB_LOOP) {
        return { nextState: PlaybackState.PLAYING, valid: true, reason: '解除 A-B 區間鎖定，恢復全曲播放' };
      }
      if (event === PlaybackEvent.PAUSE) {
        return { nextState: PlaybackState.PAUSED, valid: true, reason: '暫停 A-B 循環練習' };
      }
      if (event === PlaybackEvent.SEEK) {
        return { nextState: PlaybackState.AB_LOOPING, valid: true, reason: '在 A-B 循環區間內重新定位' };
      }
      if (event === PlaybackEvent.LOAD_SOURCE) {
        return { nextState: PlaybackState.LOADING, valid: true, reason: '載入新曲目音檔' };
      }
      if (event === PlaybackEvent.RESET) {
        return { nextState: PlaybackState.READY, valid: true, reason: '結束循環回到就緒狀態' };
      }
      break;

    case PlaybackState.COMPLETED:
      if (event === PlaybackEvent.PLAY) {
        return { nextState: PlaybackState.PLAYING, valid: true, reason: '從頭再次播放排練' };
      }
      if (event === PlaybackEvent.SEEK) {
        return { nextState: PlaybackState.PAUSED, valid: true, reason: '完聽後回頭檢視特定段落' };
      }
      if (event === PlaybackEvent.LOAD_SOURCE) {
        return { nextState: PlaybackState.LOADING, valid: true, reason: '切換下一首曲目音檔' };
      }
      if (event === PlaybackEvent.RESET) {
        return { nextState: PlaybackState.READY, valid: true, reason: '重置完聽狀態回到就緒' };
      }
      break;

    case PlaybackState.ERROR:
      if (event === PlaybackEvent.LOAD_SOURCE) {
        return { nextState: PlaybackState.LOADING, valid: true, reason: '重新嘗試掛載音檔' };
      }
      if (event === PlaybackEvent.RESET) {
        return { nextState: PlaybackState.READY, valid: true, reason: '切換回內建合成導唱節拍器' };
      }
      break;
  }

  return {
    nextState: current,
    valid: false,
    reason: `狀態機守衛阻擋：無法在 ${current} 狀態下執行 ${event}`,
  };
}

export const MASTERY_STATE_META: Record<
  MasteryState,
  {
    step: number;
    percent: number;
    zhLabel: string;
    shortLabel: string;
    criteria: string;
    nextState: MasteryState | null;
    prevState: MasteryState | null;
  }
> = {
  [MasteryState.UNSTARTED]: {
    step: 1,
    percent: 0,
    zhLabel: '01. 尚未開始 (0%)',
    shortLabel: '01. 尚未開始',
    criteria: '尚未聆聽此曲目。完整播放一次即可進入下一階段。',
    nextState: MasteryState.LISTENING,
    prevState: null,
  },
  [MasteryState.LISTENING]: {
    step: 2,
    percent: 25,
    zhLabel: '02. 確認進場拍點 (25%)',
    shortLabel: '02. 確認進場拍點',
    criteria: '已掌握自身角色的進場秒數與過門預備點。',
    nextState: MasteryState.VOCAL_PRACTICE,
    prevState: MasteryState.UNSTARTED,
  },
  [MasteryState.VOCAL_PRACTICE]: {
    step: 3,
    percent: 50,
    zhLabel: '03. 跟唱旋律順暢 (50%)',
    shortLabel: '03. 跟唱順暢',
    criteria: '配合純音樂或導唱音檔，能穩定跟唱負責段落。',
    nextState: MasteryState.OFF_BOOK,
    prevState: MasteryState.LISTENING,
  },
  [MasteryState.OFF_BOOK]: {
    step: 4,
    percent: 80,
    zhLabel: '04. 脫譜並熟悉走位 (80%)',
    shortLabel: '04. 脫譜與走位',
    criteria: '不看歌詞即可演唱，並清楚上下場翼口、隊形與道具配合。',
    nextState: MasteryState.STAGE_READY,
    prevState: MasteryState.VOCAL_PRACTICE,
  },
  [MasteryState.STAGE_READY]: {
    step: 5,
    percent: 100,
    zhLabel: '05. 整排驗收通過 (100%)',
    shortLabel: '05. 驗收通過',
    criteria: '導演與舞台監督確認達公演標準。',
    nextState: null,
    prevState: MasteryState.OFF_BOOK,
  },
};

export const MASTERY_ORDER: MasteryState[] = [
  MasteryState.UNSTARTED,
  MasteryState.LISTENING,
  MasteryState.VOCAL_PRACTICE,
  MasteryState.OFF_BOOK,
  MasteryState.STAGE_READY,
];

export function canTransitionMastery(
  current: MasteryState,
  target: MasteryState,
  isAdmin: boolean
): { allowed: boolean; reason: string } {
  if (current === target) {
    return { allowed: false, reason: '目前已處於該熟練度階段' };
  }
  // Terminal state lock enforcement matching Firestore rules
  if (current === MasteryState.STAGE_READY && !isAdmin) {
    return {
      allowed: false,
      reason: '此曲目已由導演或舞監標記為驗收通過，如需變更請由幹部操作。',
    };
  }
  return {
    allowed: true,
    reason: `熟練度階段由 ${MASTERY_STATE_META[current].shortLabel} 更新為 ${MASTERY_STATE_META[target].shortLabel}`,
  };
}
