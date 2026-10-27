import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  BLUEPRINT_CONSTRAINTS,
  clampOptionalString,
  clampString,
  db,
  handleFirestoreError,
  OperationType,
  sanitizeId,
} from './firebase';
import {
  CAST_ROLES,
  INITIAL_LES_MIS_TRACKS,
  LesMisTrackItem,
  RehearsalCuePoint,
} from './data/lesMisTracks';
import {
  ActiveView,
  ProductionCallboard,
  ProgressRecord,
  TrackStemFiles,
  UserProfileDoc,
} from './types/rehearsal';
import {
  downloadAndCacheRemoteAudio,
  loadAllAudioFromVault,
  readAudioDuration,
  removeTrackAudioFromVault,
  resolveStreamableAudioUrl,
  saveAudioFileToVault,
} from './services/audioVault';
import { Header } from './components/layout/Header';
import { Callboard } from './components/layout/Callboard';
import { TrackSidebar } from './components/sidebar/TrackSidebar';
import { PortalView } from './components/views/PortalView';
import { RehearsalStudioView } from './components/views/RehearsalStudioView';
import { MasterCatalogView } from './components/views/MasterCatalogView';
import { SupervisionView } from './components/views/SupervisionView';
import { ProfileModal } from './components/modals/ProfileModal';
import { CallboardModal } from './components/modals/CallboardModal';
import {
  UnmatchedAudioModal,
  UnmatchedFileItem,
} from './components/modals/UnmatchedAudioModal';
import { matchAudioFileToTrack } from './services/audioMatcher';
import { parseLrcOrSrtToCues } from './utils/lyricsParser';
import { RehearsalCompanion } from './components/RehearsalCompanion';
import { MobileBottomNav } from './components/layout/MobileBottomNav';

const DEFAULT_CALLBOARD: ProductionCallboard = {
  dateIso: new Date().toISOString().slice(0, 10),
  directorNotice:
    '今日排練重點：Act I 序幕苦役犯進行曲與尚萬強獨白對峙走位。群演合唱請特別注意 76 BPM 沉重重拍切入點。',
  calledTrackIds: ['track_01', 'track_02', 'track_04'],
};

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<ActiveView>('portal');
  const [isCompanionOpen, setIsCompanionOpen] = useState<boolean>(false);

  // Banner Feedback System
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'warning';
    text: string;
  } | null>(null);

  const showBanner = (
    text: string,
    type: 'success' | 'warning' = 'success'
  ) => {
    setBannerMessage({ text, type });
  };

  useEffect(() => {
    if (!bannerMessage) return;
    const t = setTimeout(() => setBannerMessage(null), 4000);
    return () => clearTimeout(t);
  }, [bannerMessage]);

  // Track Catalog State
  const [tracks, setTracks] = useState<LesMisTrackItem[]>(() => {
    const saved = localStorage.getItem('lesmis_tracks_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // ignore
      }
    }
    return INITIAL_LES_MIS_TRACKS;
  });

  useEffect(() => {
    localStorage.setItem('lesmis_tracks_v3', JSON.stringify(tracks));
  }, [tracks]);

  const [selectedTrackId, setSelectedTrackId] = useState<string>(
    () => tracks[0]?.trackId || 'track_01'
  );

  const selectedTrack = useMemo(() => {
    return (
      tracks.find((t) => t.trackId === selectedTrackId) ||
      tracks[0] ||
      INITIAL_LES_MIS_TRACKS[0]
    );
  }, [tracks, selectedTrackId]);

  // Callboard State
  const [callboard, setCallboard] = useState<ProductionCallboard>(() => {
    const saved = localStorage.getItem('lesmis_callboard_v2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return DEFAULT_CALLBOARD;
  });

  useEffect(() => {
    localStorage.setItem('lesmis_callboard_v2', JSON.stringify(callboard));
  }, [callboard]);

  const calledTracks = useMemo(() => {
    return tracks.filter((t) => callboard.calledTrackIds.includes(t.trackId));
  }, [tracks, callboard.calledTrackIds]);

  const toggleTrackInTodayCall = (targetId: string) => {
    setCallboard((prev) => {
      const nextIds = prev.calledTrackIds.includes(targetId)
        ? prev.calledTrackIds.filter((id) => id !== targetId)
        : [...prev.calledTrackIds, targetId];
      return { ...prev, calledTrackIds: nextIds };
    });
  };

  // Persistent Audio Blobs & Stems (IndexedDB Audio Vault)
  const [localAudioBlobs, setLocalAudioBlobs] = useState<
    Record<string, { url: string; fileName: string }>
  >({});
  const [trackStemsMap, setTrackStemsMap] = useState<
    Record<string, TrackStemFiles>
  >({});

  // Restore audio vault on app mount
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  useEffect(() => {
    let cancelled = false;
    loadAllAudioFromVault().then((restored) => {
      if (cancelled) return;

      const mainBlobs = { ...restored.mainAudioBlobs };
      const stems = { ...restored.trackStemsMap };

      // Filename-based & URL-based cache hit matching
      tracksRef.current.forEach((t) => {
        if (!mainBlobs[t.trackId]) {
          // 1. Check if the remote audioUrl was already downloaded/cached in vault
          if (t.audioUrl && t.audioUrl.trim()) {
            const urlMatch = restored.byUrlMap[t.audioUrl.trim()];
            if (urlMatch) {
              mainBlobs[t.trackId] = {
                url: URL.createObjectURL(urlMatch.blob),
                fileName: urlMatch.fileName,
              };
              return;
            }
          }
          // 2. Check if audioLabel matches cached filename
          if (t.audioLabel && t.audioLabel.trim()) {
            const match =
              restored.byNameMap[`main::${t.audioLabel.trim().toLowerCase()}`];
            if (match) {
              mainBlobs[t.trackId] = {
                url: URL.createObjectURL(match.blob),
                fileName: match.fileName,
              };
            }
          }
        }
      });

      if (Object.keys(mainBlobs).length > 0) {
        setLocalAudioBlobs((prev) => ({ ...mainBlobs, ...prev }));
      }
      if (Object.keys(stems).length > 0) {
        setTrackStemsMap((prev) => ({ ...stems, ...prev }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Perspective & Filtering State
  const [isEnsembleMode, setIsEnsembleMode] = useState<boolean>(false);
  const [onlyMySongsFilter, setOnlyMySongsFilter] = useState<boolean>(false);
  const [onlyCalledTracksFilter, setOnlyCalledTracksFilter] =
    useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredTracks = useMemo(() => {
    return tracks.filter((t) => {
      if (onlyMySongsFilter) {
        const text =
          `${t.title} ${t.characters} ${t.dramaticContext}`.toLowerCase();
        const hasEnsemble =
          text.includes('ensemble') ||
          text.includes('合唱') ||
          text.includes('群演');
        if (isEnsembleMode && !hasEnsemble) return false;
      }
      if (
        onlyCalledTracksFilter &&
        callboard.calledTrackIds.length > 0 &&
        !callboard.calledTrackIds.includes(t.trackId)
      ) {
        return false;
      }
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.characters.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q)
      );
    });
  }, [
    tracks,
    onlyMySongsFilter,
    onlyCalledTracksFilter,
    callboard.calledTrackIds,
    isEnsembleMode,
    searchQuery,
  ]);

  // User Profile & Firebase Auth
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showCallboardModal, setShowCallboardModal] = useState<boolean>(false);

  const [userProfile, setUserProfile] = useState<UserProfileDoc>(() => {
    const saved = localStorage.getItem('lesmis_local_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      uid: 'local_actor',
      displayName: '劇組同學',
      characterRole: 'Ensemble Soprano / Alto (女高／女低合唱群)',
      sectionGroup: 'Soprano / Alto',
    };
  });

  const isDirectorAdmin = useMemo(() => {
    const emailMatch = currentUser?.email === 's11419017@tcsh.hlc.edu.tw';
    const roleMatch = userProfile.sectionGroup === 'Stage Direction';
    return Boolean(emailMatch || roleMatch);
  }, [currentUser, userProfile.sectionGroup]);

  // Rehearsal Progress State
  const [progressMap, setProgressMap] = useState<Record<string, ProgressRecord>>(
    () => {
      const saved = localStorage.getItem('lesmis_progress_v2');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
      return {};
    }
  );

  useEffect(() => {
    localStorage.setItem('lesmis_progress_v2', JSON.stringify(progressMap));
  }, [progressMap]);

  const [castRoster, setCastRoster] = useState<UserProfileDoc[]>([]);

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (user) {
        const cleanUid = sanitizeId(user.uid);
        const userRef = doc(db, 'users', cleanUid);
        try {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data() as UserProfileDoc;
            setUserProfile({
              uid: cleanUid,
              displayName: data.displayName || user.displayName || '劇組同學',
              characterRole: data.characterRole || CAST_ROLES[0].role,
              sectionGroup: data.sectionGroup || 'Principal Cast',
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${cleanUid}`);
        }
      }
    });
    return () => unsub();
  }, []);

  // Firestore Progress Sync
  useEffect(() => {
    if (!authReady || !currentUser) return;
    const progressQuery = query(collection(db, 'rehearsalProgress'));
    const unsub = onSnapshot(
      progressQuery,
      (snap) => {
        const nextMap: Record<string, ProgressRecord> = {};
        snap.forEach((dSnap) => {
          const d = dSnap.data();
          nextMap[dSnap.id] = {
            progressId: d.progressId || dSnap.id,
            userId: d.userId,
            userName: d.userName,
            characterRole: d.characterRole,
            trackId: d.trackId,
            trackTitle: d.trackTitle,
            masteryState: d.masteryState,
            practiceCount: Number(d.practiceCount) || 0,
            totalPracticeSeconds: Number(d.totalPracticeSeconds) || 0,
            personalNotes: d.personalNotes || '',
            directorFeedback: d.directorFeedback || '',
          };
        });
        setProgressMap((prev) => ({ ...prev, ...nextMap }));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'rehearsalProgress')
    );

    // Cast Roster Sync
    const usersQuery = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(
      usersQuery,
      (snap) => {
        const roster: UserProfileDoc[] = [];
        snap.forEach((dSnap) => {
          const d = dSnap.data();
          roster.push({
            uid: d.uid || dSnap.id,
            displayName: d.displayName || '劇組成員',
            characterRole: d.characterRole || '演員',
            sectionGroup: d.sectionGroup || 'Principal Cast',
          });
        });
        setCastRoster(roster);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    // 2026 Tracks Catalog Firestore Sync
    const tracksQuery = query(collection(db, 'tracks'));
    const unsubTracks = onSnapshot(
      tracksQuery,
      (snap) => {
        if (snap.empty) return;
        const firestoreTrackMap: Record<string, Partial<LesMisTrackItem>> = {};
        snap.forEach((dSnap) => {
          const d = dSnap.data();
          firestoreTrackMap[dSnap.id] = {
            trackId: dSnap.id,
            order: Number(d.order) || 1,
            act: d.act as 'Act I' | 'Act II',
            title: d.title,
            subtitle: d.subtitle,
            characters: d.characters,
            durationSec: Number(d.durationSec) || 180,
            bpm: Number(d.bpm) || 80,
            audioUrl: d.audioUrl || '',
            audioLabel: d.audioLabel || '',
            dramaticContext: d.dramaticContext,
            librettoSubtext: d.librettoSubtext,
            vocalTips: d.vocalTips,
            actingTips: d.actingTips,
            cueSummary: d.cueSummary,
          };
        });

        setTracks((prev) =>
          prev.map((t) => {
            const remote = firestoreTrackMap[t.trackId];
            if (!remote) return t;
            return {
              ...t,
              ...remote,
              // preserve local or LRC parsed cues
              cues: t.cues,
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tracks')
    );

    return () => {
      unsub();
      unsubUsers();
      unsubTracks();
    };
  }, [authReady, currentUser]);

  const activeUserId = currentUser
    ? sanitizeId(currentUser.uid)
    : userProfile.uid;
  const activeProgressId = `${activeUserId}_${selectedTrack.trackId}`;

  const currentTrackProgress: ProgressRecord = useMemo(() => {
    return (
      progressMap[activeProgressId] || {
        progressId: activeProgressId,
        userId: activeUserId,
        userName: userProfile.displayName,
        characterRole: isEnsembleMode
          ? '群演大隊 (Ensemble)'
          : userProfile.characterRole,
        trackId: selectedTrack.trackId,
        trackTitle: selectedTrack.title,
        masteryState: 'UNSTARTED' as const,
        practiceCount: 0,
        totalPracticeSeconds: 0,
        personalNotes: '',
        directorFeedback: '',
      }
    );
  }, [
    progressMap,
    activeProgressId,
    activeUserId,
    userProfile.displayName,
    userProfile.characterRole,
    isEnsembleMode,
    selectedTrack.trackId,
    selectedTrack.title,
  ]);

  const handleUpdateTrackProgress = async (data: Partial<ProgressRecord>) => {
    const updated: ProgressRecord = {
      ...currentTrackProgress,
      ...data,
      updatedAtIso: new Date().toISOString(),
    };
    setProgressMap((prev) => ({ ...prev, [activeProgressId]: updated }));

    if (currentUser) {
      const cleanProgressId = sanitizeId(activeProgressId);
      const docRef = doc(db, 'rehearsalProgress', cleanProgressId);
      try {
        const existingSnap = await getDoc(docRef);
        if (!existingSnap.exists()) {
          // Document does not exist yet: create complete initial record strictly matching rules
          await setDoc(docRef, {
            progressId: cleanProgressId,
            userId: sanitizeId(activeUserId),
            userName: clampString(
              userProfile.displayName || currentUser.displayName || '劇組同學',
              100
            ),
            characterRole: clampString(
              userProfile.characterRole || 'Principal Cast',
              80
            ),
            trackId: sanitizeId(selectedTrack.trackId),
            trackOrder: Number(selectedTrack.order) || 1,
            trackTitle: clampString(selectedTrack.title, 150),
            masteryState:
              data.masteryState ||
              currentTrackProgress.masteryState ||
              'UNSTARTED',
            lastPlaybackState:
              data.lastPlaybackState ||
              currentTrackProgress.lastPlaybackState ||
              'IDLE',
            practiceCount:
              typeof data.practiceCount === 'number'
                ? data.practiceCount
                : currentTrackProgress.practiceCount || 0,
            totalPracticeSeconds:
              typeof data.totalPracticeSeconds === 'number'
                ? data.totalPracticeSeconds
                : currentTrackProgress.totalPracticeSeconds || 0,
            personalNotes: clampOptionalString(
              data.personalNotes ?? currentTrackProgress.personalNotes,
              1500
            ),
            directorFeedback: clampOptionalString(
              data.directorFeedback ?? currentTrackProgress.directorFeedback,
              1500
            ),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Document exists: update ONLY the modified permitted fields
          const updatePayload: Record<string, unknown> = {
            updatedAt: serverTimestamp(),
          };
          if (data.masteryState !== undefined)
            updatePayload.masteryState = data.masteryState;
          if (data.lastPlaybackState !== undefined)
            updatePayload.lastPlaybackState = data.lastPlaybackState;
          if (data.practiceCount !== undefined)
            updatePayload.practiceCount = data.practiceCount;
          if (data.totalPracticeSeconds !== undefined)
            updatePayload.totalPracticeSeconds = data.totalPracticeSeconds;
          if (data.personalNotes !== undefined)
            updatePayload.personalNotes = clampOptionalString(
              data.personalNotes,
              1500
            );
          if (data.userName !== undefined)
            updatePayload.userName = clampString(data.userName, 100);
          if (data.characterRole !== undefined)
            updatePayload.characterRole = clampString(data.characterRole, 80);
          if (data.trackTitle !== undefined)
            updatePayload.trackTitle = clampString(data.trackTitle, 150);
          if (isDirectorAdmin && data.directorFeedback !== undefined) {
            updatePayload.directorFeedback = clampOptionalString(
              data.directorFeedback,
              1500
            );
          }
          await setDoc(docRef, updatePayload, { merge: true });
        }
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `rehearsalProgress/${activeProgressId}`
        );
      }
    }
  };

  // Active Audio Source calculation
  const activeAudioSource = useMemo(() => {
    const local = localAudioBlobs[selectedTrack.trackId];
    if (local?.url) {
      return {
        type: 'LOCAL_FILE' as const,
        url: local.url,
        label: local.fileName,
      };
    }
    if (selectedTrack.audioUrl && selectedTrack.audioUrl.trim().length > 0) {
      return {
        type: 'REMOTE_URL' as const,
        url: resolveStreamableAudioUrl(selectedTrack.audioUrl.trim()),
        label: selectedTrack.audioLabel || '雲端音檔',
      };
    }
    return {
      type: 'SILENT_TIMELINE' as const,
      url: '',
      label: `尚未掛載音檔 (${selectedTrack.bpm} BPM 時間軸)`,
    };
  }, [localAudioBlobs, selectedTrack]);

  // Audio Upload & Management Handlers
  const handleUploadSingleFile = async (
    targetTrackId: string,
    file: File | null
  ) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const dur = await readAudioDuration(objectUrl);

    await saveAudioFileToVault(targetTrackId, 'main', file, file.name);

    setLocalAudioBlobs((prev) => ({
      ...prev,
      [targetTrackId]: { url: objectUrl, fileName: file.name },
    }));

    setTracks((prev) =>
      prev.map((t) =>
        t.trackId === targetTrackId
          ? {
              ...t,
              durationSec: dur > 0 ? dur : t.durationSec,
              audioLabel: file.name,
            }
          : t
      )
    );
    showBanner(`已永久儲存並載入主音檔「${file.name}」。`);
  };

  const handleUpdateTrackStem = async (
    targetTrackId: string,
    stemType: 'backing' | 'vocal' | 'drumBass',
    file: File | null
  ) => {
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    await saveAudioFileToVault(targetTrackId, stemType, file, file.name);

    setTrackStemsMap((prev) => {
      const cur = prev[targetTrackId] || {};
      if (stemType === 'backing') {
        return {
          ...prev,
          [targetTrackId]: { ...cur, backingUrl: objUrl, backingName: file.name },
        };
      }
      if (stemType === 'vocal') {
        return {
          ...prev,
          [targetTrackId]: { ...cur, vocalUrl: objUrl, vocalName: file.name },
        };
      }
      return {
        ...prev,
        [targetTrackId]: {
          ...cur,
          drumBassUrl: objUrl,
          drumBassName: file.name,
        },
      };
    });
    showBanner(`已儲存伴奏分軌：「${file.name}」。`);
  };

  const handleRemoveTrackAudio = async (
    targetTrackId: string,
    slot: 'main' | 'backing' | 'vocal' | 'drumBass' | 'all' = 'main'
  ) => {
    if (slot === 'main' || slot === 'all') {
      const existingMain = localAudioBlobs[targetTrackId];
      await removeTrackAudioFromVault(
        targetTrackId,
        slot === 'all' ? undefined : 'main',
        existingMain?.fileName
      );
      setLocalAudioBlobs((prev) => {
        const next = { ...prev };
        delete next[targetTrackId];
        return next;
      });
    }

    if (
      slot === 'backing' ||
      slot === 'vocal' ||
      slot === 'drumBass' ||
      slot === 'all'
    ) {
      const existingStems = trackStemsMap[targetTrackId];
      const stemFileName =
        slot === 'backing'
          ? existingStems?.backingName
          : slot === 'vocal'
          ? existingStems?.vocalName
          : slot === 'drumBass'
          ? existingStems?.drumBassName
          : undefined;

      if (slot !== 'all') {
        await removeTrackAudioFromVault(targetTrackId, slot, stemFileName);
      }

      setTrackStemsMap((prev) => {
        const cur = { ...(prev[targetTrackId] || {}) };
        if (slot === 'backing' || slot === 'all') {
          delete cur.backingUrl;
          delete cur.backingName;
        }
        if (slot === 'vocal' || slot === 'all') {
          delete cur.vocalUrl;
          delete cur.vocalName;
        }
        if (slot === 'drumBass' || slot === 'all') {
          delete cur.drumBassUrl;
          delete cur.drumBassName;
        }
        return { ...prev, [targetTrackId]: cur };
      });
    }

    showBanner('已從本機金庫移除該音檔。');
  };

  const handleTogglePureInstrumentalFlag = (targetTrackId: string) => {
    setTrackStemsMap((prev) => {
      const cur = prev[targetTrackId] || {};
      const nextFlag = !cur.isPureInstrumentalTrack;
      showBanner(
        nextFlag
          ? '已將此音檔標記為純音樂伴奏版（啟用進場前 3 秒倒數提示）。'
          : '已恢復標記為有人聲導唱版。'
      );
      return {
        ...prev,
        [targetTrackId]: {
          ...cur,
          isPureInstrumentalTrack: nextFlag,
        },
      };
    });
  };

  const handleImportLrcForTrack = async (
    targetTrackId: string,
    file: File | null
  ) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseLrcOrSrtToCues(text, file.name);
      if (parsed.length === 0) {
        showBanner('未在檔案中偵測到字幕時間軸標記。', 'warning');
        return;
      }
      setTracks((prev) =>
        prev.map((t) =>
          t.trackId === targetTrackId ? { ...t, cues: parsed } : t
        )
      );
      showBanner(`已匯入「${file.name}」，解析 ${parsed.length} 個段落。`);
    } catch {
      showBanner('讀取字幕檔失敗。', 'warning');
    }
  };

  const handleUpdateTrackCues = (
    nextCues: RehearsalCuePoint[],
    detectedDur?: number
  ) => {
    setTracks((prev) =>
      prev.map((t) =>
        t.trackId === selectedTrack.trackId
          ? {
              ...t,
              durationSec:
                detectedDur && detectedDur > 0 ? detectedDur : t.durationSec,
              cues: nextCues,
            }
          : t
      )
    );
  };

  const [isSyncingToCloud, setIsSyncingToCloud] = useState<boolean>(false);
  const [cachingTrackIds, setCachingTrackIds] = useState<Record<string, boolean>>({});

  const handleUpdateTrackData = async (updated: LesMisTrackItem) => {
    setTracks((prev) =>
      prev.map((t) => (t.trackId === updated.trackId ? updated : t))
    );
    showBanner(`已更新曲目「${updated.title}」設定。`);

    if (currentUser) {
      const cleanTrackId = sanitizeId(updated.trackId);
      const trackRef = doc(db, 'tracks', cleanTrackId);
      try {
        const snap = await getDoc(trackRef);
        const payloadBase = {
          trackId: cleanTrackId,
          order: Number(updated.order) || 1,
          act: updated.act === 'Act II' ? ('Act II' as const) : ('Act I' as const),
          title: clampString(updated.title, 150),
          subtitle: clampString(updated.subtitle || updated.title, 150),
          characters: clampString(updated.characters || 'Cast', 200),
          durationSec: Math.max(1, Math.min(7200, Number(updated.durationSec) || 180)),
          bpm: Math.max(30, Math.min(240, Number(updated.bpm) || 80)),
          audioUrl: clampOptionalString(updated.audioUrl || '', 1000),
          audioLabel: clampOptionalString(updated.audioLabel || '', 150),
          dramaticContext: clampString(updated.dramaticContext || '戲劇情境與時代背景', 2000),
          librettoSubtext: clampString(updated.librettoSubtext || '潛台詞與情緒目標', 2000),
          vocalTips: clampString(updated.vocalTips || '演唱重點提示', 2000),
          actingTips: clampString(updated.actingTips || '走位與肢體指引', 2000),
          cueSummary: clampString(updated.cueSummary || '排練分段總結', 2000),
          updatedByUid: sanitizeId(currentUser.uid),
          updatedAt: serverTimestamp(),
        };

        if (!snap.exists()) {
          await setDoc(trackRef, {
            ...payloadBase,
            createdAt: serverTimestamp(),
          });
        } else {
          const existingData = snap.data();
          await setDoc(trackRef, {
            ...payloadBase,
            createdAt: existingData.createdAt || serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `tracks/${cleanTrackId}`);
      }
    }
  };

  const handleSyncAllTracksToCloud = async () => {
    if (!currentUser) {
      showBanner('請先登入 Google 帳號以進行全劇雲端同步。', 'warning');
      return;
    }
    setIsSyncingToCloud(true);
    showBanner('正在將全劇 21 首曲目與雲端設定同步至 Firestore...');
    try {
      let count = 0;
      for (const t of tracks) {
        const cleanTrackId = sanitizeId(t.trackId);
        const trackRef = doc(db, 'tracks', cleanTrackId);
        const snap = await getDoc(trackRef);
        const payloadBase = {
          trackId: cleanTrackId,
          order: Number(t.order) || 1,
          act: t.act === 'Act II' ? ('Act II' as const) : ('Act I' as const),
          title: clampString(t.title, 150),
          subtitle: clampString(t.subtitle || t.title, 150),
          characters: clampString(t.characters || 'Cast', 200),
          durationSec: Math.max(1, Math.min(7200, Number(t.durationSec) || 180)),
          bpm: Math.max(30, Math.min(240, Number(t.bpm) || 80)),
          audioUrl: clampOptionalString(t.audioUrl || '', 1000),
          audioLabel: clampOptionalString(t.audioLabel || '', 150),
          dramaticContext: clampString(t.dramaticContext || '戲劇情境與時代背景', 2000),
          librettoSubtext: clampString(t.librettoSubtext || '潛台詞與情緒目標', 2000),
          vocalTips: clampString(t.vocalTips || '演唱重點提示', 2000),
          actingTips: clampString(t.actingTips || '走位與肢體指引', 2000),
          cueSummary: clampString(t.cueSummary || '排練分段總結', 2000),
          updatedByUid: sanitizeId(currentUser.uid),
          updatedAt: serverTimestamp(),
        };

        if (!snap.exists()) {
          await setDoc(trackRef, {
            ...payloadBase,
            createdAt: serverTimestamp(),
          });
        } else {
          const existingData = snap.data();
          await setDoc(trackRef, {
            ...payloadBase,
            createdAt: existingData.createdAt || serverTimestamp(),
          });
        }
        count++;
      }
      showBanner(`全劇 ${count} 首曲目設定已成功同步至雲端！其他裝置開啟即可取得最新資料。`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tracks/batchSync');
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  const handleCacheRemoteTrack = async (
    targetTrackId: string,
    remoteUrl: string,
    label?: string
  ) => {
    if (!remoteUrl || cachingTrackIds[targetTrackId]) return;
    setCachingTrackIds((prev) => ({ ...prev, [targetTrackId]: true }));
    showBanner('正在由雲端下載音檔至本機金庫，請稍候...');
    try {
      const res = await downloadAndCacheRemoteAudio(
        targetTrackId,
        'main',
        remoteUrl,
        label
      );
      setLocalAudioBlobs((prev) => ({
        ...prev,
        [targetTrackId]: { url: res.url, fileName: res.fileName },
      }));
      showBanner(`「${label || '雲端音檔'}」已成功快取至本機金庫！離線練習免耗流量。`);
    } catch (err) {
      console.error(err);
      showBanner(
        '快取失敗：請確認該雲端網址支援跨域存取，或由本機直接拖入檔案。',
        'warning'
      );
    } finally {
      setCachingTrackIds((prev) => ({ ...prev, [targetTrackId]: false }));
    }
  };

  const [unmatchedFiles, setUnmatchedFiles] = useState<UnmatchedFileItem[]>([]);
  const [showUnmatchedModal, setShowUnmatchedModal] = useState<boolean>(false);

  const handleBatchFilesImport = async (fileList: FileList | File[] | null) => {
    if (!fileList) return;
    const files = Array.from(fileList);
    const audioFiles = files.filter(
      (f) =>
        (f.type && f.type.startsWith('audio/')) ||
        /\.(mp3|wav|m4a|aac|ogg|flac|opus|m4b|weba|webm|caf|aiff?|wma)$/i.test(f.name)
    );

    if (audioFiles.length === 0) {
      showBanner('所選檔案中未找到支援的音訊格式（MP3 / WAV / M4A / AAC 等）。', 'warning');
      return;
    }

    // Single-file direct mount optimization: If 1 file selected, directly attach to matched track or currently active track
    if (audioFiles.length === 1) {
      const file = audioFiles[0];
      const matched = matchAudioFileToTrack(file.name, tracks);
      const targetTrackId = matched ? matched.trackId : selectedTrack.trackId;
      const targetTrack =
        tracks.find((t) => t.trackId === targetTrackId) || selectedTrack;
      await handleUploadSingleFile(targetTrackId, file);
      showBanner(
        `已成功載入「${file.name}」至「${targetTrack.title}」，並寫入本機永久金庫！`
      );
      return;
    }

    let loadedCount = 0;
    const remainingUnmatched: UnmatchedFileItem[] = [];

    for (const file of audioFiles) {
      const matched = matchAudioFileToTrack(file.name, tracks);
      if (matched) {
        await handleUploadSingleFile(matched.trackId, file);
        loadedCount++;
      } else {
        remainingUnmatched.push({
          id: `${file.name}_${Date.now()}_${Math.random()}`,
          file,
          objectUrl: URL.createObjectURL(file),
        });
      }
    }

    if (loadedCount > 0 && remainingUnmatched.length === 0) {
      showBanner(`全數成功！已智慧比對並載入全部 ${loadedCount} 首曲目音檔至本機金庫。`);
    } else if (loadedCount > 0 && remainingUnmatched.length > 0) {
      showBanner(`已自動配對掛載 ${loadedCount} 首曲目；尚有 ${remainingUnmatched.length} 個音檔待指派對照。`);
      setUnmatchedFiles((prev) => [...prev, ...remainingUnmatched]);
      setShowUnmatchedModal(true);
    } else {
      showBanner(`已偵測到 ${remainingUnmatched.length} 個音檔，請由彈窗快速指派對應曲目。`);
      setUnmatchedFiles(remainingUnmatched);
      setShowUnmatchedModal(true);
    }
  };

  const handleBatchFolderImport = handleBatchFilesImport;

  const handleAssignUnmatchedFile = async (trackId: string, file: File) => {
    await handleUploadSingleFile(trackId, file);
    setUnmatchedFiles((prev) => {
      const next = prev.filter((item) => item.file !== file);
      if (next.length === 0) {
        setShowUnmatchedModal(false);
      }
      return next;
    });
    showBanner(`已將「${file.name}」成功掛載至曲目！`);
  };

  const handleAssignAllSequentially = async (startOrder = 1) => {
    let order = startOrder;
    for (const item of unmatchedFiles) {
      const target = tracks.find((t) => t.order === order) || tracks[order - 1];
      if (target) {
        await handleUploadSingleFile(target.trackId, item.file);
        order++;
      }
    }
    setUnmatchedFiles([]);
    setShowUnmatchedModal(false);
    showBanner(`已依序將音檔全數指派掛載完畢！`);
  };

  const handleExportProductionConfig = () => {
    const payload = {
      version: '2026.2',
      exportedAt: new Date().toISOString(),
      callboard,
      tracks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LesMis_ProductionConfig_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showBanner('已匯出劇組排練設定檔 (.json)。');
  };

  const handleImportProductionConfig = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.tracks)) setTracks(parsed.tracks);
      if (parsed.callboard) setCallboard(parsed.callboard);
      showBanner(`已成功匯入設定檔「${file.name}」。`);
    } catch {
      showBanner('設定檔格式不正確。', 'warning');
    }
  };

  const handleSaveProfile = async (p: UserProfileDoc) => {
    setUserProfile(p);
    localStorage.setItem('lesmis_local_profile', JSON.stringify(p));
    if (currentUser) {
      const cleanUid = sanitizeId(currentUser.uid);
      try {
        const userRef = doc(db, 'users', cleanUid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: cleanUid,
            displayName: clampString(p.displayName, 100),
            characterRole: clampString(p.characterRole, 80),
            sectionGroup: p.sectionGroup,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(
            userRef,
            {
              displayName: clampString(p.displayName, 100),
              characterRole: clampString(p.characterRole, 80),
              sectionGroup: p.sectionGroup,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${cleanUid}`);
      }
    }
    showBanner('已儲存演員身分與聲部設定。');
  };

  const handleUpdateFeedback = async (pid: string, feedback: string) => {
    setProgressMap((prev) => ({
      ...prev,
      [pid]: { ...prev[pid], directorFeedback: feedback },
    }));
    if (currentUser && isDirectorAdmin) {
      try {
        const cleanPid = sanitizeId(pid);
        const docRef = doc(db, 'rehearsalProgress', cleanPid);
        await setDoc(
          docRef,
          {
            directorFeedback: clampOptionalString(feedback, 1500),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `rehearsalProgress/${pid}`);
      }
    }
    showBanner('已更新導演評語。');
  };

  // Google Sign In & Sign Out
  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showBanner('Google 帳號登入成功，排練進度已啟用雲端同步。');
    } catch (err) {
      console.warn('Login error:', err);
      showBanner('登入未完成。', 'warning');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    showBanner('已安全登出。');
  };

  const [autoAdvanceNextTrack, setAutoAdvanceNextTrack] = useState(false);

  return (
    <div
      className={`min-h-screen ${
        darkMode ? 'theme-dark' : 'theme-light'
      } bg-[var(--bg-canvas)] text-[var(--text-primary)] transition-colors duration-200`}
    >
      {/* Toast Feedback Alert */}
      {bannerMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-ui-fade-in">
          <div
            className={`px-4 py-2.5 shadow-xl border text-xs font-medium flex items-center gap-2 ${
              bannerMessage.type === 'warning'
                ? 'bg-amber-950/90 border-amber-600 text-amber-200'
                : 'bg-[var(--bg-elevated)] border-[var(--accent-gold)] text-[var(--text-primary)]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                bannerMessage.type === 'warning'
                  ? 'bg-amber-400'
                  : 'bg-[var(--status-ready)]'
              }`}
            />
            <span>{bannerMessage.text}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <Header
        activeView={activeView}
        setActiveView={setActiveView}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        currentUser={currentUser}
        userProfile={userProfile}
        onOpenProfileModal={() => setShowProfileModal(true)}
        onSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
        audioCount={Object.keys(localAudioBlobs).length}
        totalTracks={tracks.length}
        calledTracksCount={callboard.calledTrackIds.length}
        onOpenCompanion={() => setIsCompanionOpen(true)}
      />

      {/* Callboard Strip (displayed on sub-pages; PortalView has its own hero callboard) */}
      {activeView !== 'portal' && (
        <Callboard
          callboard={callboard}
          calledTracks={calledTracks}
          selectedTrackId={selectedTrack.trackId}
          onSelectTrack={(id) => {
            setSelectedTrackId(id);
            setActiveView('rehearsal');
          }}
          onOpenCallboardEditor={() => setShowCallboardModal(true)}
          isDirectorAdmin={isDirectorAdmin}
        />
      )}

      {/* Main Views */}
      <main className="w-full pb-16 lg:pb-0">
        {activeView === 'portal' && (
          <PortalView
            tracks={tracks}
            callboard={callboard}
            calledTracks={calledTracks}
            userProfile={userProfile}
            currentUser={currentUser}
            localAudioBlobs={localAudioBlobs}
            progressMap={progressMap}
            onSelectTrackAndEnterStudio={(id) => {
              setSelectedTrackId(id);
              setActiveView('rehearsal');
            }}
            onNavigateView={(view) => setActiveView(view)}
            onOpenCallboardEditor={() => setShowCallboardModal(true)}
            isDirectorAdmin={isDirectorAdmin}
            onOpenCompanion={() => setIsCompanionOpen(true)}
          />
        )}

        {activeView === 'rehearsal' && (
          <div className="max-w-[1760px] 2xl:max-w-[1920px] mx-auto flex flex-col lg:flex-row min-h-[calc(100vh-90px)]">
            <TrackSidebar
              tracks={tracks}
              filteredTracks={filteredTracks}
              selectedTrackId={selectedTrack.trackId}
              onSelectTrack={setSelectedTrackId}
              isEnsembleMode={isEnsembleMode}
              onToggleEnsembleMode={setIsEnsembleMode}
              onlyMySongsFilter={onlyMySongsFilter}
              setOnlyMySongsFilter={setOnlyMySongsFilter}
              onlyCalledTracksFilter={onlyCalledTracksFilter}
              setOnlyCalledTracksFilter={setOnlyCalledTracksFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              localAudioBlobs={localAudioBlobs}
              progressMap={progressMap}
              calledTrackIds={callboard.calledTrackIds}
            />

            <RehearsalStudioView
              selectedTrack={selectedTrack}
              activeAudioSource={activeAudioSource}
              trackStemsMap={trackStemsMap}
              isEnsembleMode={isEnsembleMode}
              darkMode={darkMode}
              userProfile={userProfile}
              isDirectorAdmin={isDirectorAdmin}
              currentTrackProgress={currentTrackProgress}
              onUpdateTrackProgress={handleUpdateTrackProgress}
              onUpdateTrackCues={handleUpdateTrackCues}
              onUploadSingleFile={(f) =>
                handleUploadSingleFile(selectedTrack.trackId, f)
              }
              onUpdateTrackStem={handleUpdateTrackStem}
              onRemoveTrackAudio={handleRemoveTrackAudio}
              onTogglePureInstrumentalFlag={() =>
                handleTogglePureInstrumentalFlag(selectedTrack.trackId)
              }
              onToggleTrackInTodayCall={toggleTrackInTodayCall}
              isCalledInTodayCall={callboard.calledTrackIds.includes(
                selectedTrack.trackId
              )}
              onShowBanner={showBanner}
              autoAdvanceNextTrack={autoAdvanceNextTrack}
              onToggleAutoAdvance={() => setAutoAdvanceNextTrack((p) => !p)}
              onTrackCompleted={() => {
                showBanner('單曲播放完畢，已自動記錄排練時數。');
              }}
              onCacheRemoteTrack={handleCacheRemoteTrack}
              isCachingRemoteTrack={Boolean(cachingTrackIds[selectedTrack.trackId])}
            />
          </div>
        )}

        {activeView === 'tracks' && (
          <MasterCatalogView
            tracks={tracks}
            localAudioBlobs={localAudioBlobs}
            trackStemsMap={trackStemsMap}
            onSelectTrack={setSelectedTrackId}
            onGoToRehearsal={(id) => {
              setSelectedTrackId(id);
              setActiveView('rehearsal');
            }}
            onUploadSingleFile={handleUploadSingleFile}
            onUpdateTrackStem={handleUpdateTrackStem}
            onRemoveTrackAudio={handleRemoveTrackAudio}
            onImportLrcForTrack={handleImportLrcForTrack}
            onUpdateTrackData={handleUpdateTrackData}
            onBatchFolderImport={handleBatchFolderImport}
            onBatchFilesImport={handleBatchFilesImport}
            onExportProductionConfig={handleExportProductionConfig}
            onImportProductionConfig={handleImportProductionConfig}
            toggleTrackInTodayCall={toggleTrackInTodayCall}
            calledTrackIds={callboard.calledTrackIds}
            onCacheRemoteTrack={handleCacheRemoteTrack}
            cachingTrackIds={cachingTrackIds}
            onSyncAllTracksToCloud={handleSyncAllTracksToCloud}
            isSyncingToCloud={isSyncingToCloud}
            isSignedIn={Boolean(currentUser)}
          />
        )}

        {activeView === 'supervision' && (
          <SupervisionView
            tracks={tracks}
            progressMap={progressMap}
            castRoster={castRoster}
            currentUser={currentUser}
            isDirectorAdmin={isDirectorAdmin}
            onUpdateFeedback={handleUpdateFeedback}
            onSelectTrackForRehearsal={(id) => {
              setSelectedTrackId(id);
              setActiveView('rehearsal');
            }}
          />
        )}
      </main>

      {/* Modals */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={currentUser}
        userProfile={userProfile}
        onSaveProfile={handleSaveProfile}
      />

      <CallboardModal
        isOpen={showCallboardModal}
        onClose={() => setShowCallboardModal(false)}
        callboard={callboard}
        tracks={tracks}
        onSaveCallboard={(cb) => {
          setCallboard(cb);
          showBanner('已發布更新今日通告。');
        }}
      />

      <UnmatchedAudioModal
        isOpen={showUnmatchedModal}
        onClose={() => setShowUnmatchedModal(false)}
        unmatchedFiles={unmatchedFiles}
        tracks={tracks}
        onAssignFileToTrack={handleAssignUnmatchedFile}
        onAssignAllSequentially={handleAssignAllSequentially}
      />

      {/* Mobile Bottom Navigation Bar (< lg screens) */}
      <MobileBottomNav
        activeView={activeView}
        setActiveView={setActiveView}
        calledTracksCount={callboard.calledTrackIds.length}
      />

      {/* Unified Non-Obstructive Rehearsal Companion & Guilt-Trip Drawer */}
      <RehearsalCompanion
        tracks={tracks}
        calledTrackIds={callboard.calledTrackIds}
        progressMap={progressMap}
        currentUserId={currentUser ? currentUser.uid : userProfile.uid}
        selectedTrackTitle={selectedTrack.title}
        onSelectTrackAndRehearse={(trackId) => {
          setSelectedTrackId(trackId);
          setActiveView('rehearsal');
        }}
        onShowBanner={showBanner}
        isOpenExternal={isCompanionOpen}
        onCloseExternal={() => setIsCompanionOpen(false)}
      />
    </div>
  );
}

export default App;
