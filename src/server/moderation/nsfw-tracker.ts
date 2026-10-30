/**
 * Tracks NSFW flagged messages to prevent false positive bans.
 *
 * Rule:
 * Only trigger a ban for content flagged as sexual content if:
 * 1. The model's confidence exceeds 0.95 for NSFW (confidence > 0.95).
 * 2. AND the user's previous message (or one of their earlier messages
 *    in the last 5 minutes) was also flagged for NSFW at the same or higher
 *    level of confidence than the current flagged message.
 */

interface NsfwFlaggedEntry {
  timestamp: number;
  confidence: number;
  message: string;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// In-memory store: penguinId -> list of flagged entries
const nsfwHistory = new Map<number, NsfwFlaggedEntry[]>();

/**
 * Checks whether the user is eligible for an NSFW / sexual content ban.
 * Must be called BEFORE recording the current message.
 */
export function isEligibleForNsfwBan(penguinId: number, currentConfidence: number): boolean {
  // Model confidence must strictly exceed 0.95
  if (currentConfidence <= 0.95) {
    return false;
  }

  const now = Date.now();
  const entries = (nsfwHistory.get(penguinId) ?? []).filter(
    e => now - e.timestamp <= FIVE_MINUTES_MS
  );

  // Check if an earlier message within the last 5 minutes was flagged with >= confidence
  const hasQualifyingEarlierMessage = entries.some(e => e.confidence >= currentConfidence);
  return hasQualifyingEarlierMessage;
}

/**
 * Records a message that was flagged for NSFW / sexual content.
 */
export function recordNsfwMessage(penguinId: number, confidence: number, message: string): void {
  const now = Date.now();
  let entries = (nsfwHistory.get(penguinId) ?? []).filter(
    e => now - e.timestamp <= FIVE_MINUTES_MS
  );
  entries.push({ timestamp: now, confidence, message });
  nsfwHistory.set(penguinId, entries);
}

/**
 * Clears NSFW history for a user (e.g. after a ban is executed).
 */
export function clearNsfwHistory(penguinId: number): void {
  nsfwHistory.delete(penguinId);
}
