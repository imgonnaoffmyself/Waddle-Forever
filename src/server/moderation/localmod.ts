import http from 'http';

export type ModerationCategory = 'toxicity' | 'harassment' | 'nsfw' | 'predatory' | 'spam' | 'none';
export type ModerationAction = 'none' | 'warn' | 'mute' | 'kick' | 'ban';
export type ModerationSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical';

export const SEVERITY_RANK: Record<ModerationSeverity, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function scoreToSeverityLevel(score: number): ModerationSeverity {
  if (score >= 0.90) return 'critical';
  if (score >= 0.70) return 'high';
  if (score >= 0.50) return 'medium';
  if (score >= 0.40) return 'low';
  return 'none';
}

export interface ModerationEvaluation {
  flagged: boolean;
  category: ModerationCategory;
  severity: number; // 0.0 to 1.0
  severityLevel: ModerationSeverity;
  recommendedAction: ModerationAction;
  reason: string;
  scores: Record<ModerationCategory, number>;
}

// ─────────────────────────────────────────────────────────────
// 1. Predatory Conduct, Grooming & Child Exploitation (Zero Tolerance)
// ─────────────────────────────────────────────────────────────
const PREDATORY_PATTERNS: RegExp[] = [
  // Direct statements of touching or harming kids/minors
  /\b(?:i\s+touch\s+(?:kids|children|minors|babies|little\s+(?:girls?|boys?|ones?)))\b/i,
  /\b(?:touch(?:ing)?|fondl(?:e|ing)|molest(?:ing)?|groom(?:ing)?)\s+(?:kids|children|minors|little\s+(?:girls?|boys?)|toddlers?)\b/i,
  /\b(?:i\s+like|i\s+love)\s+(?:little\s+(?:girls?|boys?)|kids\s+in\s+a\s+sexual\s+way)\b/i,
  // Pedophilia identifiers
  /\b(?:pedophil(?:e|ia)|pedo|paedo|paedophile|pedobear|child\s*toucher|kid\s*toucher|child\s*molester|diddler)\b/i,
  // Underage sexual references
  /\b(?:underage|minor)\s+(?:sex|dating|naked|pics|nudes?|porn)\b/i,
  /\b(?:sex\s+with\s+(?:minors|kids|children|little\s+(?:girls?|boys?)))\b/i,
  // Jeffrey Epstein / Pedophile ring references
  /\b(?:epstein(?:'s|s)?|jeffrey\s+epstein|epstein\s+island|lolita\s+express)\b/i,
  // Solicitation targeting children
  /\b(?:wanna\s+see\s+my\s+cp|send\s+cp)\b/i,
  /\b(?:are\s+you\s+a\s+little\s+(?:girl|boy)|how\s+old\s+are\s+you\s+little)\b/i
];

// ─────────────────────────────────────────────────────────────
// 2. Hate Speech, Extremism & Extreme Toxicity
// ─────────────────────────────────────────────────────────────
const HATE_SPEECH_PATTERNS: RegExp[] = [
  // Racial and ethnic slurs
  /\b(?:coon|coons|nigger|niggers|nigga|niggas|chink|chinks|kike|kikes|spic|spics|gook|gooks|wetback|wetbacks)\b/i,
  // Anti-LGBTQ+ slurs
  /\b(?:faggot|faggots|fag|fags|tranny|trannies|shemale)\b/i,
  // Ableist slurs
  /\b(?:retard|retarded|retards)\b/i,
  // Hate declarations targeting demographics
  /\bi\s+hate\s+(?:coons|niggers|blacks|africans|jews|muslims|gays|fags|trans|mexicans|asians|whites)\b/i,
  /\b(?:kill\s+all\s+(?:blacks|africans|jews|gays|fags|whites|muslims|cops))\b/i,
  /\b(?:white\s+power|heil\s+hitler|gas\s+the\s+jews|nazi\s+salute)\b/i,
  // Racist violence, lynching, executions targeting protected groups
  /\b(?:hung|hanged|hang|lynch(?:ed|ing)?)\s+(?:from\s+(?:trees?|ropes?|poles?)|all)\b/i,
  /\b(?:africans?|blacks?|niggers?|jews?|muslims?|gays?|trans|minorities)\s+(?:need\s+to\s+be|should\s+be|must\s+be|ought\s+to\s+be)\s+(?:hung|hanged|killed|shot|lynched|exterminated|burned|gassed)\b/i,
  /\b(?:kill|hang|lynch|shoot|burn|gas|exterminate|wipe\s+out)\s+(?:all\s+)?(?:africans?|blacks?|niggers?|jews?|muslims?|gays?|trans|minorities)\b/i,
  /\b(?:lynch(?:ing|ed|es)?|lynch\s*mob)\b/i,
  /\b(?:gas\s+(?:the\s+)?(?:jews|blacks|africans|gays))\b/i,
  /\bmoonman\b/i
];

const SEVERE_TOXICITY_PATTERNS: RegExp[] = [
  /\b(?:kys|kill\s*your\s*self|go\s*die|hope\s*you\s*die|drink\s*bleach)\b/i,
  /\b(?:slit\s*your\s*wrists?|hang\s*your\s*self|jump\s+off\s+a\s+bridge)\b/i,
  /\b(?:die\s+in\s+a\s+fire|shoot\s*your\s*self|swallow\s+pills)\b/i
];

// ─────────────────────────────────────────────────────────────
// 3. NSFW, Explicit Sexual Conduct & Solicitation
// ─────────────────────────────────────────────────────────────
const NSFW_EXPLICIT_PATTERNS: RegExp[] = [
  // Oral sex and explicit sexual requests
  /\b(?:suck\s+me\s+off|suck\s+(?:my\s+)?(?:dick|cock|nuts|balls|schlong|penis|willy|pecker|meat))\b/i,
  /\b(?:lick\s+(?:my\s+)?(?:nuts|balls|cock|dick|ass|pussy|clit|taint|hole|shaft))\b/i,
  /\b(?:eat\s+(?:each\s+other\s+out|me\s+out|her\s+out|my\s+ass|out))\b/i,
  /\b(?:blow\s*job|blowjob|hand\s*job|handjob|foot\s*job|rim\s*job|cum\s*shot)\b/i,
  /\b(?:jerk(?:ing)?\s*off|masturbat(?:e|ing)|wank(?:ing)?)\b/i,
  // Sex acts / intercourse
  /\b(?:fuck\s+me|fuck\s+her|fuck\s+him|have\s+sex|sleep\s+with\s+me|wanna\s+have\s+sex|cyber\s*sex)\b/i,
  // Solicitation & Prostitution / Sexual trade
  /\b(?:who\s+wants\s+to\s+(?:me\s+)?suck\s+me\s+off|who\s+wants\s+to\s+fuck|who\s+wants\s+to\s+have\s+sex)\b/i,
  /\b(?:who\s+wants\s+to\s+(?:eat\s+me\s+out|make\s+out|strip))\b/i,
  /\b(?:for\s+a\s+pound|for\s+(?:\d+|coins|money|cash|robux|free))\b.*(?:suck|fuck|sex|blowjob|strip|nudes?|eat\s+out)/i,
  /\b(?:suck|fuck|sex|eat\s+out|blowjob).*(?:for\s+a\s+pound|for\s+(?:\d+|coins|money|cash))\b/i,
  // Genitalia / explicit anatomy
  /\b(?:nutsack|scrotum|cock|dick|penis|pussy|vagina|boobs|tits|clit|asshole|dildo)\b/i,
  /\b(?:cum\s+on|cumming|orgasm|ejaculat(?:e|ion))\b/i,
  // Adult roleplay & in-game dating
  /\b(?:strip|get\s+naked|take\s+off\s+your\s+clothes|touch\s+my|horny|sensual)\b/i,
  /\b(?:be\s*my\s*(?:gf|bf|girlfriend|boyfriend)|will\s*you\s*(?:date|marry)\s*me|wanna\s*date)\b/i,
  /\b(?:dating\s+in\s+(?:the\s+)?(?:boiler\s*room|pizza\s*parlor|igloo|cove|box\s*dimension))\b/i
];

// ─────────────────────────────────────────────────────────────
// 4. Harassment & Bullying
// ─────────────────────────────────────────────────────────────
const HARASSMENT_PATTERNS: RegExp[] = [
  /\b(?:you(?:'re|\s+are)\s+(?:so\s+)?(?:ugly|stupid|dumb|fat|trash|garbage|pathetic|horrible|useless|annoying|gross|disgusting))\b/i,
  /\b(?:shut\s*up|stfu|get\s*lost|nobody\s*likes\s*you|go\s*away|nobody\s*cares\s*about\s*you)\b/i,
  /\b(?:idiot|moron|loser|freak|scumbag|crybaby|cry\s*baby|worthless|clown)\b/i,
  /\b(?:i\s*hate\s*you|you\s*suck|uninstall\s*life|you\s*are\s*a\s*mistake)\b/i,
  /\b(?:leave\s*the\s*game|get\s*out\s*of\s*here\s*loser)\b/i
];

/**
 * Normalizes repeated punctuation or spacing to catch evasion like "s.u.c.k" or "f  u  c  k"
 */
function normalizeEvasions(text: string): string {
  // Collapse separated letters: "l i c k" -> "lick"
  let norm = text.replace(/(?:^|\s)((?:[a-zA-Z][\s._\-*~]+)+[a-zA-Z])(?:\s|$)/g, (_m, g) => {
    return ' ' + g.replace(/[\s._\-*~]+/g, '') + ' ';
  });
  // Replace common leetspeak substitutions
  norm = norm
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't');
  return norm;
}

/**
 * Built-in local moderation classifier providing instant, zero-dependency evaluation
 * mirroring LocalMod's 6 classifier taxonomy.
 */
export function classifyLocally(message: string): ModerationEvaluation {
  let predatoryScore = 0.0;
  let toxicityScore = 0.0;
  let harassmentScore = 0.0;
  let nsfwScore = 0.0;
  let spamScore = 0.0;
  let primaryReason = '';

  const raw = message.trim();
  const normalized = normalizeEvasions(raw);

  // 1. Check predatory conduct & child exploitation (Maximum severity)
  for (const pat of PREDATORY_PATTERNS) {
    if (pat.test(raw) || pat.test(normalized)) {
      predatoryScore = 1.0;
      primaryReason = 'child_predation_or_grooming';
      break;
    }
  }

  // 2. Check hate speech & severe toxicity
  for (const pat of HATE_SPEECH_PATTERNS) {
    if (pat.test(raw) || pat.test(normalized)) {
      toxicityScore = Math.max(toxicityScore, 0.98);
      if (!primaryReason) primaryReason = 'hate_speech';
      break;
    }
  }

  for (const pat of SEVERE_TOXICITY_PATTERNS) {
    if (pat.test(raw) || pat.test(normalized)) {
      toxicityScore = Math.max(toxicityScore, 0.96);
      if (!primaryReason) primaryReason = 'severe_toxicity_or_threats';
      break;
    }
  }

  // 3. Check NSFW, explicit sexual acts, oral sex, genitals & solicitation
  for (const pat of NSFW_EXPLICIT_PATTERNS) {
    if (pat.test(raw) || pat.test(normalized)) {
      // Differentiate explicit sexual acts vs mild dating
      const isMildDating = /\b(?:be\s*my\s*(?:gf|bf|girlfriend|boyfriend)|wanna\s*date)\b/i.test(raw) &&
        !/\b(?:suck|lick|eat\s+out|fuck|dick|cock|nuts|balls|pussy|vagina|boobs|strip|naked)\b/i.test(raw);

      const score = isMildDating ? 0.60 : 0.94;
      nsfwScore = Math.max(nsfwScore, score);
      if (!primaryReason) primaryReason = isMildDating ? 'dating_conduct' : 'explicit_nsfw_sexual';
      if (!isMildDating) break;
    }
  }

  // 4. Check targeted harassment & bullying
  for (const pat of HARASSMENT_PATTERNS) {
    if (pat.test(raw) || pat.test(normalized)) {
      harassmentScore = Math.max(harassmentScore, 0.75);
      if (!primaryReason) primaryReason = 'harassment';
      break;
    }
  }

  // 5. Check repetitive spam / disruptive behavior
  const words = raw.split(/\s+/);
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

  // All caps screaming if message length > 12
  if (raw.length > 12 && raw === raw.toUpperCase() && /[A-Z]/.test(raw)) {
    spamScore = Math.max(spamScore, 0.40);
    if (!primaryReason) primaryReason = 'excessive_caps_spam';
  }

  // Map scores
  const scores: Record<ModerationCategory, number> = {
    predatory: predatoryScore,
    toxicity: toxicityScore,
    harassment: harassmentScore,
    nsfw: nsfwScore,
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

  const severityLevel = scoreToSeverityLevel(maxScore);
  const flagged = severityLevel !== 'none';
  let recommendedAction: ModerationAction = 'none';

  if (severityLevel === 'critical') {
    recommendedAction = 'ban';
  } else if (severityLevel === 'high') {
    recommendedAction = 'kick';
  } else if (severityLevel === 'medium') {
    recommendedAction = 'mute';
  } else if (severityLevel === 'low') {
    recommendedAction = 'warn';
  }

  return {
    flagged,
    category: maxCategory,
    severity: maxScore,
    severityLevel,
    recommendedAction,
    reason: primaryReason || 'clean',
    scores
  };
}

export interface LocalModClassifierResult {
  classifier: string;
  flagged: boolean;
  confidence: number;
  severity: string;
  categories?: string[];
  metadata?: Record<string, any>;
  explanation?: string;
}

export interface LocalModAnalyzeResponse {
  flagged: boolean;
  results: LocalModClassifierResult[];
  summary: string;
  processing_time_ms: number;
}

/**
 * Evaluates a message using an external LocalMod server if reachable,
 * otherwise transparently falls back to our internal heuristic classifier.
 */
export async function evaluateMessage(
  message: string,
  localmodUrl: string = 'http://127.0.0.1:8000'
): Promise<ModerationEvaluation> {
  const localEval = classifyLocally(message);

  if (localmodUrl) {
    try {
      console.log(`[LocalMod] Sending message to API for analysis: "${message}"`);
      const data = await new Promise<LocalModAnalyzeResponse>((resolve, reject) => {
        const body = JSON.stringify({ text: message, classifiers: ['toxicity', 'spam', 'pii'] });
        const reqOptions: http.RequestOptions = {
          hostname: '127.0.0.1',
          port: 8000,
          path: '/analyze',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body)
          },
          timeout: 30000
        };

        const req = http.request(reqOptions, (res) => {
          let raw = '';
          res.on('data', (chunk: Buffer) => { raw += chunk; });
          res.on('end', () => {
            if (res.statusCode === 200) {
              try { resolve(JSON.parse(raw) as LocalModAnalyzeResponse); }
              catch { reject(new Error('Invalid JSON')); }
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(body);
        req.end();
      });

      let nsfw = localEval.scores.nsfw;
      let toxicity = localEval.scores.toxicity;
      let spam = localEval.scores.spam;
      let harassment = localEval.scores.harassment;
      let predatory = localEval.scores.predatory;

      let apiMaxSeverity: ModerationSeverity = 'none';
      for (const res of data.results || []) {
        const conf = Number(res.confidence ?? 0);
        if (res.classifier === 'toxicity' && res.flagged) {
          toxicity = Math.max(toxicity, conf, res.severity === 'critical' ? 0.95 : 0.85);
        } else if (res.classifier === 'spam' && res.flagged) {
          spam = Math.max(spam, conf, 0.70);
        }

        if (res.flagged && res.severity) {
          const s = res.severity.toLowerCase() as ModerationSeverity;
          if (SEVERITY_RANK[s] !== undefined && SEVERITY_RANK[s] > SEVERITY_RANK[apiMaxSeverity]) {
            apiMaxSeverity = s;
          }
        }
      }

      const scores: Record<ModerationCategory, number> = {
        predatory,
        toxicity,
        harassment,
        nsfw,
        spam,
        none: 0
      };

      const maxScore = Math.max(predatory, toxicity, harassment, nsfw, spam);
      let category: ModerationCategory = localEval.category;
      if (maxScore === predatory && predatory > 0) category = 'predatory';
      else if (maxScore === toxicity && toxicity > 0) category = 'toxicity';
      else if (maxScore === harassment && harassment > 0) category = 'harassment';
      else if (maxScore === nsfw && nsfw > 0) category = 'nsfw';
      else if (maxScore === spam && spam > 0) category = 'spam';

      const localSeverity = localEval.severityLevel;
      let overallSeverityLevel: ModerationSeverity =
        SEVERITY_RANK[apiMaxSeverity] > SEVERITY_RANK[localSeverity]
          ? apiMaxSeverity
          : localSeverity;

      if ((data.flagged || localEval.flagged || maxScore >= 0.40) && overallSeverityLevel === 'none') {
        const fallback = scoreToSeverityLevel(maxScore);
        overallSeverityLevel = fallback !== 'none' ? fallback : 'low';
      }

      const isFlagged = overallSeverityLevel !== 'none';
      let recommendedAction: ModerationAction = 'none';
      if (overallSeverityLevel === 'critical') recommendedAction = 'ban';
      else if (overallSeverityLevel === 'high') recommendedAction = 'kick';
      else if (overallSeverityLevel === 'medium') recommendedAction = 'mute';
      else if (overallSeverityLevel === 'low') recommendedAction = 'warn';

      console.log(`[LocalMod] Evaluated "${message}": flagged=${isFlagged}, category=${category}, severityLevel=${overallSeverityLevel}, action=${recommendedAction}`);

      return {
        flagged: isFlagged,
        category,
        severity: maxScore,
        severityLevel: overallSeverityLevel,
        recommendedAction,
        reason: (data.flagged && data.summary) ? data.summary : localEval.reason,
        scores
      };
    } catch (err) {
      console.error('[LocalMod] Request to moderation API failed:', err);
    }
  }

  return localEval;
}

export interface LocalModPlayerRecord {
  consecutiveMediums: number;
  mediumTimestamps: number[];
  consecutiveHighs: number;
  highTimestamps: number[];
}

/**
 * Tracks and evaluates moderation actions for messages flagged by LocalMod:
 * - low: take no action
 * - medium: only take action after 3 mediums in a row or 3 mediums in 90 seconds
 * - high: only take action after 2 highs in a row or 2 highs in 60 seconds
 * - critical: take action immediately
 */
export class LocalModTracker {
  private _records = new Map<number, LocalModPlayerRecord>();

  public shouldTakeAction(
    penguinId: number,
    evaluation: ModerationEvaluation,
    now: number = Date.now()
  ): boolean {
    if (!evaluation.flagged || evaluation.severityLevel === 'none') {
      const rec = this._records.get(penguinId);
      if (rec) {
        rec.consecutiveMediums = 0;
        rec.consecutiveHighs = 0;
      }
      return false;
    }

    const rec = this._getRecord(penguinId);

    switch (evaluation.severityLevel) {
      case 'critical': {
        // critical: take action immediately
        this.resetPlayer(penguinId);
        return true;
      }

      case 'high': {
        // high: only take action after 2 highs in a row or 2 highs in 60 seconds
        rec.consecutiveMediums = 0;
        rec.consecutiveHighs++;
        rec.highTimestamps = rec.highTimestamps.filter(t => now - t <= 60_000);
        rec.highTimestamps.push(now);

        if (rec.consecutiveHighs >= 2 || rec.highTimestamps.length >= 2) {
          this.resetPlayer(penguinId);
          return true;
        }
        return false;
      }

      case 'medium': {
        // medium: only take action after 3 mediums in a row or 3 mediums in 90 seconds
        rec.consecutiveHighs = 0;
        rec.consecutiveMediums++;
        rec.mediumTimestamps = rec.mediumTimestamps.filter(t => now - t <= 90_000);
        rec.mediumTimestamps.push(now);

        if (rec.consecutiveMediums >= 3 || rec.mediumTimestamps.length >= 3) {
          this.resetPlayer(penguinId);
          return true;
        }
        return false;
      }

      case 'low': {
        // low: take no action
        rec.consecutiveMediums = 0;
        rec.consecutiveHighs = 0;
        return false;
      }

      default:
        return false;
    }
  }

  public recordSafeMessage(penguinId: number): void {
    const rec = this._records.get(penguinId);
    if (rec) {
      rec.consecutiveMediums = 0;
      rec.consecutiveHighs = 0;
    }
  }

  public resetPlayer(penguinId: number): void {
    this._records.delete(penguinId);
  }

  public getPlayerRecord(penguinId: number): Readonly<LocalModPlayerRecord> | undefined {
    return this._records.get(penguinId);
  }

  public clear(): void {
    this._records.clear();
  }

  private _getRecord(penguinId: number): LocalModPlayerRecord {
    let rec = this._records.get(penguinId);
    if (!rec) {
      rec = {
        consecutiveMediums: 0,
        mediumTimestamps: [],
        consecutiveHighs: 0,
        highTimestamps: []
      };
      this._records.set(penguinId, rec);
    }
    return rec;
  }
}

export const preBroadcastTracker = new LocalModTracker();
export const postBroadcastTracker = new LocalModTracker();
export const localModTracker = postBroadcastTracker;

export function shouldTakeActionOnFlaggedMessage(
  penguinId: number,
  evaluation: ModerationEvaluation,
  now: number = Date.now()
): boolean {
  return localModTracker.shouldTakeAction(penguinId, evaluation, now);
}

