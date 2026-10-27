/**
 * Firestore Security Rules Test Suite (Dirty Dozen Verification)
 * Verifies that all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Shadow Field Injection on /users/{userId}',
    collection: '/users/student_1',
    operation: 'create',
    auth: { uid: 'student_1', email: 'student1@school.edu.tw', email_verified: true },
    payload: {
      uid: 'student_1',
      displayName: 'Jean Valjean Actor',
      characterRole: 'Jean Valjean',
      sectionGroup: 'Principal Cast',
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Identity Spoofing on /rehearsalProgress/{progressId}',
    collection: '/rehearsalProgress/student_2_track_01',
    operation: 'create',
    auth: { uid: 'student_1', email: 'student1@school.edu.tw', email_verified: true },
    payload: {
      progressId: 'student_2_track_01',
      userId: 'student_2',
      trackId: 'track_01',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Spoof Attack on Admin Action',
    collection: '/tracks/track_01',
    operation: 'delete',
    auth: { uid: 'spoof_uid', email: 's11419017@tcsh.hlc.edu.tw', email_verified: false },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Path ID Poisoning on /tracks/{trackId}',
    collection: '/tracks/invalid$id!with@symbols',
    operation: 'create',
    auth: { uid: 'director_1', email: 's11419017@tcsh.hlc.edu.tw', email_verified: true },
    payload: { trackId: 'invalid$id!with@symbols' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Value Poisoning Oversized String on /rehearsalProgress/{progressId}',
    collection: '/rehearsalProgress/student_1_track_01',
    operation: 'update',
    auth: { uid: 'student_1', email: 'student1@school.edu.tw', email_verified: true },
    payload: {
      personalNotes: 'A'.repeat(5000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Terminal State Lock Bypass on STAGE_READY Progress',
    collection: '/rehearsalProgress/student_1_track_01',
    operation: 'update',
    auth: { uid: 'student_1', email: 'student1@school.edu.tw', email_verified: true },
    payload: {
      masteryState: 'LISTENING',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Progress Creation for Non-Existent Track',
    collection: '/rehearsalProgress/student_1_ghost_track',
    operation: 'create',
    auth: { uid: 'student_1', email: 'student1@school.edu.tw', email_verified: true },
    payload: {
      progressId: 'student_1_ghost_track',
      userId: 'student_1',
      trackId: 'ghost_track',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immortal Field Mutation (createdAt / userId)',
    collection: '/rehearsalProgress/student_1_track_01',
    operation: 'update',
    auth: { uid: 'student_1', email: 'student1@school.edu.tw', email_verified: true },
    payload: {
      userId: 'student_99',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Forged Client Timestamp on Update',
    collection: '/users/student_1',
    operation: 'update',
    auth: { uid: 'student_1', email: 'student1@school.edu.tw', email_verified: true },
    payload: {
      displayName: 'Updated Name',
      updatedAt: '2099-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid FSM State Injection',
    collection: '/rehearsalProgress/student_1_track_01',
    operation: 'create',
    auth: { uid: 'student_1', email: 'student1@school.edu.tw', email_verified: true },
    payload: {
      masteryState: 'BYPASSED_FSM',
      lastPlaybackState: 'HACKED_PLAYER',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unauthorized Director Feedback Self-Write by Student',
    collection: '/rehearsalProgress/student_1_track_01',
    operation: 'update',
    auth: { uid: 'student_1', email: 'student1@school.edu.tw', email_verified: true },
    payload: {
      directorFeedback: 'Self-approved by student!',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthenticated List Query Scraping',
    collection: '/rehearsalProgress',
    operation: 'list',
    auth: null,
    expectedResult: 'PERMISSION_DENIED',
  },
];
