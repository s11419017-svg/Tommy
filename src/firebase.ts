import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  initializeFirestore,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence internal @firebase/firestore transient WebChannel retry console.error logs
setLogLevel('silent');

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const BOOTSTRAPPED_DIRECTOR_EMAIL = 's11419017@tcsh.hlc.edu.tw';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  // Gracefully ignore transient network/offline errors since localStorage + IndexedDB fallback is active
  if (
    errorCode === 'unavailable' ||
    errorCode === 'failed-precondition' ||
    rawMessage.includes('unavailable') ||
    rawMessage.includes('client is offline') ||
    rawMessage.includes('Could not reach Cloud Firestore backend')
  ) {
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: rawMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Sync Notice:', JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot when online
async function testConnection() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.warn('Firestore operating in offline local mode.');
    }
  }
}
testConnection();

// Blueprint Validation Constants & Defensive Sanitization Helpers (Verbatim from firestore.rules)
export const BLUEPRINT_CONSTRAINTS = {
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  MAX_ID_LENGTH: 128,
  MAX_TRACK_ID_LENGTH: 64,
  MAX_DISPLAY_NAME: 100,
  MAX_CHARACTER_ROLE: 80,
  MAX_SECTION_GROUP: 50,
  MAX_TITLE: 150,
  MAX_TRACK_TITLE: 150,
  MAX_SUBTITLE: 150,
  MAX_CHARACTERS_LIST: 200,
  MAX_CHARACTERS: 200,
  MAX_AUDIO_URL: 1000,
  MAX_AUDIO_LABEL: 150,
  MAX_ANALYSIS_TEXT: 2000,
  MAX_DRAMATIC_CONTEXT: 2000,
  MAX_LIBRETTO_SUBTEXT: 2000,
  MAX_TIPS_TEXT: 2000,
  MAX_CUE_SUMMARY: 2000,
  MAX_NOTES_TEXT: 1500,
  ALLOWED_SECTIONS: [
    'Principal Cast',
    'Soprano / Alto',
    'Tenor / Bass',
    'Stage Direction',
  ] as const,
  ALLOWED_ACTS: ['Act I', 'Act II'] as const,
};

export function sanitizeId(
  rawId: string,
  maxLen = BLUEPRINT_CONSTRAINTS.MAX_ID_LENGTH
): string {
  const cleaned = (rawId || '')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : 'default_id';
}

export function clampString(
  val: string | undefined | null,
  maxLen: number,
  fallback = '-'
): string {
  const trimmed = (val || '').trim();
  if (trimmed.length === 0) return fallback;
  return trimmed.slice(0, maxLen);
}

export function clampOptionalString(
  val: string | undefined | null,
  maxLen: number
): string {
  return (val || '').trim().slice(0, maxLen);
}

// ============================================================================
// PERSISTENT INDEXEDDB AUDIO VAULT (防止更新或重整後已上傳音檔遺失或變成合成音訊)
// Stores actual binary File/Blob objects in browser IndexedDB so uploaded
// rehearsal MP3/WAV/M4A/FLAC files and backing stems survive HMR, code updates,
// and page reloads permanently.
// ============================================================================

const AUDIO_DB_NAME = 'lesmis_audio_vault_v1';
const AUDIO_STORE_NAME = 'audio_files';

export interface StoredAudioRecord {
  key: string; // e.g. "main::track_01" or "stem::track_01::backing" or "file::Look Down.mp3"
  trackId: string;
  slot: 'main' | 'backing' | 'vocal' | 'drumBass';
  fileName: string;
  mimeType: string;
  blob: Blob;
  updatedAt: number;
}

function openAudioVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
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

export async function saveAudioFileToVault(
  trackId: string,
  slot: 'main' | 'backing' | 'vocal' | 'drumBass',
  file: File | Blob,
  fileName: string
): Promise<void> {
  try {
    const dbInstance = await openAudioVaultDb();
    const tx = dbInstance.transaction(AUDIO_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE_NAME);

    const record: StoredAudioRecord = {
      key: `${slot}::${trackId}`,
      trackId,
      slot,
      fileName,
      mimeType: file.type || 'audio/mpeg',
      blob: file,
      updatedAt: Date.now(),
    };
    store.put(record);

    // Also save a filename-keyed backup so even if trackId changes on re-import,
    // any track with the same audioLabel / fileName automatically recovers its audio!
    if (fileName) {
      const byNameRecord: StoredAudioRecord = {
        key: `byname::${slot}::${fileName.trim().toLowerCase()}`,
        trackId,
        slot,
        fileName,
        mimeType: file.type || 'audio/mpeg',
        blob: file,
        updatedAt: Date.now(),
      };
      store.put(byNameRecord);
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
    console.warn('IndexedDB audio save skipped:', err);
  }
}

export async function loadAllAudioFromVault(): Promise<StoredAudioRecord[]> {
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
    return records;
  } catch {
    return [];
  }
}

export async function removeTrackAudioFromVault(trackId: string): Promise<void> {
  try {
    const dbInstance = await openAudioVaultDb();
    const tx = dbInstance.transaction(AUDIO_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AUDIO_STORE_NAME);
    (['main', 'backing', 'vocal', 'drumBass'] as const).forEach((slot) => {
      store.delete(`${slot}::${trackId}`);
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
