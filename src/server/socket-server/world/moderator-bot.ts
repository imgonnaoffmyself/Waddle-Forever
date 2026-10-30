import { choose } from "@common/utils";

// ─────────────────────────────────────────────────────────────
// Moderator Bot Dialogue Lines (all strictly <= 48 characters)
// ─────────────────────────────────────────────────────────────

export const MODERATOR_IDLE_LINES: string[] = [
  'safety patrol! hope everyone is having fun :)',
  'island moderator here! enjoy your day :)',
  'keep Club Penguin safe and friendly everyone!',
  'remember: never share your personal info online',
  'everything looks peaceful here! waddle on :)',
  'having fun everyone? keep it safe and friendly!',
  'respect other penguins and enjoy the island!'
];

export const MODERATOR_WARNING_LINES: string[] = [
  'watch your language! keep Club Penguin safe.',
  'official warning: be respectful to others!',
  'bullying is not tolerated on Club Penguin!',
  'please remember rule #1: respect each other.',
  'final warning: follow the rules or get kicked'
];

export const MODERATOR_MUTE_LINES: string[] = [
  'you have been muted for 5 minutes.',
  'muted for 5 minutes for inappropriate chat.',
  'muted: please take 5 minutes to calm down.'
];

export const MODERATOR_KICK_LINES: string[] = [
  'you have been removed from the island.',
  'kicked for breaking Club Penguin safety rules.',
  'you were kicked for disruptive behavior.',
  'that is not allowed here. you are kicked.'
];

export const MODERATOR_BAN_LINES: string[] = [
  'your account has been banned for 24 hours.',
  'banned for severe violation of island rules.',
  'banned for 24 hours: inappropriate conduct.',
  'zero tolerance for that. your account is banned'
];

// Canadian developer moderator lines (polite yet firm!)
export const DEV_WARNING_LINES: string[] = [
  'hey, please keep the island friendly eh!',
  'whoa, watch the language! let\'s keep it safe.',
  'that\'s not cool. please follow the rules eh.',
  'friendly reminder: keep it clean on our island!'
];

export const DEV_KICK_LINES: string[] = [
  'sorry eh, but that is not allowed on our game.',
  'that\'s completely inappropriate. kicked!',
  'we have rules here! you have been removed.',
  'kicked for breaking our community rules, eh.'
];

export const DEV_BAN_LINES: string[] = [
  'absolutely not on our watch. banned for 24h.',
  'zero tolerance for that. 24h ban issued.',
  'banned for 24 hours. keep Club Penguin safe!',
  'banned for 24h for inappropriate conduct eh.'
];

// Dev lines when specifically addressed by an offending player
export const DEV_TARGETED_REACTIONS: string[] = [
  'excuse me?! that\'s completely inappropriate.',
  'what is wrong with you?! absolutely not.',
  'not cool at all. enjoy the ban eh.',
  'uh no way. that is completely unacceptable.'
];

// Regular bot shock lines when witnessing rule-breaking
export const REGULAR_BOT_SHOCK_LINES: string[] = [
  'what the heck?!',
  'eww!! reported!!',
  'MODS!!',
  'gross!!',
  'reported! that is so not okay.',
  'enjoy the ban lol',
  'why would you say that?!',
  'get him out of here!!',
  'mods are gonna ban you for that!'
];

