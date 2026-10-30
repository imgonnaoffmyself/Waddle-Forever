import { PenguinJson } from "@server/database/database";
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers
} from 'obscenity';
import { OpenRedaction } from '@openredaction/openredaction';

// Initialize obscenity matcher with English dataset and recommended transformers
const obscenityDataset = englishDataset.build();
const obscenityMatcher = new RegExpMatcher({
  ...obscenityDataset,
  ...englishRecommendedTransformers
});

// Additional explicit words and patterns for Club Penguin autoban
const EXPLICIT_AUTOBAN_PATTERNS: RegExp[] = [
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
  /\bd+i+l+d+o+\w*/i,
  /\bk+y+s+\b/i,
  /\bkill\s*your\s*self\b/i
];

// Initialize OpenRedaction for general PII detection
const openRedaction = new OpenRedaction();

// Authentic Club Penguin PII patterns (silently blocked / shadow-filtered)
const CP_PII_PATTERNS: RegExp[] = [
  // URLs, websites, and domain names (.com, .org, .net, etc.)
  /(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|gg|tv|me|co|uk|ca|au|de|ru|fr)\b)/i,
  // IPv4 addresses
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  // Phone numbers (US/Intl standard formats or 7-15 contiguous/spaced digits)
  /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{7,16}\b/,
  // Spelled-out phone numbers or disguised numbers
  /(?:call|text|phone|number)[\s\w:]*(?:zero|one|two|three|four|five|six|seven|eight|nine)/i,
  // Soliciting personal identity / contact / address
  /(?:what(?:'s|\s+is)\s+your\s+(?:real\s+name|phone|number|address|snap|instagram|discord|insta|snapchat)|where\s+do\s+you\s+live|how\s+old\s+are\s+you|what\s+city\s+do\s+you\s+live\s+in)/i,
  // Social media platforms and external handles
  /\b(?:discord|snapchat|skype|instagram|facebook|twitter|tiktok|myspace)\s*(?:tag|user|username|id|handle|me|at|:|\.gg)?\b/i,
  // Sharing real identity or contact info
  /(?:my\s+(?:real\s+name|phone\s+number|address|email|snap|insta|instagram|discord)\s+is)\b/i
];

/**
 * Normalizes separated single characters like "f u c k" or "s.h.i.t" into "fuck" / "shit".
 */
function collapseSpacedLetters(text: string): string {
  return text.replace(/(?:^|\s)((?:[a-zA-Z][\s._\-*~]+)+[a-zA-Z])(?:\s|$)/g, (_m, g) => {
    return ' ' + g.replace(/[\s._\-*~]+/g, '') + ' ';
  });
}

/**
 * Checks whether a chat message contains explicit profanity, hate speech, or NSFW content.
 * Triggering this results in an immediate 24-hour autoban.
 */
export function checkProfanity(text: string): { isSwear: boolean; matchedWord?: string } {
  // 1. Direct obscenity matcher check
  if (obscenityMatcher.hasMatch(text)) {
    const matches = obscenityMatcher.getAllMatches(text);
    const firstMatch = matches[0];
    const matchedWord = firstMatch
      ? text.slice(firstMatch.startIndex, firstMatch.endIndex + 1)
      : text;
    return { isSwear: true, matchedWord };
  }

  // 2. Spacing evasion check (e.g., "f u c k", "b i t c h")
  const collapsed = collapseSpacedLetters(text);
  if (obscenityMatcher.hasMatch(collapsed)) {
    return { isSwear: true, matchedWord: text };
  }

  // 3. Dense alphanumeric strip check (e.g., "f***k", "s.h.i.t")
  const dense = text.replace(/[^a-zA-Z0-9]/g, '');
  if (dense.length >= 4 && obscenityMatcher.hasMatch(dense)) {
    return { isSwear: true, matchedWord: text };
  }

  // 4. Secondary explicit blacklist regex check with leetspeak normalization
  const normalized = text
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't');

  for (const pattern of EXPLICIT_AUTOBAN_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      return { isSwear: true, matchedWord: match[0] };
    }
  }

  return { isSwear: false };
}

/**
 * Checks whether a chat message contains Personally Identifiable Information (PII),
 * phone numbers, emails, addresses, external links, or real-life identity solicitation.
 * Triggering this silently prevents broadcasting to other players (authentic silent drop).
 */
export function checkPII(text: string): { hasPII: boolean; reason?: string } {
  // 1. Check CP PII regex patterns
  for (const pattern of CP_PII_PATTERNS) {
    if (pattern.test(text)) {
      return { hasPII: true, reason: 'cp_pii_pattern' };
    }
  }

  // 2. Check OpenRedaction detection
  try {
    const res = openRedaction.detect(text);
    // Filter out common gaming false positives like XBOX_GAMERTAG
    const relevant = res.detections.filter(d =>
      d.type !== 'XBOX_GAMERTAG' &&
      d.type !== 'DATE'
    );
    if (relevant.length > 0) {
      return { hasPII: true, reason: relevant.map(d => d.type).join(', ') };
    }
  } catch {
    // If OpenRedaction throws on malformed input, regex pass was already performed
  }

  return { hasPII: false };
}

/**
 * Formats a ban expiry timestamp into Pacific Time (PST/PDT)
 * e.g. "October 31, 2026 9:55 AM" as expected by the Flash client ban UI.
 */
export function formatBanExpiry(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(new Date(ms));

  const val = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${val('month')} ${val('day')}, ${val('year')} ${val('hour')}:${val('minute')} ${val('dayPeriod')}`;
}

/**
 * Checks whether a penguin is currently banned and returns remaining hours.
 */
export function getBanStatus(penguin: PenguinJson, now: number = Date.now()): {
  banned: boolean;
  remainingHours: number;
  expiryDateString: string;
  reason?: string;
  isInappropriateName?: boolean;
} {
  if (penguin.banned_until !== null && penguin.banned_until !== undefined && penguin.banned_until > now) {
    const diffMs = penguin.banned_until - now;
    const remainingHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    const expiryDateString = formatBanExpiry(penguin.banned_until);
    const isInappropriateName = Boolean(penguin.ban_reason?.toLowerCase().includes('inappropriate username'));
    return {
      banned: true,
      remainingHours,
      expiryDateString,
      reason: penguin.ban_reason,
      isInappropriateName
    };
  }

  return {
    banned: false,
    remainingHours: 0,
    expiryDateString: ''
  };
}
