/**
 * Audio Vault Service (IndexedDB Persistent Storage)
 * 
 * Solves the critical bug where uploaded MP3/WAV/M4A rehearsal files
 * get lost or corrupted into synthetic oscillator tones upon page reload or code updates.
 *
 * Guarantees that:
 * 1. Audio blobs are permanently retained in IndexedDB.
 * 2. Object URLs are cached and managed safely without mid-playback revocation.
 * 3. Filename-based secondary index allows instant recovery even if trackIds change.
 */

const AUDIO_DB_NAME = 'lesmis_audio_vault_v1';
const AUDIO_STORE_NAME = 'audio_files';

export type AudioSlot = 'main' | 'backing' | 'vocal' | 'drumBass';

export interface StoredAudioRecord {
  key: string;
  trackId: string;
  slot: AudioSlot;
  fileName: string;
  mimeType: string;
  blob: Blob;
  updatedAt: number;
}

export interface RestoredAudioVaultState {
  mainAudioBlobs: Record<string, { url: string; fileName: string }>;
  trackStemsMap: Record<
    string,
    {
      backingUrl?: string;
      backingName?: string;
      vocalUrl?: string;
      vocalName?: string;
      drumBassUrl?: string;
      drumBassName?: string;
    }
  >;
  byNameMap: Record<string, { blob: Blob; fileName: string; slot: AudioSlot }>;
  byUrlMap: Record<string, { blob: Blob; fileName: string; slot: AudioSlot; trackId: string }>;
}

function openAudioVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported in current environment'));
      return;
    }
    const req = indexedDB.open(AUDIO_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const dbInstance = req.result;
      if (!dbInstance.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        dbInstance.createObjectStore(AUDIO_STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// In-memory cache of created Object URLs so we don't recreate hundreds of URLs
const objectUrlCache = new Map<string, string>();

function getOrCreateObjectUrl(cacheKey: string, blob: Blob): string {
  const existing = objectUrlCache.get(cacheKey);
  if (existing) {
    return existing;
  }
  const url = URL.createObjectURL(blob);
  objectUrlCache.set(cacheKey, url);
  return url;
}

export function isAudioCachedInVault(trackId: string, slot: AudioSlot = 'main'): boolean {
  return objectUrlCache.has(`${slot}::${trackId}`);
}

export async function saveAudioFileToVault(
  trackId: string,
  slot: AudioSlot,
  file: File | Blob,
  fileName: string,
  sourceUrl?: string
): Promise<void> {
  try {
    const dbInstance = await openAudioVaultDb();
    const tx = dbInstance.transaction(AUDIO_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE_NAME);

    const primaryKey = `${slot}::${trackId}`;
    const record: StoredAudioRecord = {
      key: primaryKey,
      trackId,
      slot,
      fileName,
      mimeType: file.type || 'audio/mpeg',
      blob: file,
      updatedAt: Date.now(),
    };
    store.put(record);

    // Keep an in-memory cache update
    getOrCreateObjectUrl(primaryKey, file);

    // Also persist by-name fallback
    if (fileName && fileName.trim()) {
      const cleanName = fileName.trim().toLowerCase();
      const byNameKey = `byname::${slot}::${cleanName}`;
      const byNameRecord: StoredAudioRecord = {
        key: byNameKey,
        trackId,
        slot,
        fileName,
        mimeType: file.type || 'audio/mpeg',
        blob: file,
        updatedAt: Date.now(),
      };
      store.put(byNameRecord);
      getOrCreateObjectUrl(byNameKey, file);
    }

    // Also persist by-url fallback if caching a remote audio stream
    if (sourceUrl && sourceUrl.trim()) {
      const cleanUrl = sourceUrl.trim();
      const byUrlKey = `byurl::${slot}::${cleanUrl}`;
      const byUrlRecord: StoredAudioRecord = {
        key: byUrlKey,
        trackId,
        slot,
        fileName,
        mimeType: file.type || 'audio/mpeg',
        blob: file,
        updatedAt: Date.now(),
      };
      store.put(byUrlRecord);
      getOrCreateObjectUrl(byUrlKey, file);
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => {
        dbInstance.close();
        resolve();
      };
      tx.onerror = () => {
        dbInstance.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.warn('Audio vault save warning:', err);
  }
}

export async function loadAllAudioFromVault(): Promise<RestoredAudioVaultState> {
  const result: RestoredAudioVaultState = {
    mainAudioBlobs: {},
    trackStemsMap: {},
    byNameMap: {},
    byUrlMap: {},
  };

  try {
    const dbInstance = await openAudioVaultDb();
    const tx = dbInstance.transaction(AUDIO_STORE_NAME, 'readonly');
    const store = tx.objectStore(AUDIO_STORE_NAME);
    const req = store.getAll();

    const records = await new Promise<StoredAudioRecord[]>((resolve, reject) => {
      req.onsuccess = () => resolve((req.result as StoredAudioRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
    dbInstance.close();

    for (const rec of records) {
      if (!rec.blob) continue;

      if (rec.key.startsWith('byname::')) {
        const cleanName = rec.fileName.trim().toLowerCase();
        result.byNameMap[`${rec.slot}::${cleanName}`] = {
          blob: rec.blob,
          fileName: rec.fileName,
          slot: rec.slot,
        };
        continue;
      }

      if (rec.key.startsWith('byurl::')) {
        const rawUrl = rec.key.replace(/^byurl::(main|backing|vocal|drumBass)::/, '');
        result.byUrlMap[rawUrl] = {
          blob: rec.blob,
          fileName: rec.fileName,
          slot: rec.slot,
          trackId: rec.trackId,
        };
        continue;
      }

      const cacheKey = `${rec.slot}::${rec.trackId}`;
      const objUrl = getOrCreateObjectUrl(cacheKey, rec.blob);

      if (rec.slot === 'main') {
        result.mainAudioBlobs[rec.trackId] = {
          url: objUrl,
          fileName: rec.fileName,
        };
      } else if (rec.slot === 'backing') {
        result.trackStemsMap[rec.trackId] = {
          ...(result.trackStemsMap[rec.trackId] || {}),
          backingUrl: objUrl,
          backingName: rec.fileName,
        };
      } else if (rec.slot === 'vocal') {
        result.trackStemsMap[rec.trackId] = {
          ...(result.trackStemsMap[rec.trackId] || {}),
          vocalUrl: objUrl,
          vocalName: rec.fileName,
        };
      } else if (rec.slot === 'drumBass') {
        result.trackStemsMap[rec.trackId] = {
          ...(result.trackStemsMap[rec.trackId] || {}),
          drumBassUrl: objUrl,
          drumBassName: rec.fileName,
        };
      }
    }

    return result;
  } catch (err) {
    console.warn('Could not load audio vault records:', err);
    return result;
  }
}

export async function removeTrackAudioFromVault(
  trackId: string,
  targetSlot?: AudioSlot,
  fileNameToClear?: string
): Promise<void> {
  try {
    const dbInstance = await openAudioVaultDb();
    const tx = dbInstance.transaction(AUDIO_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE_NAME);
    const slotsToRemove: AudioSlot[] = targetSlot
      ? [targetSlot]
      : ['main', 'backing', 'vocal', 'drumBass'];

    slotsToRemove.forEach((slot) => {
      const key = `${slot}::${trackId}`;
      store.delete(key);
      const cachedUrl = objectUrlCache.get(key);
      if (cachedUrl) {
        URL.revokeObjectURL(cachedUrl);
        objectUrlCache.delete(key);
      }
      if (fileNameToClear && fileNameToClear.trim()) {
        const byNameKey = `byname::${slot}::${fileNameToClear.trim().toLowerCase()}`;
        store.delete(byNameKey);
        const cachedByNameUrl = objectUrlCache.get(byNameKey);
        if (cachedByNameUrl) {
          URL.revokeObjectURL(cachedByNameUrl);
          objectUrlCache.delete(byNameKey);
        }
      }
    });

    await new Promise<void>((resolve) => {
      tx.oncomplete = () => {
        dbInstance.close();
        resolve();
      };
      tx.onerror = () => {
        dbInstance.close();
        resolve();
      };
    });
  } catch {
    // ignore
  }
}

export function resolveStreamableAudioUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  
  // Google Drive link conversion
  const gDriveMatch1 = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gDriveMatch1 && gDriveMatch1[1]) {
    return `https://drive.google.com/uc?export=download&id=${gDriveMatch1[1]}`;
  }
  const gDriveMatch2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (trimmed.includes('drive.google.com') && gDriveMatch2 && gDriveMatch2[1]) {
    return `https://drive.google.com/uc?export=download&id=${gDriveMatch2[1]}`;
  }

  // Dropbox link conversion (dl=0 -> raw=1 for direct audio stream)
  if (trimmed.includes('dropbox.com')) {
    if (trimmed.includes('dl=0')) {
      return trimmed.replace('dl=0', 'raw=1');
    }
    if (!trimmed.includes('raw=1') && !trimmed.includes('dl=1')) {
      const sep = trimmed.includes('?') ? '&' : '?';
      return `${trimmed}${sep}raw=1`;
    }
  }

  return trimmed;
}

export async function downloadAndCacheRemoteAudio(
  trackId: string,
  slot: AudioSlot,
  remoteUrl: string,
  preferredName?: string
): Promise<{ url: string; fileName: string; durationSec: number }> {
  const resolvedUrl = resolveStreamableAudioUrl(remoteUrl);
  const resp = await fetch(resolvedUrl);
  if (!resp.ok) {
    throw new Error(`雲端音檔下載失敗 (HTTP ${resp.status})`);
  }
  const blob = await resp.blob();
  const inferredName =
    preferredName ||
    remoteUrl.split('/').pop()?.split('?')[0] ||
    `${trackId}_${slot}.mp3`;

  await saveAudioFileToVault(trackId, slot, blob, inferredName, remoteUrl);
  const localUrl = URL.createObjectURL(blob);
  const durationSec = await readAudioDuration(localUrl);

  return {
    url: localUrl,
    fileName: inferredName,
    durationSec,
  };
}

export function readAudioDuration(objectUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const tempAudio = new Audio();
    tempAudio.preload = 'metadata';
    let resolved = false;

    const cleanup = () => {
      tempAudio.onloadedmetadata = null;
      tempAudio.onerror = null;
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(180);
      }
    }, 1500);

    tempAudio.onloadedmetadata = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        const dur =
          Number.isFinite(tempAudio.duration) && tempAudio.duration > 0
            ? Math.round(tempAudio.duration)
            : 180;
        cleanup();
        resolve(dur);
      }
    };
    tempAudio.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve(180);
      }
    };
    tempAudio.src = objectUrl;
  });
}


