export type ModerationCategory = 'toxicity' | 'harassment' | 'inappropriate' | 'spam' | 'none';
export type ModerationAction = 'none' | 'warn' | 'mute' | 'kick' | 'ban';

export interface ModerationEvaluation {
  flagged: boolean;
  category: ModerationCategory;
  severity: number; // 0.0 to 1.0
  recommendedAction: ModerationAction;
  reason: string;
  scores: Record<ModerationCategory, number>;
}

// Heuristic pattern definitions for built-in local moderation
const SEVERE_TOXICITY_PATTERNS: RegExp[] = [
  /\b(?:kys|kill\s*your\s*self|go\s*die|hope\s*you\s*die|drink\s*bleach)\b/i,
  /\b(?:slit\s*your\s*wrists|hang\s*your\s*self)\b/i,
  /\b(?:die\s+in\s+a\s+fire|shoot\s*your\s*self)\b/i
];

const HARASSMENT_PATTERNS: RegExp[] = [
  /\b(?:you(?:'re|\s+are)\s+(?:so\s+)?(?:ugly|stupid|dumb|fat|trash|garbage|pathetic|horrible|useless|annoying|gross|disgusting))\b/i,
  /\b(?:shut\s*up|stfu|get\s*lost|nobody\s*likes\s*you|go\s*away|nobody\s*cares\s*about\s*you)\b/i,
  /\b(?:idiot|moron|loser|freak|clown|scumbag|crybaby|cry\s*baby|worthless)\b/i,
  /\b(?:i\s*hate\s*you|you\s*suck|uninstall\s*life|you\s*are\s*a\s*mistake)\b/i,
  /\b(?:leave\s*the\s*game|get\s*out\s*of\s*here\s*loser)\b/i
];

const INAPPROPRIATE_DATING_PATTERNS: RegExp[] = [
  /\b(?:be\s*my\s*(?:gf|bf|girlfriend|boyfriend)|will\s*you\s*(?:date|marry)\s*me|wanna\s*date)\b/i,
  /\b(?:kiss\s*me|make\s*out|naked|strip|strip\s*club|sexy|hot\s*penguin|in\s*bed)\b/i,
  /\b(?:take\s*off\s*your\s*(?:clothes|shirt|pants|costume))\b/i,
  /\b(?:dating\s+in\s+(?:the\s+)?(?:boiler\s*room|pizza\s*parlor|igloo))\b/i,
  /\b(?:boobs|tits|penis|vagina|horny|sensual)\b/i
];

/**
 * Built-in local moderation classifier providing instant, zero-dependency evaluation.
 */
export function classifyLocally(message: string): ModerationEvaluation {
  let toxicityScore = 0.0;
  let harassmentScore = 0.0;
  let inappropriateScore = 0.0;
  let spamScore = 0.0;
  let primaryReason = '';

  const trimmed = message.trim();

  // 1. Check severe toxicity / death threats
  for (const pat of SEVERE_TOXICITY_PATTERNS) {
    if (pat.test(trimmed)) {
      toxicityScore = 0.96;
      primaryReason = 'severe_toxicity';
      break;
    }
  }

  // 2. Check targeted harassment & bullying
  for (const pat of HARASSMENT_PATTERNS) {
    if (pat.test(trimmed)) {
      harassmentScore = Math.max(harassmentScore, 0.72);
      if (!primaryReason) primaryReason = 'harassment';
    }
  }

  // 3. Check inappropriate dating / adult themes
  for (const pat of INAPPROPRIATE_DATING_PATTERNS) {
    if (pat.test(trimmed)) {
      inappropriateScore = Math.max(inappropriateScore, 0.75);
      if (!primaryReason) primaryReason = 'inappropriate_conduct';
    }
  }

  // 4. Check spam / disruptive behavior
  // Check repetition of same word 4+ times
  const words = trimmed.split(/\s+/);
  if (words.length >= 4) {
    const wordCounts = new Map<string, number>();
    for (const w of words) {
      const lower = w.toLowerCase();
      wordCounts.set(lower, (wordCounts.get(lower) ?? 0) + 1);
    }
    const maxRepetition = Math.max(...wordCounts.values());
    if (maxRepetition >= 4) {
      spamScore = Math.max(spamScore, 0.65);
      if (!primaryReason) primaryReason = 'repetitive_spam';
    }
  }

  // Check all caps screaming if message length > 10
  if (trimmed.length > 10 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    spamScore = Math.max(spamScore, 0.40);
  }

  // Determine top category and overall severity
  const scores: Record<ModerationCategory, number> = {
    toxicity: toxicityScore,
    harassment: harassmentScore,
    inappropriate: inappropriateScore,
    spam: spamScore,
    none: 0.0
  };

  let maxCategory: ModerationCategory = 'none';
  let maxScore = 0.0;

  for (const [cat, score] of Object.entries(scores) as [ModerationCategory, number][]) {
    if (score > maxScore) {
      maxScore = score;
      maxCategory = cat;
    }
  }

  const flagged = maxScore >= 0.40;
  let recommendedAction: ModerationAction = 'none';

  if (maxScore >= 0.90) {
    recommendedAction = 'ban';
  } else if (maxScore >= 0.80) {
    recommendedAction = 'kick';
  } else if (maxScore >= 0.65) {
    recommendedAction = 'mute';
  } else if (maxScore >= 0.40) {
    recommendedAction = 'warn';
  }

  return {
    flagged,
    category: maxCategory,
    severity: maxScore,
    recommendedAction,
    reason: primaryReason || 'clean',
    scores
  };
}

/**
 * Evaluates a message using an external LocalMod server if reachable,
 * otherwise transparently falls back to our internal heuristic classifier.
 */
export async function evaluateMessage(
  message: string,
  localmodUrl: string = 'http://127.0.0.1:8000'
): Promise<ModerationEvaluation> {
  // If remote localmod is running, query its API endpoint
  if (localmodUrl) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 350);

      // Try localmod /moderate endpoint
      const response = await fetch(`${localmodUrl.replace(/\/+$/, '')}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as any;
        const cats = data.categories || {};
        const toxicity = Number(cats.toxicity ?? cats.hate_speech ?? 0);
        const harassment = Number(cats.harassment ?? 0);
        const inappropriate = Number(cats.nsfw ?? cats.sexual ?? 0);
        const spam = Number(cats.spam ?? 0);

        const scores: Record<ModerationCategory, number> = {
          toxicity,
          harassment,
          inappropriate,
          spam,
          none: 0
        };

        const maxScore = Math.max(toxicity, harassment, inappropriate, spam);
        let category: ModerationCategory = 'none';
        if (maxScore === toxicity && toxicity > 0) category = 'toxicity';
        else if (maxScore === harassment && harassment > 0) category = 'harassment';
        else if (maxScore === inappropriate && inappropriate > 0) category = 'inappropriate';
        else if (maxScore === spam && spam > 0) category = 'spam';

        let recommendedAction: ModerationAction = 'none';
        if (maxScore >= 0.90) recommendedAction = 'ban';
        else if (maxScore >= 0.80) recommendedAction = 'kick';
        else if (maxScore >= 0.65) recommendedAction = 'mute';
        else if (maxScore >= 0.40) recommendedAction = 'warn';

        return {
          flagged: data.flagged ?? maxScore >= 0.40,
          category,
          severity: maxScore,
          recommendedAction,
          reason: `localmod_api_${category}`,
          scores
        };
      }
    } catch {
      // LocalMod server not reachable or timed out; fall back to built-in classifier
    }
  }

  // Fallback to local heuristic classifier
  return classifyLocally(message);
}
