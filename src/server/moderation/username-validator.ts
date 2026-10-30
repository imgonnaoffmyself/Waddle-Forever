import { checkProfanity, checkPII } from "./filter";
import { classifyLocally } from "./localmod";

export interface UsernameValidationResult {
  valid: boolean;
  isInappropriate: boolean;
  reason?: 'length' | 'format' | 'inappropriate' | 'reserved';
  message?: string;
  matchedWord?: string;
}

// Staff / Developer reserved names
export const RESERVED_USERNAMES = new Set([
  'rsnail',
  'screenhog',
  'billybob',
  'gizmo',
  'happy77',
  'lochness',
  'polofield',
  'daffo',
  'spike hike',
  'bus driver'
]);

export const RESERVED_PREFIXES_OR_SUBSTRINGS: RegExp[] = [
  /\badmin\w*/i,
  /\bmoderator\w*/i,
  /^mod_/i,
  /\bclubpenguin\b/i,
  /\bdisney\b/i
];

// PII pattern check for usernames (URLs, IPs, phone numbers, emails)
const USERNAME_PII_PATTERNS: RegExp[] = [
  /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|gg|tv|me|co|uk|ca|au|de|ru|fr)\b)/i,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  /\b\d{7,16}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
];

// Explicit name-level inappropriate patterns (matches across spacing, leetspeak, numbers)
export const INAPPROPRIATE_NAME_PATTERNS: RegExp[] = [
  // Profanities
  /\bf+u+c+k+\w*/i,
  /\bs+h+i+t+\w*/i,
  /\bb+i+t+c+h+\w*/i,
  /\bc+u+n+t+\w*/i,
  /\ba+s+s+h+o+l+e+\w*/i,
  /\bb+a+s+t+a+r+d+\w*/i,
  /\bw+h+o+r+e+\w*/i,
  /\bs+l+u+t+\w*/i,
  /\bp+o+r+n+\w*/i,
  /\bd+i+l+d+o+\w*/i,

  // NSFW & Genitals & Sexual Acts
  /\bd+i+c+k+\w*/i,
  /\bc+o+c+k+\w*/i,
  /\bp+u+s+s+y+\w*/i,
  /\bp+e+n+i+s+\w*/i,
  /\bv+a+g+i+n+a+\w*/i,
  /\bb+o+o+b+s?\b/i,
  /\bt+i+t+s?\b/i,
  /\ba+n+u+s+\b/i,
  /\ba+n+a+l+\b/i,
  /\br+e+c+t+u+m+\b/i,
  /\bn+u+t+s+a+c+k+\w*/i,
  /\bs+u+c+k+\w*/i,
  /\bl+i+c+k+(?:nuts|balls|dick|cock|pussy|ass|me|my)?/i,
  /\be+a+t+(?:out|meout|ass)\w*/i,
  /\bb+l+o+w+j+o+b+\w*/i,
  /\bh+a+n+d+j+o+b+\w*/i,
  /\bm+a+s+t+u+r+b+a+t+\w*/i,
  /\bj+e+r+k+o+f+f+\w*/i,
  /\bw+a+n+k+\w*/i,
  /\bc+u+m+\w*/i,
  /\bh+o+r+n+y+\w*/i,
  /\bo+r+g+a+s+m+\w*/i,
  /\bs+e+x+\w*/i,

  // Hate Speech & Slurs
  /(?<!ac|c)c+o+o+n+s?\w*/i,
  /n+i+g+g+[ea]r?\w*/i,
  /\bc+h+i+n+k+s?\w*/i,
  /\bk+i+k+e+s?\w*/i,
  /\bs+p+i+c+s?\w*/i,
  /\bg+o+o+k+s?\w*/i,
  /\bw+e+t+b+a+c+k+s?\w*/i,
  /f+a+g+g+o+t+\w*/i,
  /\bf+a+g+s?\b/i,
  /\bt+r+a+n+n+y+\w*/i,
  /\bs+h+e+m+a+l+e+\w*/i,
  /r+e+t+a+r+d+\w*/i,
  /\bn+a+z+i+\w*/i,
  /\bh+i+t+l+e+r+\w*/i,
  /\bk+k+k+\b/i,
  /\bwhitepower\b/i,
  /\bmoonman\w*/i,
  /ihate(?:coons?|blacks?|jews?|gays?|fags?|trans|mexicans?|asians?)/i,

  // Predatory / Child Exploitation
  /\bp+e+d+o+\w*/i,
  /\bp+a+e+d+o+\w*/i,
  /\bp+e+d+o+p+h+i+l+e+\w*/i,
  /(?:i)?t+o+u+c+h+k+i+d+s?\w*/i,
  /e+p+s+t+e+i+n+s?\w*/i,
  /\bm+o+l+e+s+t+\w*/i,

  // Self Harm
  /\bk+y+s+\w*/i,
  /\bs+u+i+c+i+d+e+\w*/i
];

/**
 * Normalizes username variations to detect evasions (spaces, dots, leetspeak, repeated letters).
 */
function normalizeForCheck(text: string): { collapsed: string; dense: string; leet: string } {
  const lower = text.toLowerCase();
  const collapsed = lower.replace(/\s+/g, ' ').trim();
  const dense = lower.replace(/[^a-z0-9]/g, '');
  const leet = dense
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[8]/g, 'b')
    .replace(/vv/g, 'w');
  return { collapsed, dense, leet };
}

/**
 * Validates a Club Penguin username according to authentic rules:
 * - Length: 3 to 12 characters
 * - Characters: Letters (A-Z, a-z), numbers (0-9), and single spaces between words
 * - Disallowed: Leading/trailing spaces, consecutive spaces, purely numeric usernames
 * - Rejects & flags inappropriate names (profanity, sexual content, hate speech, predation, PII)
 * - Rejects reserved staff/system names
 */
export function validateUsername(rawName: string): UsernameValidationResult {
  if (typeof rawName !== 'string') {
    return {
      valid: false,
      isInappropriate: false,
      reason: 'format',
      message: 'Username must be a valid string.'
    };
  }

  // 1. Length check (Club Penguin strictly required 3 to 12 characters)
  if (rawName.length < 3 || rawName.length > 12) {
    return {
      valid: false,
      isInappropriate: false,
      reason: 'length',
      message: 'Please choose a username between 3 and 12 characters.'
    };
  }

  // 2. Whitespace check (no leading/trailing spaces, no consecutive spaces)
  if (rawName !== rawName.trim()) {
    return {
      valid: false,
      isInappropriate: false,
      reason: 'format',
      message: 'Username cannot have leading or trailing spaces.'
    };
  }

  if (/\s{2,}/.test(rawName)) {
    return {
      valid: false,
      isInappropriate: false,
      reason: 'format',
      message: 'Username cannot have consecutive spaces.'
    };
  }

  // 3. Allowed characters check: only A-Z, a-z, 0-9, and spaces
  if (!/^[a-zA-Z0-9 ]+$/.test(rawName)) {
    return {
      valid: false,
      isInappropriate: false,
      reason: 'format',
      message: 'Username can only contain letters, numbers, and spaces.'
    };
  }

  // 4. Purely numeric check (authentic Club Penguin rule: names cannot be all numbers)
  if (/^\d+$/.test(rawName.replace(/\s+/g, ''))) {
    return {
      valid: false,
      isInappropriate: false,
      reason: 'format',
      message: 'Username cannot be only numbers.'
    };
  }

  const { collapsed, dense, leet } = normalizeForCheck(rawName);

  // 5. Check reserved staff/system usernames
  if (RESERVED_USERNAMES.has(collapsed)) {
    return {
      valid: false,
      isInappropriate: false,
      reason: 'reserved',
      message: 'That name is reserved. Please choose another name.'
    };
  }

  for (const prefixPat of RESERVED_PREFIXES_OR_SUBSTRINGS) {
    if (prefixPat.test(rawName) || prefixPat.test(dense)) {
      return {
        valid: false,
        isInappropriate: false,
        reason: 'reserved',
        message: 'That name contains reserved words. Please choose another name.'
      };
    }
  }

  // 6. Check explicit inappropriate name patterns
  for (const pat of INAPPROPRIATE_NAME_PATTERNS) {
    const m = rawName.match(pat) || dense.match(pat) || leet.match(pat);
    if (m) {
      return {
        valid: false,
        isInappropriate: true,
        reason: 'inappropriate',
        matchedWord: m[0],
        message: 'That name is not allowed. Please choose another name.'
      };
    }
  }

  // 7. Check profanity filter
  const profanity = checkProfanity(rawName);
  if (profanity.isSwear) {
    return {
      valid: false,
      isInappropriate: true,
      reason: 'inappropriate',
      matchedWord: profanity.matchedWord ?? rawName,
      message: 'That name is not allowed. Please choose another name.'
    };
  }

  const profDense = checkProfanity(dense);
  if (profDense.isSwear) {
    return {
      valid: false,
      isInappropriate: true,
      reason: 'inappropriate',
      matchedWord: profDense.matchedWord ?? dense,
      message: 'That name is not allowed. Please choose another name.'
    };
  }

  // 8. Check local moderation classifier
  const modEval = classifyLocally(rawName);
  if (modEval.flagged && (modEval.severity >= 0.70 || modEval.category === 'nsfw' || modEval.category === 'predatory' || modEval.category === 'toxicity')) {
    return {
      valid: false,
      isInappropriate: true,
      reason: 'inappropriate',
      matchedWord: modEval.reason,
      message: 'That name is not allowed. Please choose another name.'
    };
  }

  // 9. Check PII solicitation (URLs, IPs, phone numbers, emails)
  for (const piiPat of USERNAME_PII_PATTERNS) {
    if (piiPat.test(rawName) || piiPat.test(dense)) {
      return {
        valid: false,
        isInappropriate: true,
        reason: 'inappropriate',
        matchedWord: 'personal_info_or_link',
        message: 'That name is not allowed. Please choose another name.'
      };
    }
  }

  return {
    valid: true,
    isInappropriate: false
  };
}
