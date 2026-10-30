import { PenguinEquipped } from "@server/socket-server/world/world-penguin";
import { choose } from "@common/utils";

export const MOD_BOT_NAMES = [
  'Mod_Bob',
  'Mod_Sarah',
  'Mod_Dan',
  'Mod_Emily',
  'Officer_Fluff',
  'Mod_Penguin',
  'Safety_Sam',
  'CP_Patrol'
] as const;

export const MOD_BOT_NAME_SET = new Set<string>(MOD_BOT_NAMES);

export function isModeratorName(name: string): boolean {
  return MOD_BOT_NAME_SET.has(name);
}

/**
 * Generates an authentic Club Penguin moderator/safety officer outfit.
 */
export function getModeratorOutfit(): PenguinEquipped {
  // Classic police / security / safety officer uniform items
  const colors = [2, 3, 4, 8]; // Navy, Dark Green, Black, Light Blue
  const heads = [408, 404, 428, 0]; // Police Cap (408), Hard Hat (404), Tour Hat (428)
  const faces = [101, 102, 0]; // Agent Sunglasses (101), Black Glasses (102)
  const necks = [202, 210, 0]; // Black Tie (202), Whistle (210)
  const bodies = [308, 304, 301, 0]; // Police Vest (308), Safety Vest (304), Suit (301)
  const hands = [308, 323, 342, 0]; // Megaphone (308), Stop Sign (323), Magnifying Glass (342)

  return {
    color: choose(colors),
    head: choose(heads),
    face: choose(faces),
    neck: choose(necks),
    body: choose(bodies),
    hand: choose(hands),
    feet: 0,
    pin: 0,
    background: 0
  };
}

// ─────────────────────────────────────────────────────────────
// Moderator Bot Dialogue Lines (all strictly <= 48 characters)
// ─────────────────────────────────────────────────────────────

export const MODERATOR_IDLE_LINES: string[] = [
  'safety patrol! hope everyone is having fun :)',
  'officer on duty! let me know if you need help',
  'keep Club Penguin safe and friendly everyone!',
  'remember: never share your personal info online',
  'everything looks peaceful here! waddle on :)',
  'on island safety patrol. have a great day! :)',
  'respect other penguins and enjoy the island!'
];

export const MODERATOR_DISPATCH_ARRIVAL_LINES: string[] = [
  'moderator on the scene! is everyone okay?',
  'i received a report in this room. stay calm.',
  'moderator on patrol. please follow the rules.',
  'let\'s keep things safe and friendly in here.',
  'safety officer here! what seems to be going on?'
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
  'you were kicked for disruptive behavior.'
];

export const MODERATOR_BAN_LINES: string[] = [
  'your account has been banned for 24 hours.',
  'banned for severe violation of island rules.',
  'banned for 24 hours: inappropriate conduct.'
];
