import { PenguinJson } from "@server/database/database";
import { isLower } from "@server/routes/versions";

export const BETA_CUTOFF_DATE = '2005-10-24';
export const BETA_MEMBERSHIP_EXPIRY_DATE = '2005-12-01';

export const MIN_MEMBERSHIP_COINS = 500;
export const MAX_MEMBERSHIP_COINS = 50_000;
export const DISCOUNT_EXPONENT = 1.281145; // Yields exactly 1 day at 500 coins and 365 days at 50,000 coins

export function calculateMembershipDays(coins: number): number {
  if (coins < MIN_MEMBERSHIP_COINS) return 0;
  if (coins > MAX_MEMBERSHIP_COINS) {
    const extraCoins = coins - MAX_MEMBERSHIP_COINS;
    return 365 + extraCoins * (365 / MAX_MEMBERSHIP_COINS);
  }
  return Math.pow(coins / MIN_MEMBERSHIP_COINS, DISCOUNT_EXPONENT);
}

export function calculateMembershipDurationMs(coins: number): number {
  const days = calculateMembershipDays(coins);
  return Math.round(days * 86_400_000);
}

export interface MembershipEvaluation {
  isMember: boolean;
  expiryDateString: string;
}

/**
 * Evaluates whether a penguin has active membership based on:
 * 1. Global always_member setting (override)
 * 2. Active purchased membership time (real-world wall clock)
 * 3. Historical timeline beta grandfathering (registered before 2005-10-24 until timeline reaches 2005-12-01)
 */
export function evaluateMembership(
  penguin: PenguinJson,
  currentTimelineDate: string,
  currentTimeMs: number = Date.now(),
  alwaysMemberOverride: boolean = false
): MembershipEvaluation {
  if (alwaysMemberOverride) {
    return { isMember: true, expiryDateString: '10000-01-01' };
  }

  // 1. Check purchased real-world membership
  if (penguin.membership_expires !== null && penguin.membership_expires !== undefined && penguin.membership_expires > currentTimeMs) {
    const exp = new Date(penguin.membership_expires);
    const expStr = `${exp.getUTCFullYear()}-${String(exp.getUTCMonth() + 1).padStart(2, '0')}-${String(exp.getUTCDate()).padStart(2, '0')}`;
    return { isMember: true, expiryDateString: expStr };
  }

  // 2. Evaluate historical beta grandfathering
  let regDate = penguin.virtual_registration_date;
  if (!regDate && penguin.virtualRegistrationTimestamp) {
    const d = new Date(penguin.virtualRegistrationTimestamp);
    regDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  if (regDate && isLower(regDate, BETA_CUTOFF_DATE)) {
    // Registered during beta (prior to Oct 24, 2005)
    // Retains membership until timeline reaches Dec 1, 2005
    if (isLower(currentTimelineDate, BETA_MEMBERSHIP_EXPIRY_DATE)) {
      return { isMember: true, expiryDateString: BETA_MEMBERSHIP_EXPIRY_DATE };
    }
  }

  return { isMember: false, expiryDateString: '1970-01-01' };
}
