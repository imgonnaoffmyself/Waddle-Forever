import { PenguinJson } from "@server/database/database";

// Classic autoban words and profanities
const BLACKLISTED_PATTERNS: RegExp[] = [
  /\bf+u+c+k+\w*/i,
  /\bs+h+i+t+\w*/i,
  /\bb+i+t+c+h+\w*/i,
  /\ba+s+s+h+o+l+e+\w*/i,
  /\bb+a+s+t+a+r+d+\w*/i,
  /\bd+i+c+k+\w*/i,
  /\bc+u+n+t+\w*/i,
  /\bp+u+s+s+y+\w*/i,
  /\bw+h+o+r+e+\w*/i,
  /\bs+l+u+t+\w*/i,
  /\bn+i+g+g+e+r+\w*/i,
  /\bn+i+g+g+a+\w*/i,
  /\bf+a+g+g+o+t+\w*/i,
  /\bf+a+g+\b/i,
  /\bc+o+c+k+\b/i,
  /\bp+e+n+i+s+\b/i,
  /\bv+a+g+i+n+a+\b/i,
  /\bp+o+r+n+\w*/i,
  /\bs+e+x+\b/i,
  /\bd+i+l+d+o+\w*/i
];

/**
 * Checks whether a chat message contains a prohibited swear word.
 */
export function checkProfanity(text: string): { isSwear: boolean; matchedWord?: string } {
  // Normalize simple leetspeak substitutions
  const normalized = text
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't');

  for (const pattern of BLACKLISTED_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      return { isSwear: true, matchedWord: match[0] };
    }
  }

  return { isSwear: false };
}

/**
 * Checks whether a penguin is currently banned and returns remaining hours.
 */
export function getBanStatus(penguin: PenguinJson, now: number = Date.now()): {
  banned: boolean;
  remainingHours: number;
  reason?: string;
} {
  if (penguin.banned_until !== null && penguin.banned_until !== undefined && penguin.banned_until > now) {
    const diffMs = penguin.banned_until - now;
    const remainingHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    return {
      banned: true,
      remainingHours,
      reason: penguin.ban_reason
    };
  }

  return {
    banned: false,
    remainingHours: 0
  };
}
