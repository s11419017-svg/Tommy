# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Zero-PII Public Cast Roster (`/users/{userId}`)**:
   - No PII (`email`, `phone`, `address`) is ever permitted in `/users/{userId}`.
   - `userId` path parameter must match `^[a-zA-Z0-9_\-]+$` (`size <= 128`) and equal `incoming().uid` and `request.auth.uid`.
   - `sectionGroup` must belong to `['Principal Cast', 'Soprano / Alto', 'Tenor / Bass', 'Stage Direction']`.
2. **Track Integrity (`/tracks/{trackId}`)**:
   - Every track must have a valid `trackId` (`^[a-zA-Z0-9_\-]+$`, `size <= 64`), sequential `order` (`1 <= order <= 50`), valid `act` (`'Act I'` or `'Act II'`), and bounded strings for `dramaticContext`, `librettoSubtext`, `vocalTips`, `actingTips`, and `cueSummary` (`<= 2000` chars).
   - `updatedByUid` must equal `request.auth.uid`.
3. **Rehearsal Progress & Dual State Machine Invariant (`/rehearsalProgress/{progressId}`)**:
   - `progressId` must equal `incoming().userId + '_' + incoming().trackId`.
   - `masteryState` must strictly belong to `['UNSTARTED', 'LISTENING', 'VOCAL_PRACTICE', 'OFF_BOOK', 'STAGE_READY']`.
   - `lastPlaybackState` must strictly belong to `['IDLE', 'LOADING', 'READY', 'PLAYING', 'PAUSED', 'AB_LOOPING', 'COMPLETED', 'ERROR']`.
   - **Terminal State Lock**: Once `existing().masteryState == 'STAGE_READY'`, a non-admin student cannot downgrade or mutate the document; only `isAdmin()` can modify or unlock a `STAGE_READY` record.
   - **Relational Consistency**: Creating a `rehearsalProgress` document requires that the referenced `/tracks/$(incoming().trackId)` document exists (`exists()`).
4. **Temporal & Verified Identity Invariants**:
   - All writes require `request.auth != null && request.auth.token.email_verified == true`.
   - `createdAt` must equal `request.time` on `create` and remain immutable (`incoming().createdAt == existing().createdAt`) on `update`.
   - `updatedAt` must equal `request.time` on `create` and `update`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Shadow Field Injection on `/users/{userId}`)**: Includes all required fields plus `"isAdmin": true` ghost field. Rejected by `.keys().hasOnly(...)`.
2. **Payload 2 (Identity Spoofing on `/rehearsalProgress/{progressId}`)**: Authenticated user `user_A` attempts to create progress with `userId: "user_B"`. Rejected by `incoming().userId == request.auth.uid`.
3. **Payload 3 (Unverified Email Spoof Attack on Admin Action)**: Attacker presents token with `email == 's11419017@tcsh.hlc.edu.tw'` but `email_verified == false`. Rejected by `request.auth.token.email_verified == true`.
4. **Payload 4 (Path ID Poisoning on `/tracks/{trackId}`)**: Document ID contains illegal characters or >128 chars (`track/../evil`). Rejected by `isValidId(trackId)`.
5. **Payload 5 (Value Poisoning on `/rehearsalProgress/{progressId}` Update)**: Student updates `personalNotes` with a 50,000-character string. Rejected by `isValidRehearsalProgress(incoming())` enforcing `personalNotes.size() <= 1500`.
6. **Payload 6 (Terminal State Lock Bypass on `/rehearsalProgress/{progressId}`)**: Student attempts to update a record whose `existing().masteryState == 'STAGE_READY'`. Rejected by terminal state gate `existing().masteryState != 'STAGE_READY' || isAdmin()`.
7. **Payload 7 (Orphaned Progress Creation)**: Student creates `rehearsalProgress` pointing to a non-existent `trackId: "non_existent_99"`. Rejected by `exists(/databases/$(database)/documents/tracks/$(incoming().trackId))`.
8. **Payload 8 (Immortal Field Mutation)**: Student updates `rehearsalProgress` and changes `createdAt` or `userId`. Rejected by `incoming().createdAt == existing().createdAt && incoming().userId == existing().userId`.
9. **Payload 9 (Forged Client Timestamp)**: Client sends a future or past `updatedAt` timestamp instead of `request.time`. Rejected by `incoming().updatedAt == request.time`.
10. **Payload 10 (Invalid FSM State Injection)**: Client writes `masteryState: "HACKED_STATE"` or `lastPlaybackState: "INVALID"`. Rejected by enum checks in `isValidRehearsalProgress`.
11. **Payload 11 (Unauthorized Director Feedback Self-Write)**: Student attempts to modify `directorFeedback` on their own `rehearsalProgress` record during update. Rejected by action-based `affectedKeys().hasOnly(...)` which forbids non-admins from touching `directorFeedback`.
12. **Payload 12 (Unbounded Query Scraping on `/rehearsalProgress`)**: Client issues an unconstrained `list` query without filtering by `userId == request.auth.uid` or valid `trackOrder` range. Rejected by `allow list` evaluating `resource.data`.
