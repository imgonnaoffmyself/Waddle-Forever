import { PenguinJson } from "@server/database/database";
import { isLower } from "@server/routes/versions";

export const BETA_CUTOFF_DATE = '2005-10-24';
export const BETA_MEMBERSHIP_EXPIRY_DATE = '2005-12-01';
export const PRICE_INCREASE_DATE = '2011-07-13';

export type MembershipPackId = '1_month' | '6_months' | '12_months';

export interface MembershipPack {
  id: MembershipPackId;
  name: string;
  months: number;
  days: number;
  durationMs: number;
  cadPrice: number;
  coins: number;
}

export function getMembershipPacks(timelineDate: string): MembershipPack[] {
  const isPostIncrease = !isLower(timelineDate, PRICE_INCREASE_DATE);

  return [
    {
      id: '1_month',
      name: '1 Month',
      months: 1,
      days: 30,
      durationMs: 30 * 86_400_000,
      cadPrice: isPostIncrease ? 7.95 : 5.95,
      coins: isPostIncrease ? 795 : 595
    },
    {
      id: '6_months',
      name: '6 Months',
      months: 6,
      days: 180,
      durationMs: 180 * 86_400_000,
      cadPrice: isPostIncrease ? 39.95 : 29.95,
      coins: isPostIncrease ? 3995 : 2995
    },
    {
      id: '12_months',
      name: '12 Months',
      months: 12,
      days: 365,
      durationMs: 365 * 86_400_000,
      cadPrice: isPostIncrease ? 59.95 : 57.95,
      coins: isPostIncrease ? 5995 : 5795
    }
  ];
}

export function getMembershipPack(packId: string, timelineDate: string): MembershipPack | undefined {
  return getMembershipPacks(timelineDate).find(p => p.id === packId);
}

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

  // 2. During beta (strictly before Oct 24, 2005), all penguins have full membership access
  if (isLower(currentTimelineDate, BETA_CUTOFF_DATE)) {
    return { isMember: true, expiryDateString: BETA_CUTOFF_DATE };
  }

  // 3. On or after Oct 24, 2005: evaluate historical beta grandfathering
  let regDate = penguin.virtual_registration_date;
  if (!regDate && penguin.virtualRegistrationTimestamp) {
    const d = new Date(penguin.virtualRegistrationTimestamp);
    regDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
